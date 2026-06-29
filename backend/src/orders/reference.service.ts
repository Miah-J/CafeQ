import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferenceNumber } from './entities/reference-number.entity';
import { Order } from './entities/order.entity';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ReferenceService {
  private readonly logger = new Logger(ReferenceService.name);

  constructor(
    @InjectRepository(ReferenceNumber)
    private readonly referenceRepository: Repository<ReferenceNumber>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async generateReference(orderId: string): Promise<ReferenceNumber> {
    // Idempotency: check if a reference already exists for this order
    const existing = await this.referenceRepository.findOne({
      where: { orderId },
    });
    if (existing) {
      return existing;
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let attempts = 0;
    let code = '';

    while (attempts < 10) {
      const timestamp = Date.now().toString();
      const hash = crypto
        .createHash('sha256')
        .update(orderId + timestamp)
        .digest();
      code = '';
      for (let i = 0; i < 6; i++) {
        code += alphabet[hash[i] % alphabet.length];
      }

      // Check unique constraint in db
      const dup = await this.referenceRepository.findOne({
        where: { referenceCode: code },
      });
      if (!dup) {
        break;
      }
      attempts++;
    }

    const ref = new ReferenceNumber();
    ref.orderId = orderId;
    ref.referenceCode = code;

    return this.referenceRepository.save(ref);
  }

  async getReferenceByOrderId(
    orderId: string,
  ): Promise<ReferenceNumber | null> {
    return this.referenceRepository.findOne({ where: { orderId } });
  }

  async sendPaymentConfirmationSms(
    orderId: string,
    referenceCode: string,
  ): Promise<void> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });
      if (!order || !order.userId) {
        this.logger.warn(
          `Cannot send SMS: Order ${orderId} not found or has no userId.`,
        );
        return;
      }

      const user = await this.usersService.findById(order.userId);
      if (!user || !user.phoneNumber) {
        this.logger.warn(
          `User ${order.userId} has no phone number. SMS skipped.`,
        );
        return;
      }

      const formattedPhone = this.formatSmsPhone(user.phoneNumber);
      const message = `Dear Student, your payment for CafeQ Order #${referenceCode} is confirmed. Total amount: KES ${Number(order.totalAmount).toFixed(2)}. Thank you!`;

      await this.dispatchSmsViaGateway(formattedPhone, message);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send payment confirmation SMS: ${errMsg}`);
    }
  }

  private formatSmsPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return '+254' + cleaned.substring(1);
    }
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return '+' + cleaned;
    }
    if (cleaned.length === 9) {
      return '+254' + cleaned;
    }
    return '+' + cleaned;
  }

  private async dispatchSmsViaGateway(
    to: string,
    message: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('sms.apiKey');
    const senderId = this.configService.get<string>('sms.senderId') || 'CafeQ';
    const baseUrl = this.configService.get<string>('sms.baseUrl') || 'https://kenyasms.com/api/v1';
    const isSandbox = this.configService.get<boolean>('sms.sandbox') || apiKey?.startsWith('sandbox_');

    if (!apiKey) {
      this.logger.warn(
        `SMS gateway API key is missing. Simulating SMS to ${to}: "${message}"`,
      );
      return;
    }

    this.logger.log(
      `Dispatching SMS to ${to} via KenyaSMS Gateway (${senderId}): "${message}"`,
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };

    if (isSandbox) {
      headers['X-Sandbox-Mode'] = 'true';
    }

    const messageType = this.configService.get<string>('sms.messageType') || 'transactional';

    const res = await fetch(`${baseUrl}/sms/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sender_id: senderId,
        recipient: to,
        message: message,
        message_type: messageType,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `KenyaSMS API returned status ${res.status}: ${errorText}`,
      );
    }

    const data = (await res.json()) as Record<string, any>;
    if (data.success === false) {
      throw new Error(
        `KenyaSMS API error: ${data.error?.message || 'Unknown error'}`,
      );
    }

    this.logger.log(`SMS gateway response: ${JSON.stringify(data)}`);
  }
}
