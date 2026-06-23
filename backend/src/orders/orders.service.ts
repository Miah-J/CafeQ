import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto, CreateCashierOrderDto } from './dto/orders.dto';
import { MenusService } from '../menus/menus.service';
import { Dish } from '../menus/entities/dish.entity';
import { Payment } from '../payments/entities/payment.entity';
import { UsersService } from '../users/users.service';
import { ReferenceService } from './reference.service';
import { PaymentsService } from '../payments/payments.service';
import { KitchenService } from '../kitchen/kitchen.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly menusService: MenusService,
    private readonly usersService: UsersService,
    private readonly referenceService: ReferenceService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly kitchenService: KitchenService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  async createOrder(
    userId: string | null,
    dto: CreateOrderDto,
  ): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const reservedPortions: Array<{ dishId: string; quantity: number }> = [];

    try {
      let totalAmount = 0;
      const orderItemsToSave: OrderItem[] = [];

      const dbOrder = new Order();
      dbOrder.userId = userId;
      dbOrder.status = 'PENDING';
      dbOrder.totalAmount = 0;

      for (const item of dto.items) {
        const dish = await queryRunner.manager.findOne(Dish, {
          where: { id: item.dishId },
        });
        if (!dish) {
          throw new NotFoundException(`Dish with ID ${item.dishId} not found`);
        }

        try {
          await this.menusService.reservePortions(item.dishId, item.quantity);
          reservedPortions.push({
            dishId: item.dishId,
            quantity: item.quantity,
          });
        } catch (error: any) {
          throw new BadRequestException(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            error.message ||
              `Insufficient portion availability for dish: ${dish.name}`,
          );
        }

        const unitPrice = Number(dish.price);
        totalAmount += unitPrice * item.quantity;

        const dbItem = new OrderItem();
        dbItem.dishId = item.dishId;
        dbItem.quantity = item.quantity;
        dbItem.unitPrice = unitPrice;
        dbItem.status = 'PENDING';
        dbItem.order = dbOrder;

        orderItemsToSave.push(dbItem);
      }

      dbOrder.totalAmount = totalAmount;
      dbOrder.items = orderItemsToSave;

      let pointsToRedeem = 0;
      if (dto.pointsToRedeem && dto.pointsToRedeem > 0) {
        if (!userId) {
          throw new BadRequestException('Anonymous users cannot redeem loyalty points');
        }
        await this.loyaltyService.checkRedemptionEligibility(
          userId,
          dto.pointsToRedeem,
          totalAmount,
          queryRunner.manager,
        );
        pointsToRedeem = dto.pointsToRedeem;
      }

      dbOrder.pointsRedeemed = pointsToRedeem;
      dbOrder.totalAmount = totalAmount - pointsToRedeem;

      const savedOrder = await queryRunner.manager.save(Order, dbOrder);

      if (pointsToRedeem > 0 && userId) {
        await this.loyaltyService.redeemPoints(
          userId,
          pointsToRedeem,
          savedOrder.id,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();

      if (savedOrder.items) {
        savedOrder.items.forEach((item) => {
          delete (item as Partial<OrderItem>).order;
        });
      }

      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();

      for (const res of reservedPortions) {
        await this.menusService.releasePortions(res.dishId, res.quantity);
      }

      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createCashierOrder(dto: CreateCashierOrderDto): Promise<{
    order: Order;
    referenceCode?: string;
    paymentStatus: 'SUCCESS' | 'PENDING';
  }> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // If MPESA is selected, a student number is mandatory (need a phone number)
    if (dto.paymentMethod === 'MPESA' && !dto.studentNumber) {
      throw new BadRequestException(
        'Student number is required for M-Pesa payments so we can send the STK push to their phone.',
      );
    }

    // Resolve student if provided
    let studentUserId: string | null = null;
    if (dto.studentNumber) {
      const student = await this.usersService.findStudentByNumber(
        dto.studentNumber,
      );
      if (!student) {
        throw new NotFoundException(
          `Student with number ${dto.studentNumber} not found`,
        );
      }
      studentUserId = student.id;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const reservedPortions: Array<{ dishId: string; quantity: number }> = [];

    try {
      let totalAmount = 0;
      const orderItemsToSave: OrderItem[] = [];

      const dbOrder = new Order();
      dbOrder.userId = studentUserId;
      dbOrder.status = dto.paymentMethod === 'CASH' ? 'CONFIRMED' : 'PENDING';
      dbOrder.totalAmount = 0;

      for (const item of dto.items) {
        const dish = await queryRunner.manager.findOne(Dish, {
          where: { id: item.dishId },
        });
        if (!dish) {
          throw new NotFoundException(`Dish with ID ${item.dishId} not found`);
        }

        try {
          await this.menusService.reservePortions(item.dishId, item.quantity);
          reservedPortions.push({
            dishId: item.dishId,
            quantity: item.quantity,
          });
        } catch (error: any) {
          throw new BadRequestException(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            error.message ||
              `Insufficient portion availability for dish: ${dish.name}`,
          );
        }

        const unitPrice = Number(dish.price);
        totalAmount += unitPrice * item.quantity;

        const dbItem = new OrderItem();
        dbItem.dishId = item.dishId;
        dbItem.quantity = item.quantity;
        dbItem.unitPrice = unitPrice;
        dbItem.status = 'PENDING';
        dbItem.order = dbOrder;

        orderItemsToSave.push(dbItem);
      }

      dbOrder.totalAmount = totalAmount;
      dbOrder.items = orderItemsToSave;

      const savedOrder = await queryRunner.manager.save(Order, dbOrder);

      if (dto.paymentMethod === 'CASH') {
        // Record CASH payment as COMPLETED immediately
        const payment = new Payment();
        payment.orderId = savedOrder.id;
        payment.userId = studentUserId;
        payment.amount = totalAmount;
        payment.method = 'CASH';
        payment.status = 'COMPLETED';
        payment.transactionReference = `CASH_${Date.now()}`;
        await queryRunner.manager.save(Payment, payment);
      }

      await queryRunner.commitTransaction();

      if (savedOrder.items) {
        savedOrder.items.forEach((item) => {
          delete (item as Partial<OrderItem>).order;
        });
      }

      // Post-commit actions for CASH: generate reference + SMS
      if (dto.paymentMethod === 'CASH') {
        const ref = await this.referenceService.generateReference(
          savedOrder.id,
        );
        if (studentUserId) {
          void this.referenceService.sendPaymentConfirmationSms(
            savedOrder.id,
            ref.referenceCode,
          );
        }

        // Trigger kitchen updates
        if (savedOrder.items) {
          for (const item of savedOrder.items) {
            void this.kitchenService.triggerDishUpdate(item.dishId);
          }
        }

        return {
          order: savedOrder,
          referenceCode: ref.referenceCode,
          paymentStatus: 'SUCCESS',
        };
      }

      // MPESA: trigger STK push to the student's phone
      if (dto.paymentMethod === 'MPESA' && studentUserId) {
        await this.paymentsService.triggerStkPush(savedOrder.id, studentUserId);
        return {
          order: savedOrder,
          paymentStatus: 'PENDING',
        };
      }

      return { order: savedOrder, paymentStatus: 'SUCCESS' };
    } catch (err) {
      await queryRunner.rollbackTransaction();

      for (const res of reservedPortions) {
        await this.menusService.releasePortions(res.dishId, res.quantity);
      }

      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return order;
  }
}
