/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
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
      this.logger.log(
        `Ethereal Mock SMTP initialized. User: ${testAccount.user}`,
      );
    } catch (error) {
      this.logger.error('Failed to create mock SMTP transport', error);
    }
  }

  async sendResetEmail(email: string, token: string) {
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;

    this.logger.log(
      `[Email Mock] Sending reset email to ${email} with token: ${token}`,
    );

    if (!this.transporter) {
      this.logger.warn(
        `SMTP transporter not initialized. Reset link: ${resetLink}`,
      );
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

  async sendVerificationEmail(email: string, code: string) {
    this.logger.log(
      `[Email Mock] Sending verification email to ${email} with code: ${code}`,
    );

    if (!this.transporter) {
      this.logger.warn(`SMTP transporter not initialized. Code: ${code}`);
      return { previewUrl: null };
    }

    const info = await this.transporter.sendMail({
      from: '"CafeQ Auth" <no-reply@cafeq.com>',
      to: email,
      subject: 'CafeQ Email Verification Code',
      text: `Your CafeQ verification code is: ${code} (Expires in 10 minutes)`,
      html: `<p>Your CafeQ verification code is:</p>
             <h2 style="font-size: 24px; letter-spacing: 2px; color: #7A1C1C;">${code}</h2>
             <p>This code will expire in 10 minutes.</p>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    this.logger.log(
      `[Email Mock] Verification email sent! Preview URL: ${previewUrl}`,
    );
    return { previewUrl };
  }
}
