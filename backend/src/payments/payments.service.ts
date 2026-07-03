import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment } from './entities/payment.entity';
import { Wallet } from './entities/wallet.entity';
import { Order } from '../orders/entities/order.entity';
import { ReferenceNumber } from '../orders/entities/reference-number.entity';
import { UsersService } from '../users/users.service';
import { MenusService } from '../menus/menus.service';
import { ReferenceService } from '../orders/reference.service';
import { KitchenService } from '../kitchen/kitchen.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

export interface MpesaCallbackItem {
  Name: string;
  Value?: string | number;
}

export interface MpesaCallbackMetadata {
  Item: MpesaCallbackItem[];
}

export interface MpesaStkCallback {
  MerchantRequestID?: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: MpesaCallbackMetadata;
}

export interface MpesaCallbackPayload {
  Body: {
    stkCallback: MpesaStkCallback;
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly menusService: MenusService,
    private readonly referenceService: ReferenceService,
    private readonly kitchenService: KitchenService,
    private readonly loyaltyService: LoyaltyService,
    private readonly dataSource: DataSource,
  ) { }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    }
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return cleaned;
    }
    if (cleaned.length === 9) {
      return '254' + cleaned;
    }
    throw new BadRequestException(
      `Invalid Kenyan phone number format: ${phone}. Standard formats: 07XXXXXXXX, 2547XXXXXXXX.`,
    );
  }

  private getMpesaTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }

  private isMockMode(): boolean {
    return this.configService.get<boolean>('mpesa.simulate') === true;
  }

  async getAccessToken(): Promise<string> {
    const consumerKey = this.configService.get<string>('mpesa.consumerKey');
    const consumerSecret = this.configService.get<string>(
      'mpesa.consumerSecret',
    );

    if (!consumerKey || !consumerSecret) {
      throw new BadRequestException(
        'M-Pesa API credentials are not configured',
      );
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      'base64',
    );

    const res = await this.fetchWithRetry(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Failed to fetch Daraja Access Token: ${errorText}`);
      throw new BadRequestException(
        'Failed to authenticate with M-Pesa Daraja API',
      );
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  async triggerStkPush(orderId: string, userId: string): Promise<Payment> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Order has already been processed with status: ${order.status}`,
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.phoneNumber) {
      throw new BadRequestException(
        'User does not have a registered phone number for M-Pesa push',
      );
    }

    const formattedPhone = this.formatPhoneNumber(user.phoneNumber);
    const amount = Number(order.totalAmount);

    // If callback is local, execute mock flow
    if (this.isMockMode()) {
      this.logger.warn(
        `Entering M-Pesa Local Simulation Mode for order: ${orderId}`,
      );
      const mockCheckoutId = `ws_CO_mock_${Date.now()}`;

      const payment = new Payment();
      payment.orderId = orderId;
      payment.userId = userId;
      payment.amount = amount;
      payment.method = 'MPESA';
      payment.status = 'PENDING';
      payment.transactionReference = mockCheckoutId;
      const savedPayment = await this.paymentRepository.save(payment);

      // Async trigger callback to succeed after 3 seconds
      setTimeout(() => {
        void this.handleCallback({
          Body: {
            stkCallback: {
              MerchantRequestID: 'mock-merchant-id',
              CheckoutRequestID: mockCheckoutId,
              ResultCode: 0,
              ResultDesc:
                'The service request is processed successfully (Mock)',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: amount },
                  {
                    Name: 'MpesaReceiptNumber',
                    Value: `MOCK${Date.now().toString().substring(5)}`,
                  },
                  { Name: 'PhoneNumber', Value: Number(formattedPhone) },
                ],
              },
            },
          },
        });
      }, 3000);

      return savedPayment;
    }

    // Live Safaricom Daraja STK Push path
    const token = await this.getAccessToken();
    const shortcode =
      this.configService.get<string>('mpesa.shortcode') || '174379';
    const passkey = this.configService.get<string>('mpesa.passkey');
    const callbackUrl = this.configService.get<string>('mpesa.callbackUrl');
    const timestamp = this.getMpesaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      'base64',
    );

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: orderId.substring(0, 12),
      TransactionDesc: `CafeQ Order ${orderId.substring(0, 6)}`,
    };

    const res = await this.fetchWithRetry(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Daraja STK Push Request Failed: ${errorText}`);
      throw new BadRequestException(
        'Failed to dispatch STK Push via Safaricom API',
      );
    }

    const data = (await res.json()) as { CheckoutRequestID: string };

    const payment = new Payment();
    payment.orderId = orderId;
    payment.userId = userId;
    payment.amount = amount;
    payment.method = 'MPESA';
    payment.status = 'PENDING';
    payment.transactionReference = data.CheckoutRequestID;

    return this.paymentRepository.save(payment);
  }

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletRepository.findOne({ where: { userId } });
    if (!wallet) {
      wallet = new Wallet();
      wallet.userId = userId;
      wallet.balance = 0.0;
      wallet = await this.walletRepository.save(wallet);
    }
    return wallet;
  }

  async getWalletBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(userId);
    return Number(wallet.balance);
  }

  async triggerWalletTopUp(userId: string, amount: number): Promise<Payment> {
    if (amount <= 0) {
      throw new BadRequestException('Top up amount must be greater than zero');
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.phoneNumber) {
      throw new BadRequestException(
        'User does not have a registered phone number for M-Pesa push',
      );
    }

    const formattedPhone = this.formatPhoneNumber(user.phoneNumber);

    // If callback is local, execute mock flow
    if (this.isMockMode()) {
      this.logger.warn(
        `Entering M-Pesa Local Simulation Mode for wallet top-up: user ${userId}`,
      );
      const mockCheckoutId = `ws_CO_mock_topup_${Date.now()}`;

      const payment = new Payment();
      payment.orderId = null;
      payment.userId = userId;
      payment.amount = amount;
      payment.method = 'MPESA';
      payment.status = 'PENDING';
      payment.transactionReference = mockCheckoutId;
      const savedPayment = await this.paymentRepository.save(payment);

      // Async trigger callback to succeed after 3 seconds
      setTimeout(() => {
        void this.handleCallback({
          Body: {
            stkCallback: {
              MerchantRequestID: 'mock-merchant-id',
              CheckoutRequestID: mockCheckoutId,
              ResultCode: 0,
              ResultDesc:
                'The service request is processed successfully (Mock Topup)',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: amount },
                  {
                    Name: 'MpesaReceiptNumber',
                    Value: `MOCKTOPUP${Date.now().toString().substring(5)}`,
                  },
                  { Name: 'PhoneNumber', Value: Number(formattedPhone) },
                ],
              },
            },
          },
        });
      }, 3000);

      return savedPayment;
    }

    // Live Safaricom Daraja STK Push path for Top-up
    const token = await this.getAccessToken();
    const shortcode =
      this.configService.get<string>('mpesa.shortcode') || '174379';
    const passkey = this.configService.get<string>('mpesa.passkey');
    const callbackUrl = this.configService.get<string>('mpesa.callbackUrl');
    const timestamp = this.getMpesaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      'base64',
    );

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: 'TOPUP',
      TransactionDesc: `CafeQ Wallet Topup for ${userId.substring(0, 6)}`,
    };

    const res = await this.fetchWithRetry(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Daraja STK Push Topup Failed: ${errorText}`);
      throw new BadRequestException(
        'Failed to dispatch STK Push via Safaricom API',
      );
    }

    const data = (await res.json()) as { CheckoutRequestID: string };

    const payment = new Payment();
    payment.orderId = null;
    payment.userId = userId;
    payment.amount = amount;
    payment.method = 'MPESA';
    payment.status = 'PENDING';
    payment.transactionReference = data.CheckoutRequestID;

    return this.paymentRepository.save(payment);
  }

  async processPayment(
    userId: string,
    orderId: string,
    method: 'MPESA' | 'WALLET',
    useWallet: boolean,
  ): Promise<{
    status: 'SUCCESS' | 'PENDING';
    remainder?: number;
    referenceCode?: string;
  }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException(
        `Order is already processed with status: ${order.status}`,
      );
    }

    const amount = Number(order.totalAmount);

    if (useWallet) {
      const wallet = await this.getOrCreateWallet(userId);
      const balance = Number(wallet.balance);

      if (balance >= amount) {
        // Fully covered by Wallet!
        wallet.balance = balance - amount;
        await this.walletRepository.save(wallet);

        const payment = new Payment();
        payment.orderId = orderId;
        payment.userId = userId;
        payment.amount = amount;
        payment.method = 'WALLET';
        payment.status = 'COMPLETED';
        payment.transactionReference = `WALLET_${Date.now()}`;
        await this.paymentRepository.save(payment);

        order.status = 'CONFIRMED';
        await this.orderRepository.save(order);

        // Generate reference and send SMS
        const ref = await this.referenceService.generateReference(orderId);
        void this.referenceService.sendPaymentConfirmationSms(
          orderId,
          ref.referenceCode,
        );

        // Trigger kitchen monitor updates
        if (order.items) {
          for (const item of order.items) {
            void this.kitchenService.triggerDishUpdate(item.dishId);
          }
        }

        return { status: 'SUCCESS', referenceCode: ref.referenceCode };
      } else if (balance > 0) {
        // Split Payment: Wallet covers 'balance', M-Pesa covers the remainder
        const remainder = amount - balance;

        // Deduct wallet completely
        wallet.balance = 0.0;
        await this.walletRepository.save(wallet);

        // Save wallet transaction log
        const walletPayment = new Payment();
        walletPayment.orderId = orderId;
        walletPayment.userId = userId;
        walletPayment.amount = balance;
        walletPayment.method = 'WALLET';
        walletPayment.status = 'COMPLETED';
        walletPayment.transactionReference = `SPLIT_WALLET_${Date.now()}`;
        await this.paymentRepository.save(walletPayment);

        // Trigger remainder payment via M-Pesa STK Push
        if (method !== 'MPESA') {
          throw new BadRequestException(
            'Remaining amount must be paid via MPESA',
          );
        }

        const user = await this.usersService.findById(userId);
        if (!user || !user.phoneNumber) {
          throw new BadRequestException(
            'User does not have a phone number for STK Push',
          );
        }
        const formattedPhone = this.formatPhoneNumber(user.phoneNumber);

        if (this.isMockMode()) {
          const mockCheckoutId = `ws_CO_mock_${Date.now()}`;
          const payment = new Payment();
          payment.orderId = orderId;
          payment.userId = userId;
          payment.amount = remainder;
          payment.method = 'MPESA';
          payment.status = 'PENDING';
          payment.transactionReference = mockCheckoutId;
          await this.paymentRepository.save(payment);

          setTimeout(() => {
            void this.handleCallback({
              Body: {
                stkCallback: {
                  MerchantRequestID: 'mock-merchant-id',
                  CheckoutRequestID: mockCheckoutId,
                  ResultCode: 0,
                  ResultDesc: 'Success (Mock Split)',
                  CallbackMetadata: {
                    Item: [
                      { Name: 'Amount', Value: remainder },
                      {
                        Name: 'MpesaReceiptNumber',
                        Value: `MOCK${Date.now().toString().substring(5)}`,
                      },
                      { Name: 'PhoneNumber', Value: Number(formattedPhone) },
                    ],
                  },
                },
              },
            });
          }, 3000);

          return { status: 'PENDING', remainder };
        }

        // Live path for remainder M-Pesa STK Push
        const token = await this.getAccessToken();
        const shortcode =
          this.configService.get<string>('mpesa.shortcode') || '174379';
        const passkey = this.configService.get<string>('mpesa.passkey');
        const callbackUrl = this.configService.get<string>('mpesa.callbackUrl');
        const timestamp = this.getMpesaTimestamp();
        const password = Buffer.from(
          `${shortcode}${passkey}${timestamp}`,
        ).toString('base64');

        const payload = {
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(remainder),
          PartyA: formattedPhone,
          PartyB: shortcode,
          PhoneNumber: formattedPhone,
          CallBackURL: callbackUrl,
          AccountReference: orderId.substring(0, 12),
          TransactionDesc: `CafeQ Order ${orderId.substring(0, 6)} Remainder`,
        };

        const res = await this.fetchWithRetry(
          'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );

        if (!res.ok) {
          const errorText = await res.text();
          this.logger.error(`Daraja Split STK Push Failed: ${errorText}`);
          throw new BadRequestException(
            'Failed to dispatch STK Push via Safaricom API',
          );
        }

        const data = (await res.json()) as { CheckoutRequestID: string };

        const mpesaPayment = new Payment();
        mpesaPayment.orderId = orderId;
        mpesaPayment.userId = userId;
        mpesaPayment.amount = remainder;
        mpesaPayment.method = 'MPESA';
        mpesaPayment.status = 'PENDING';
        mpesaPayment.transactionReference = data.CheckoutRequestID;
        await this.paymentRepository.save(mpesaPayment);

        return { status: 'PENDING', remainder };
      } else {
        // Wallet balance is 0 or less, process via M-Pesa full amount
        if (method !== 'MPESA') {
          throw new BadRequestException(
            'Wallet balance is 0. Please pay via MPESA.',
          );
        }
        await this.triggerStkPush(orderId, userId);
        return { status: 'PENDING' };
      }
    } else {
      // Direct payment method (no wallet applied)
      if (method === 'WALLET') {
        const wallet = await this.getOrCreateWallet(userId);
        const balance = Number(wallet.balance);
        if (balance < amount) {
          throw new BadRequestException('Insufficient wallet balance');
        }
        wallet.balance = balance - amount;
        await this.walletRepository.save(wallet);

        const payment = new Payment();
        payment.orderId = orderId;
        payment.userId = userId;
        payment.amount = amount;
        payment.method = 'WALLET';
        payment.status = 'COMPLETED';
        payment.transactionReference = `WALLET_${Date.now()}`;
        await this.paymentRepository.save(payment);

        order.status = 'CONFIRMED';
        await this.orderRepository.save(order);

        // Generate reference and send SMS
        const ref = await this.referenceService.generateReference(orderId);
        void this.referenceService.sendPaymentConfirmationSms(
          orderId,
          ref.referenceCode,
        );

        // Trigger kitchen monitor updates
        if (order.items) {
          for (const item of order.items) {
            void this.kitchenService.triggerDishUpdate(item.dishId);
          }
        }

        return { status: 'SUCCESS', referenceCode: ref.referenceCode };
      } else {
        await this.triggerStkPush(orderId, userId);
        return { status: 'PENDING' };
      }
    }
  }

  async completePayment(payment: Payment, receiptNumber: string): Promise<void> {
    payment.status = 'COMPLETED';
    payment.transactionReference = receiptNumber;
    await this.paymentRepository.save(payment);

    if (payment.orderId) {
      // Normal Checkout
      const order = await this.orderRepository.findOne({
        where: { id: payment.orderId },
        relations: { items: true },
      });

      if (order) {
        order.status = 'CONFIRMED';
        await this.orderRepository.save(order);
        this.logger.log(
          `Payment confirmed for Order ID ${order.id}. Reference: ${payment.transactionReference}`,
        );

        // Generate reference and send SMS
        const ref = await this.referenceService.generateReference(order.id);
        void this.referenceService.sendPaymentConfirmationSms(
          order.id,
          ref.referenceCode,
        );

        // Trigger kitchen monitor updates
        if (order.items) {
          for (const item of order.items) {
            void this.kitchenService.triggerDishUpdate(item.dishId);
          }
        }
      }
    } else if (payment.userId) {
      // Wallet Top-Up!
      const wallet = await this.getOrCreateWallet(payment.userId);
      wallet.balance = Number(wallet.balance) + Number(payment.amount);
      await this.walletRepository.save(wallet);
      this.logger.log(
        `Wallet top-up successful for User ID ${payment.userId}. Amount: ${payment.amount}. New balance: ${wallet.balance}`,
      );
    }
  }

  async failPayment(payment: Payment, reason: string): Promise<void> {
    payment.status = 'FAILED';
    payment.transactionReference = `FAILED_${reason.substring(0, 50)}`;
    await this.paymentRepository.save(payment);

    if (payment.orderId) {
      // Normal Checkout failure -> Rollback Redis portions and refund wallet part if split
      const order = await this.orderRepository.findOne({
        where: { id: payment.orderId },
        relations: { items: true },
      });

      if (order) {
        order.status = 'FAILED';
        await this.orderRepository.save(order);

        // Restore loyalty points if any were redeemed
        if (order.pointsRedeemed > 0 && order.userId) {
          try {
            await this.loyaltyService.restorePoints(
              order.userId,
              order.pointsRedeemed,
              order.id,
            );
            this.logger.log(
              `Loyalty points restored: ${order.pointsRedeemed} back to user ${order.userId}`,
            );
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to restore loyalty points: ${errMsg}`);
          }
        }

        // Rollback Redis Portions
        for (const item of order.items) {
          try {
            await this.menusService.releasePortions(
              item.dishId,
              item.quantity,
            );
            this.logger.log(
              `Portions released back to Redis: ${item.dishId} x${item.quantity}`,
            );
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to release portions: ${errMsg}`);
          }
        }

        // Refund split wallet payment if any exists
        const walletPayment = await this.paymentRepository.findOne({
          where: { orderId: order.id, method: 'WALLET', status: 'COMPLETED' },
        });

        if (walletPayment && payment.userId) {
          const wallet = await this.getOrCreateWallet(payment.userId);
          wallet.balance =
            Number(wallet.balance) + Number(walletPayment.amount);
          await this.walletRepository.save(wallet);

          walletPayment.status = 'REFUNDED';
          await this.paymentRepository.save(walletPayment);

          this.logger.log(
            `Split wallet payment refunded for Order ID ${order.id}. Refunded KES ${walletPayment.amount} back to User ID ${payment.userId}`,
          );
        }
      }
    }
  }

  async handleCallback(payload: MpesaCallbackPayload): Promise<void> {
    const stkCallback = payload?.Body?.stkCallback;
    if (!stkCallback) {
      this.logger.error('Invalid callback payload format');
      return;
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = Number(stkCallback.ResultCode);
    const resultDesc = stkCallback.ResultDesc;

    const payment = await this.paymentRepository.findOne({
      where: { transactionReference: checkoutRequestId },
    });

    if (!payment) {
      this.logger.error(
        `Payment not found for checkout request ID: ${checkoutRequestId}`,
      );
      return;
    }

    if (payment.status !== 'PENDING') {
      return;
    }

    if (resultCode === 0) {
      const items = stkCallback.CallbackMetadata?.Item || [];
      const receiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
      const receiptVal = receiptItem && receiptItem.Value !== undefined ? String(receiptItem.Value) : `MPESA_${checkoutRequestId}`;
      await this.completePayment(payment, receiptVal);
    } else {
      await this.failPayment(payment, resultDesc);
    }
  }

  async queryLiveMpesaStatus(payment: Payment): Promise<void> {
    if (this.isMockMode()) {
      return;
    }

    if (!payment.transactionReference || payment.transactionReference.startsWith('MOCK') || payment.transactionReference.startsWith('BYPASS')) {
      return;
    }

    try {
      const token = await this.getAccessToken();
      const shortcode = this.configService.get<string>('mpesa.shortcode') || '174379';
      const passkey = this.configService.get<string>('mpesa.passkey');
      const timestamp = this.getMpesaTimestamp();
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

      const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: payment.transactionReference,
      };

      const res = await this.fetchWithRetry(
        'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        const data = await res.json() as { ResultCode: string; ResultDesc: string };
        const resultCode = Number(data.ResultCode);
        const resultDesc = data.ResultDesc || '';

        if (resultCode === 0) {
          await this.completePayment(payment, `MPESA_${payment.transactionReference}`);
        } else if (resultDesc.toLowerCase().includes('processing')) {
          // Keep it PENDING since Safaricom is still processing the transaction
          this.logger.log(`M-Pesa payment ${payment.id} is still processing...`);
        } else if (resultCode !== 1032 && resultCode !== 0) {
          // If transaction is fully resolved and failed, fail the payment record
          await this.failPayment(payment, resultDesc);
        }
      }
    } catch (err) {
      this.logger.error(`Error querying live M-Pesa status for payment ${payment.id}: ${err}`);
    }
  }



  async getPaymentStatus(orderId: string): Promise<{
    status: string;
    transactionReference: string | null;
    referenceCode?: string | null;
  }> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException(
        `No payment logs found for order ID: ${orderId}`,
      );
    }

    if (payment.status === 'PENDING' && payment.method === 'MPESA') {
      await this.queryLiveMpesaStatus(payment);
    }

    const ref = await this.referenceService.getReferenceByOrderId(orderId);

    return {
      status: payment.status,
      transactionReference: payment.transactionReference,
      referenceCode: ref ? ref.referenceCode : null,
    };
  }

  async getPaymentStatusByPaymentId(paymentId: string): Promise<{
    status: string;
    transactionReference: string | null;
    referenceCode?: string | null;
  }> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(
        `No payment log found for payment ID: ${paymentId}`,
      );
    }

    if (payment.status === 'PENDING' && payment.method === 'MPESA') {
      await this.queryLiveMpesaStatus(payment);
    }

    const ref = payment.orderId
      ? await this.referenceService.getReferenceByOrderId(payment.orderId)
      : null;

    return {
      status: payment.status,
      transactionReference: payment.transactionReference,
      referenceCode: ref ? ref.referenceCode : null,
    };
  }

  async triggerB2cRefund(
    userId: string,
    amount: number,
    orderId: string,
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.phoneNumber) {
      return { success: false, error: 'User does not have a registered phone number' };
    }

    const formattedPhone = this.formatPhoneNumber(user.phoneNumber);

    if (this.isMockMode()) {
      this.logger.warn(`Entering M-Pesa B2C Refund Simulation for order: ${orderId}, amount: ${amount}`);
      const mockB2cReceipt = `B2C_MOCK_${Date.now()}`;
      return { success: true, transactionId: mockB2cReceipt };
    }

    try {
      const token = await this.getAccessToken();
      const b2cShortcode = this.configService.get<string>('mpesa.b2cShortcode') || '600192';
      const initiatorName = this.configService.get<string>('mpesa.initiatorName') || 'testapi';
      const securityCredential = this.configService.get<string>('mpesa.securityCredential') || 'mock_credential';
      const callbackUrl = this.configService.get<string>('mpesa.b2cCallbackUrl') || this.configService.get<string>('mpesa.callbackUrl');

      const payload = {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: Math.round(amount),
        PartyA: b2cShortcode,
        PartyB: formattedPhone,
        Remarks: `Refund for uncollected items in order ${orderId.substring(0, 8)}`,
        QueueTimeOutURL: callbackUrl,
        ResultURL: callbackUrl,
        Occasion: 'Refund',
      };

      const res = await this.fetchWithRetry(
        'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Daraja B2C Transfer Request Failed: ${errText}`);
        return { success: false, error: 'Daraja B2C request failed' };
      }

      const data = (await res.json()) as { ConversationID?: string; OriginatorConversationID?: string; ResponseCode?: string };
      if (data.ResponseCode === '0') {
        return { success: true, transactionId: data.ConversationID };
      } else {
        return { success: false, error: 'Daraja B2C rejected request' };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to execute B2C M-Pesa refund: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    delay = 2000,
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 30000); // 30s timeout per attempt
      
      // Add standard User-Agent to bypass Safaricom WAF / Incapsula challenges
      const headers = new Headers(options.headers);
      if (!headers.has('User-Agent')) {
        headers.set(
          'User-Agent',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        );
      }

      const res = await fetch(url, { 
        ...options, 
        headers,
        signal: controller.signal 
      });
      clearTimeout(id);

      if (!res.ok && retries > 0 && res.status >= 500) {
        this.logger.warn(
          `Retrying Daraja API request to ${url}. Attempts remaining: ${retries}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      return res;
    } catch (err) {
      if (retries > 0) {
        this.logger.warn(
          `Retrying Daraja API request to ${url} due to error: ${err}. Attempts remaining: ${retries}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
  }

  async getTransactionHistory(userId: string): Promise<any[]> {
    const payments = await this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const history = [];
    for (const payment of payments) {
      let orderCode: string | null = null;
      if (payment.orderId) {
        const refNum = await this.dataSource
          .getRepository(ReferenceNumber)
          .findOne({ where: { orderId: payment.orderId } });
        if (refNum) {
          orderCode = refNum.referenceCode;
        }
      }
      history.push({
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        transactionReference: payment.transactionReference,
        orderId: payment.orderId,
        orderCode,
        createdAt: payment.createdAt,
      });
    }
    return history;
  }
}
