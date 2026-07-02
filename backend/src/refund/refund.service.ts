import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { PaymentsService } from '../payments/payments.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // Runs at 11:59 PM every day (end-of-day refund for uncollected orders)
  @Cron('59 23 * * *')
  async handleCronRefunds() {
    this.logger.log('Executing automated end-of-day refund job...');
    const result = await this.processUncollectedRefunds();
    this.logger.log(`Automated refund job completed. Processed ${result.processedOrdersCount} orders.`);
  }

  async processUncollectedRefunds(): Promise<{ processedOrdersCount: number; refundedItemsCount: number; totalRefundedAmount: number }> {
    // 1. Fetch all orders with active (non-terminal) status that might have uncollected items
    const orders = await this.orderRepository.find({
      where: {
        status: In(['PENDING', 'CONFIRMED', 'PARTIALLY_COLLECTED']),
      },
      relations: { items: true },
    });

    let processedOrdersCount = 0;
    let refundedItemsCount = 0;
    let totalRefundedAmount = 0;

    for (const order of orders) {
      const uncollectedItems = order.items.filter((item) => item.status === 'PENDING');

      if (uncollectedItems.length === 0) {
        continue;
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        let orderRefundTotal = 0;

        // Load the order and its items inside the transaction to prevent concurrency issues and cascade overrides
        const dbOrder = await queryRunner.manager.findOne(Order, {
          where: { id: order.id },
          relations: { items: true },
        });

        if (!dbOrder) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          continue;
        }

        const activeUncollected = dbOrder.items.filter((i) => i.status === 'PENDING');
        if (activeUncollected.length === 0) {
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          continue;
        }

        // Calculate refund total for uncollected items
        for (const item of activeUncollected) {
          const itemAmount = Number(item.unitPrice) * item.quantity;
          orderRefundTotal += itemAmount;

          item.status = 'REFUNDED';
          refundedItemsCount++;
        }

        if (orderRefundTotal > 0) {
          if (!dbOrder.userId) {
            // Cashier anonymous order: cannot do wallet or B2C refund automatically.
            this.logger.warn(
              `Order ${dbOrder.id} is an anonymous cashier order. Manual cash refund of KES ${orderRefundTotal} required. Marking items refunded in DB.`,
            );
            
            const paymentRefund = new Payment();
            paymentRefund.orderId = dbOrder.id;
            paymentRefund.amount = orderRefundTotal;
            paymentRefund.method = 'CASH';
            paymentRefund.status = 'REFUNDED';
            paymentRefund.transactionReference = `CASH_REFUND_MANUAL_${Date.now()}`;
            await queryRunner.manager.save(Payment, paymentRefund);
          } else {
            // Find completed or pending payments for this order
            const orderPayments = await queryRunner.manager.find(Payment, {
              where: { orderId: dbOrder.id, status: In(['COMPLETED', 'PENDING']) },
            });

            // Determine primary payment method used
            const hasMpesa = orderPayments.some((p) => p.method === 'MPESA');

            if (hasMpesa) {
              // Trigger Safaricom B2C transfer
              const b2cRes = await this.paymentsService.triggerB2cRefund(
                dbOrder.userId,
                orderRefundTotal,
                dbOrder.id,
              );

              if (b2cRes.success) {
                const b2cPayment = new Payment();
                b2cPayment.orderId = dbOrder.id;
                b2cPayment.userId = dbOrder.userId;
                b2cPayment.amount = orderRefundTotal;
                b2cPayment.method = 'MPESA';
                b2cPayment.status = 'REFUNDED';
                b2cPayment.transactionReference = b2cRes.transactionId || `B2C_${Date.now()}`;
                await queryRunner.manager.save(Payment, b2cPayment);
              } else {
                // M-Pesa B2C failed, fall back to Wallet credit
                this.logger.error(
                  `M-Pesa B2C refund failed for order ${dbOrder.id}: ${b2cRes.error}. Falling back to wallet credit.`,
                );
                await this.creditToWalletTx(
                  queryRunner.manager,
                  dbOrder.userId,
                  orderRefundTotal,
                  dbOrder.id,
                  'MPESA_B2C_FALLBACK',
                );
              }
            } else {
              // Direct wallet refund or CASH with user
              await this.creditToWalletTx(
                queryRunner.manager,
                dbOrder.userId,
                orderRefundTotal,
                dbOrder.id,
                'WALLET',
              );
            }
          }
        }

        // Determine new status for order
        const hasCollected = dbOrder.items.some((i) => i.status === 'COLLECTED');
        const hasRefunded = dbOrder.items.some((i) => i.status === 'REFUNDED');
        const allRefunded = dbOrder.items.every((i) => i.status === 'REFUNDED');

        if (allRefunded) {
          dbOrder.status = 'REFUNDED';
        } else if (hasCollected && hasRefunded) {
          dbOrder.status = 'PARTIALLY_REFUNDED';
        }

        // Apply loyalty points logic
        if (orderRefundTotal > 0 && dbOrder.userId) {
          if (dbOrder.status === 'PARTIALLY_REFUNDED') {
            const collectedItems = dbOrder.items.filter((i) => i.status === 'COLLECTED');
            const collectedTotal = collectedItems.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
            const totalPreDiscount = Number(dbOrder.totalAmount) + dbOrder.pointsRedeemed;
            const collectedRatio = totalPreDiscount > 0 ? collectedTotal / totalPreDiscount : 0;
            const netCollectedAmount = collectedTotal - (dbOrder.pointsRedeemed * collectedRatio);
            const pointsToCredit = Math.floor(netCollectedAmount / 10);
            if (pointsToCredit > 0) {
              await this.loyaltyService.creditPointsForCollection(
                dbOrder.userId,
                pointsToCredit,
                dbOrder.id,
                queryRunner.manager,
              );
            }
          } else {
            // If the order status was already COLLECTED, trigger has fired and credited full points.
            // We need to deduct points for the refunded items.
            if (order.status === 'COLLECTED') {
              const totalPreDiscount = Number(dbOrder.totalAmount) + dbOrder.pointsRedeemed;
              const refundedRatio = totalPreDiscount > 0 ? orderRefundTotal / totalPreDiscount : 0;
              const netRefundedAmount = orderRefundTotal - (dbOrder.pointsRedeemed * refundedRatio);
              const pointsToDeduct = Math.floor(netRefundedAmount / 10);
              if (pointsToDeduct > 0) {
                await this.loyaltyService.deductPointsForRefund(
                  dbOrder.userId,
                  pointsToDeduct,
                  dbOrder.id,
                  queryRunner.manager,
                );
              }
            }
          }
        }

        await queryRunner.manager.save(Order, dbOrder);
        await queryRunner.commitTransaction();

        processedOrdersCount++;
        totalRefundedAmount += orderRefundTotal;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to process refund for order ${order.id}: ${errMsg}`);
      } finally {
        await queryRunner.release();
      }
    }

    return {
      processedOrdersCount,
      refundedItemsCount,
      totalRefundedAmount,
    };
  }

  async refundSingleOrder(orderId: string): Promise<{ refundedItemsCount: number; totalRefundedAmount: number }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    if (!['PENDING', 'CONFIRMED', 'PARTIALLY_COLLECTED'].includes(order.status)) {
      throw new Error(`Order ${orderId} is not in a refundable state (status: ${order.status}).`);
    }

    const uncollectedItems = order.items.filter((item) => item.status === 'PENDING');
    if (uncollectedItems.length === 0) {
      throw new Error(`Order ${orderId} has no uncollected items to refund.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let orderRefundTotal = 0;
      let refundedItemsCount = 0;

      const dbOrder = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: { items: true },
      });

      if (!dbOrder) {
        throw new Error(`Order ${orderId} not found in transaction.`);
      }

      const activeUncollected = dbOrder.items.filter((i) => i.status === 'PENDING');
      if (activeUncollected.length === 0) {
        throw new Error(`Order ${orderId} has no uncollected items to refund.`);
      }

      for (const item of activeUncollected) {
        const itemAmount = Number(item.unitPrice) * item.quantity;
        orderRefundTotal += itemAmount;
        item.status = 'REFUNDED';
        refundedItemsCount++;
      }

      if (orderRefundTotal > 0) {
        if (!dbOrder.userId) {
          const paymentRefund = new Payment();
          paymentRefund.orderId = dbOrder.id;
          paymentRefund.amount = orderRefundTotal;
          paymentRefund.method = 'CASH';
          paymentRefund.status = 'REFUNDED';
          paymentRefund.transactionReference = `CASH_REFUND_MANUAL_${Date.now()}`;
          await queryRunner.manager.save(Payment, paymentRefund);
        } else {
          const orderPayments = await queryRunner.manager.find(Payment, {
            where: { orderId: dbOrder.id, status: In(['COMPLETED', 'PENDING']) },
          });

          const hasMpesa = orderPayments.some((p) => p.method === 'MPESA');

          if (hasMpesa) {
            const b2cRes = await this.paymentsService.triggerB2cRefund(
              dbOrder.userId,
              orderRefundTotal,
              dbOrder.id,
            );

            if (b2cRes.success) {
              const b2cPayment = new Payment();
              b2cPayment.orderId = dbOrder.id;
              b2cPayment.userId = dbOrder.userId;
              b2cPayment.amount = orderRefundTotal;
              b2cPayment.method = 'MPESA';
              b2cPayment.status = 'REFUNDED';
              b2cPayment.transactionReference = b2cRes.transactionId || `B2C_${Date.now()}`;
              await queryRunner.manager.save(Payment, b2cPayment);
            } else {
              this.logger.error(
                `M-Pesa B2C refund failed for order ${dbOrder.id}: ${b2cRes.error}. Falling back to wallet credit.`,
              );
              await this.creditToWalletTx(
                queryRunner.manager,
                dbOrder.userId,
                orderRefundTotal,
                dbOrder.id,
                'MPESA_B2C_FALLBACK',
              );
            }
          } else {
            await this.creditToWalletTx(
              queryRunner.manager,
              dbOrder.userId,
              orderRefundTotal,
              dbOrder.id,
              'WALLET',
            );
          }
        }
      }

      const hasCollected = dbOrder.items.some((i) => i.status === 'COLLECTED');
      const allRefunded = dbOrder.items.every((i) => i.status === 'REFUNDED');

      if (allRefunded) {
        dbOrder.status = 'REFUNDED';
      } else if (hasCollected) {
        dbOrder.status = 'PARTIALLY_REFUNDED';
      }

      if (orderRefundTotal > 0 && dbOrder.userId) {
        if (dbOrder.status === 'PARTIALLY_REFUNDED') {
          const collectedItems = dbOrder.items.filter((i) => i.status === 'COLLECTED');
          const collectedTotal = collectedItems.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
          const totalPreDiscount = Number(dbOrder.totalAmount) + dbOrder.pointsRedeemed;
          const collectedRatio = totalPreDiscount > 0 ? collectedTotal / totalPreDiscount : 0;
          const netCollectedAmount = collectedTotal - (dbOrder.pointsRedeemed * collectedRatio);
          const pointsToCredit = Math.floor(netCollectedAmount / 10);
          if (pointsToCredit > 0) {
            await this.loyaltyService.creditPointsForCollection(
              dbOrder.userId,
              pointsToCredit,
              dbOrder.id,
              queryRunner.manager,
            );
          }
        }
      }

      await queryRunner.manager.save(Order, dbOrder);
      await queryRunner.commitTransaction();

      return { refundedItemsCount, totalRefundedAmount: orderRefundTotal };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async creditToWalletTx(
    entityManager: any,
    userId: string,
    amount: number,
    orderId: string,
    method: string,
  ) {
    let wallet = await entityManager.findOne(Wallet, { where: { userId } });
    if (!wallet) {
      wallet = new Wallet();
      wallet.userId = userId;
      wallet.balance = 0;
    }
    wallet.balance = Number(wallet.balance) + amount;
    await entityManager.save(Wallet, wallet);

    const payment = new Payment();
    payment.orderId = orderId;
    payment.userId = userId;
    payment.amount = amount;
    payment.method = method;
    payment.status = 'COMPLETED';
    payment.transactionReference = `REFUND_CREDIT_${Date.now()}`;
    await entityManager.save(Payment, payment);
  }
}
