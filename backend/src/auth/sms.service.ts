import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendSms(to: string, message: string): Promise<void> {
    try {
      const formattedPhone = this.formatSmsPhone(to);
      await this.dispatchSmsViaGateway(formattedPhone, message);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const causeMsg = (err instanceof Error && err.cause) ? ` | Cause: ${err.cause instanceof Error ? err.cause.message : String(err.cause)}` : '';
      this.logger.error(`Failed to send SMS to ${to}: ${errMsg}${causeMsg}`);
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
