import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { UsersService } from '../users/users.service';
import { MenusService } from '../menus/menus.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly menusService: MenusService,
  ) {}

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
    const callbackUrl = this.configService.get<string>('mpesa.callbackUrl') || '';
    const passkey = this.configService.get<string>('mpesa.passkey') || '';
    return (
      callbackUrl.includes('localhost') ||
      callbackUrl.includes('127.0.0.1') ||
      passkey.includes('your_daraja_passkey_here')
    );
  }

  async getAccessToken(): Promise<string> {
    const consumerKey = this.configService.get<string>('mpesa.consumerKey');
    const consumerSecret = this.configService.get<string>('mpesa.consumerSecret');

    if (!consumerKey || !consumerSecret) {
      throw new BadRequestException('M-Pesa API credentials are not configured');
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

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
      throw new BadRequestException('Failed to authenticate with M-Pesa Daraja API');
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
      throw new BadRequestException(`Order has already been processed with status: ${order.status}`);
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.phoneNumber) {
      throw new BadRequestException('User does not have a registered phone number for M-Pesa push');
    }

    const formattedPhone = this.formatPhoneNumber(user.phoneNumber);
    const amount = Number(order.totalAmount);

    // If callback is local, execute mock flow
    if (this.isMockMode()) {
      this.logger.warn(`Entering M-Pesa Local Simulation Mode for order: ${orderId}`);
      const mockCheckoutId = `ws_CO_mock_${Date.now()}`;
      
      const payment = new Payment();
      payment.orderId = orderId;
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
              ResultDesc: 'The service request is processed successfully (Mock)',
              CallbackMetadata: {
                Item: [
                  { Name: 'Amount', Value: amount },
                  { Name: 'MpesaReceiptNumber', Value: `MOCK${Date.now().toString().substring(5)}` },
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
    const shortcode = this.configService.get<string>('mpesa.shortcode') || '174379';
    const passkey = this.configService.get<string>('mpesa.passkey');
    const callbackUrl = this.configService.get<string>('mpesa.callbackUrl');
    const timestamp = this.getMpesaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

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
      throw new BadRequestException('Failed to dispatch STK Push via Safaricom API');
    }

    const data = (await res.json()) as { CheckoutRequestID: string };

    const payment = new Payment();
    payment.orderId = orderId;
    payment.amount = amount;
    payment.method = 'MPESA';
    payment.status = 'PENDING';
    payment.transactionReference = data.CheckoutRequestID;

    return this.paymentRepository.save(payment);
  }

  async handleCallback(payload: any): Promise<void> {
    const stkCallback = payload?.Body?.stkCallback;
    if (!stkCallback) {
      this.logger.error('Invalid callback payload format');
      return;
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID as string;
    const resultCode = Number(stkCallback.ResultCode);
    const resultDesc = stkCallback.ResultDesc as string;

    const payment = await this.paymentRepository.findOne({
      where: { transactionReference: checkoutRequestId },
    });

    if (!payment) {
      this.logger.error(`Payment not found for checkout request ID: ${checkoutRequestId}`);
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: payment.orderId },
      relations: { items: true },
    });

    if (!order) {
      this.logger.error(`Order not found for payment ID: ${payment.id}`);
      return;
    }

    if (resultCode === 0) {
      // Payment Successful
      payment.status = 'COMPLETED';

      // Retrieve receipt number from callback metadata
      const items = stkCallback.CallbackMetadata?.Item || [];
      const receiptItem = items.find((i: any) => i.Name === 'MpesaReceiptNumber');
      if (receiptItem && receiptItem.Value) {
        payment.transactionReference = receiptItem.Value as string;
      }

      await this.paymentRepository.save(payment);

      order.status = 'CONFIRMED';
      await this.orderRepository.save(order);

      this.logger.log(`Payment confirmed for Order ID ${order.id}. Reference: ${payment.transactionReference}`);
    } else {
      // Payment Failed
      payment.status = 'FAILED';
      payment.transactionReference = `FAILED_${resultDesc.substring(0, 50)}`;
      await this.paymentRepository.save(payment);

      order.status = 'FAILED';
      await this.orderRepository.save(order);

      // Rollback Redis Portions
      for (const item of order.items) {
        try {
          await this.menusService.releasePortions(item.dishId, item.quantity);
          this.logger.log(`Portions released back to Redis: ${item.dishId} x${item.quantity}`);
        } catch (err: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          this.logger.error(`Failed to release portions: ${err.message || err}`);
        }
      }

      this.logger.warn(`Payment failed for Order ID ${order.id}. Code: ${resultCode}. Desc: ${resultDesc}`);
    }
  }

  async getPaymentStatus(orderId: string): Promise<{ status: string; transactionReference: string | null }> {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException(`No payment logs found for order ID: ${orderId}`);
    }

    return {
      status: payment.status,
      transactionReference: payment.transactionReference,
    };
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
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);

      if (!res.ok && retries > 0 && res.status >= 500) {
        this.logger.warn(`Retrying Daraja API request to ${url}. Attempts remaining: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      return res;
    } catch (err) {
      if (retries > 0) {
        this.logger.warn(`Retrying Daraja API request to ${url} due to error: ${err}. Attempts remaining: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
  }
}
