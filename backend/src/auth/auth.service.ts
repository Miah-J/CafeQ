import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RedisService } from '../db/redis.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  async sendOtp(data: {
    email: string;
    phoneNumber: string;
    studentNumber: string;
  }) {
    // 1. Enforce Strathmore email domain
    if (
      !data.email.endsWith('@strathmore.edu') &&
      !data.email.endsWith('.strathmore.edu')
    ) {
      throw new BadRequestException(
        'Only Strathmore University email addresses are allowed.',
      );
    }

    // 2. Check if student or email is already registered
    const existingUser = await this.usersService.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('Email address is already registered.');
    }

    const existingStudent = await this.usersService.findStudentByNumber(
      data.studentNumber,
    );
    if (existingStudent) {
      throw new BadRequestException('Student number is already registered.');
    }

    // 3. Generate 6-digit OTP codes
    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const phoneOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Save to Redis with a 10 minute TTL (600 seconds)
    const redis = this.redisService.getClient();
    await redis.set(`email-otp:${data.email}`, emailOtp, 'EX', 600);
    await redis.set(`phone-otp:${data.phoneNumber}`, phoneOtp, 'EX', 600);

    // 5. Send OTPs
    const { previewUrl } = await this.emailService.sendVerificationEmail(
      data.email,
      emailOtp,
    );
    await this.smsService.sendSms(
      data.phoneNumber,
      `Your CafeQ phone verification code is: ${phoneOtp}. It expires in 10 minutes.`,
    );

    return {
      success: true,
      emailPreviewUrl: previewUrl,
    };
  }

  async registerStudent(data: {
    email: string;
    passwordRaw: string;
    fullName: string;
    phoneNumber: string;
    studentNumber: string;
    emailOtp: string;
    phoneOtp: string;
  }) {
    // 1. Enforce Strathmore email domain
    if (
      !data.email.endsWith('@strathmore.edu') &&
      !data.email.endsWith('.strathmore.edu')
    ) {
      throw new BadRequestException(
        'Only Strathmore University email addresses are allowed.',
      );
    }

    // 2. Validate OTPs against Redis
    const redis = this.redisService.getClient();
    const cachedEmailOtp = await redis.get(`email-otp:${data.email}`);
    const cachedPhoneOtp = await redis.get(`phone-otp:${data.phoneNumber}`);

    if (!cachedEmailOtp || cachedEmailOtp !== data.emailOtp) {
      throw new BadRequestException(
        'Invalid or expired email verification code.',
      );
    }

    if (!cachedPhoneOtp || cachedPhoneOtp !== data.phoneOtp) {
      throw new BadRequestException(
        'Invalid or expired phone verification code.',
      );
    }

    // 3. Create the user
    const passwordHash = await bcrypt.hash(data.passwordRaw, 10);
    const user = await this.usersService.createUser({
      email: data.email,
      passwordHash,
      role: 'Student',
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      studentNumber: data.studentNumber,
    });

    // 4. Clean up OTPs from Redis
    await redis.del(`email-otp:${data.email}`);
    await redis.del(`phone-otp:${data.phoneNumber}`);

    // 5. Auto-login: return jwt token and user info
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        studentNumber: user.studentNumber,
      },
    };
  }

  async provisionUser(data: {
    email: string;
    passwordRaw: string;
    fullName: string;
    role: string;
    phoneNumber?: string;
    department?: string;
    stationNumber?: string;
  }) {
    if (data.role === 'Student') {
      throw new BadRequestException('Use registration endpoint for Students');
    }
    const passwordHash = await bcrypt.hash(data.passwordRaw, 10);
    return this.usersService.createUser({
      email: data.email,
      passwordHash,
      role: data.role,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      department: data.department,
      stationNumber: data.stationNumber,
    });
  }

  async login(email: string, passwordRaw: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(passwordRaw, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        studentNumber: user.studentNumber,
        department: user.department,
        stationNumber: user.stationNumber,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const redis = this.redisService.getClient();

    await redis.set(`reset-token:${token}`, email, 'EX', 900);

    const { previewUrl } = await this.emailService.sendResetEmail(email, token);

    return {
      message: 'If the email exists, a reset link has been sent.',
      previewUrl,
    };
  }

  async resetPassword(token: string, passwordRaw: string) {
    const redis = this.redisService.getClient();
    const email = await redis.get(`reset-token:${token}`);

    if (!email) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await bcrypt.hash(passwordRaw, 10);
    await this.usersService.updatePassword(user.id, passwordHash);

    await redis.del(`reset-token:${token}`);

    return { message: 'Password reset successfully' };
  }
}
