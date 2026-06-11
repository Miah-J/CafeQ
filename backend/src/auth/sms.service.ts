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
      this.logger.error(`Failed to send SMS to ${to}: ${errMsg}`);
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
    const username =
      this.configService.get<string>('sms.username') || 'sandbox';

    if (!apiKey) {
      this.logger.warn(
        `SMS gateway API key is missing. Simulating SMS to ${to}: "${message}"`,
      );
      return;
    }

    const isSandbox = username.toLowerCase() === 'sandbox';
    const baseUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';

    const bodyParams = new URLSearchParams();
    bodyParams.append('username', username);
    bodyParams.append('to', to);
    bodyParams.append('message', message);

    this.logger.log(
      `Dispatching SMS to ${to} via Africa's Talking Gateway (${username})...`,
    );

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        apiKey: apiKey,
      },
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Africa's Talking API returned status ${res.status}: ${errorText}`,
      );
    }

    const data = (await res.json()) as Record<string, unknown>;
    this.logger.log(`SMS gateway response: ${JSON.stringify(data)}`);
  }
}
