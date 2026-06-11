import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  async onModuleInit() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(`Ethereal Mock SMTP initialized. User: ${testAccount.user}`);
    } catch (error) {
      this.logger.error('Failed to create mock SMTP transport', error);
    }
  }

  async sendResetEmail(email: string, token: string) {
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    
    this.logger.log(`[Email Mock] Sending reset email to ${email} with token: ${token}`);
    
    if (!this.transporter) {
      this.logger.warn(`SMTP transporter not initialized. Reset link: ${resetLink}`);
      return { previewUrl: null, resetLink };
    }

    const info = await this.transporter.sendMail({
      from: '"CafeQ Auth" <no-reply@cafeq.com>',
      to: email,
      subject: 'CafeQ Password Reset Request',
      text: `To reset your password, please click the following link: ${resetLink} (Expires in 15 minutes)`,
      html: `<p>To reset your password, please click the following link:</p>
             <p><a href="${resetLink}">${resetLink}</a></p>
             <p>This link will expire in 15 minutes.</p>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    this.logger.log(`[Email Mock] Email sent! Preview URL: ${previewUrl}`);
    return { previewUrl, resetLink };
  }
}
