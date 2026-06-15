/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ReferenceService } from './reference.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReferenceNumber } from './entities/reference-number.entity';
import { Order } from './entities/order.entity';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('ReferenceService', () => {
  let service: ReferenceService;
  let referenceRepoMock: any;
  let orderRepoMock: any;
  let usersServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    referenceRepoMock = {
      findOne: jest.fn(),
      save: jest.fn((r) => Promise.resolve({ id: 'ref-id', ...r })),
    };

    orderRepoMock = {
      findOne: jest.fn(),
      save: jest.fn((o) => Promise.resolve(o)),
    };

    usersServiceMock = {
      findById: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'sms.apiKey') return 'mock-api-key';
        if (key === 'sms.username') return 'sandbox';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferenceService,
        {
          provide: getRepositoryToken(ReferenceNumber),
          useValue: referenceRepoMock,
        },
        { provide: getRepositoryToken(Order), useValue: orderRepoMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<ReferenceService>(ReferenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateReference', () => {
    it('should return existing reference if already generated', async () => {
      const existingRef = {
        id: 'ref-1',
        orderId: 'order-123',
        referenceCode: 'ABC123',
      };
      referenceRepoMock.findOne.mockResolvedValue(existingRef);

      const res = await service.generateReference('order-123');
      expect(res).toEqual(existingRef);
      expect(referenceRepoMock.save).not.toHaveBeenCalled();
    });

    it('should generate a 6-character alphanumeric reference code if none exists', async () => {
      referenceRepoMock.findOne.mockResolvedValue(null);

      const res = await service.generateReference('order-123');

      expect(res.orderId).toBe('order-123');
      expect(res.referenceCode).toHaveLength(6);
      expect(/^[A-Z0-9]{6}$/.test(res.referenceCode)).toBe(true);
      expect(referenceRepoMock.save).toHaveBeenCalled();
    });

    it('should retry generation up to 10 times on collision', async () => {
      referenceRepoMock.findOne
        .mockResolvedValueOnce(null) // first find for orderId
        .mockResolvedValueOnce({ id: 'collision' }) // first collision check
        .mockResolvedValueOnce({ id: 'collision' }) // second collision check
        .mockResolvedValueOnce(null); // third checks is fine

      const res = await service.generateReference('order-123');
      expect(res.referenceCode).toHaveLength(6);
      expect(referenceRepoMock.save).toHaveBeenCalled();
    });
  });

  describe('formatSmsPhone', () => {
    it('should format 0712345678 to +254712345678', () => {
      const formatted = (service as any).formatSmsPhone('0712345678');
      expect(formatted).toBe('+254712345678');
    });

    it('should format 254712345678 to +254712345678', () => {
      const formatted = (service as any).formatSmsPhone('254712345678');
      expect(formatted).toBe('+254712345678');
    });

    it('should format 712345678 to +254712345678', () => {
      const formatted = (service as any).formatSmsPhone('712345678');
      expect(formatted).toBe('+254712345678');
    });
  });

  describe('sendPaymentConfirmationSms', () => {
    it('should log warning if order not found', async () => {
      orderRepoMock.findOne.mockResolvedValue(null);
      const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

      await service.sendPaymentConfirmationSms('order-123', 'REF123');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Order order-123 not found'),
      );
    });

    it('should log warning if user has no phone number', async () => {
      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
      });
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-123',
        phoneNumber: null,
      });
      const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

      await service.sendPaymentConfirmationSms('order-123', 'REF123');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('has no phone number'),
      );
    });

    it("should call fetch to dispatch SMS via Africa's Talking Sandbox", async () => {
      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        totalAmount: 450.0,
      });
      usersServiceMock.findById.mockResolvedValue({
        id: 'user-123',
        phoneNumber: '0712345678',
      });

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'Success' }),
      });
      global.fetch = fetchMock;

      await service.sendPaymentConfirmationSms('order-123', 'REF123');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.sandbox.africastalking.com/version1/messaging',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            apiKey: 'mock-api-key',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('to=%2B254712345678'),
        }),
      );
    });
  });
});
