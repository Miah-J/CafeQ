import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RedisService } from '../db/redis.service';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async registerStudent(data: {
    email: string;
    passwordRaw: string;
    fullName: string;
    phoneNumber?: string;
    studentNumber: string;
  }) {
    const passwordHash = await bcrypt.hash(data.passwordRaw, 10);
    return this.usersService.createUser({
      email: data.email,
      passwordHash,
      role: 'Student',
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      studentNumber: data.studentNumber,
    });
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
