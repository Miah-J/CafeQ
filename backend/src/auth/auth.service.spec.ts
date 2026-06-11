/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../db/redis.service';
import { EmailService } from './email.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersServiceMock: any;
  let jwtServiceMock: any;
  let redisServiceMock: any;
  let emailServiceMock: any;
  let redisClientMock: any;

  beforeEach(async () => {
    usersServiceMock = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      updatePassword: jest.fn(),
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    redisClientMock = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    redisServiceMock = {
      getClient: jest.fn().mockReturnValue(redisClientMock),
    };

    emailServiceMock = {
      sendResetEmail: jest
        .fn()
        .mockResolvedValue({ previewUrl: 'http://ethereal/preview' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerStudent', () => {
    it('should register a student successfully', async () => {
      usersServiceMock.createUser.mockResolvedValue({ id: 'uuid-123' });

      const result = await service.registerStudent({
        email: 'student@strathmore.edu',
        passwordRaw: 'password123',
        fullName: 'Jane Student',
        studentNumber: 'SU-99999',
      });

      expect(usersServiceMock.createUser).toHaveBeenCalled();
      expect(result.id).toBe('uuid-123');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secret123', 10);
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'uuid-123',
        email: 'student@strathmore.edu',
        passwordHash,
        role: 'Student',
        fullName: 'Jane Student',
      });

      const result = await service.login('student@strathmore.edu', 'secret123');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.role).toBe('Student');
    });

    it('should throw UnauthorizedException with invalid password', async () => {
      const passwordHash = await bcrypt.hash('secret123', 10);
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'uuid-123',
        email: 'student@strathmore.edu',
        passwordHash,
        role: 'Student',
      });

      await expect(
        service.login('student@strathmore.edu', 'wrong_password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should store reset token in Redis and send email', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'uuid-123',
        email: 'student@strathmore.edu',
      });

      const result = await service.forgotPassword('student@strathmore.edu');

      expect(redisClientMock.set).toHaveBeenCalled();
      expect(emailServiceMock.sendResetEmail).toHaveBeenCalled();
      expect(result.previewUrl).toBe('http://ethereal/preview');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      redisClientMock.get.mockResolvedValue('student@strathmore.edu');
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 'uuid-123',
        email: 'student@strathmore.edu',
      });

      const result = await service.resetPassword(
        'valid_token',
        'new_password123',
      );

      expect(usersServiceMock.updatePassword).toHaveBeenCalled();
      expect(redisClientMock.del).toHaveBeenCalledWith(
        'reset-token:valid_token',
      );
      expect(result.message).toBe('Password reset successfully');
    });

    it('should throw BadRequestException with invalid token', async () => {
      redisClientMock.get.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid_token', 'new_password123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
