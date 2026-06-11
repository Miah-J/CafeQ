/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { UsersService } from '../users/users.service';
import { MenusService } from '../menus/menus.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepoMock: any;
  let orderRepoMock: any;
  let usersServiceMock: any;
  let menusServiceMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    paymentRepoMock = {
      save: jest.fn((p) => Promise.resolve({ id: 'payment-id', ...p })),
      findOne: jest.fn(),
    };

    orderRepoMock = {
      findOne: jest.fn(),
      save: jest.fn((o) => Promise.resolve(o)),
    };

    usersServiceMock = {
      findById: jest.fn(),
    };

    menusServiceMock = {
      releasePortions: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'mpesa.callbackUrl') return 'http://localhost:3001/payments/mpesa/callback';
        if (key === 'mpesa.passkey') return 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72dec1144c9f3';
        if (key === 'mpesa.shortcode') return '174379';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepoMock },
        { provide: getRepositoryToken(Order), useValue: orderRepoMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: MenusService, useValue: menusServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('formatPhoneNumber', () => {
    it('should format 0712345678 to 254712345678', () => {
      const formatted = (service as any).formatPhoneNumber('0712345678');
      expect(formatted).toBe('254712345678');
    });

    it('should format 254712345678 directly', () => {
      const formatted = (service as any).formatPhoneNumber('254712345678');
      expect(formatted).toBe('254712345678');
    });

    it('should format 712345678 to 254712345678', () => {
      const formatted = (service as any).formatPhoneNumber('712345678');
      expect(formatted).toBe('254712345678');
    });

    it('should throw BadRequestException for invalid format', () => {
      expect(() => {
        (service as any).formatPhoneNumber('12345');
      }).toThrow(BadRequestException);
    });
  });

  describe('triggerStkPush', () => {
    it('should throw NotFoundException if order does not exist', async () => {
      orderRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.triggerStkPush('order-123', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order is not PENDING', async () => {
      orderRepoMock.findOne.mockResolvedValue({ id: 'order-123', status: 'CONFIRMED' });

      await expect(
        service.triggerStkPush('order-123', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should trigger mock STK push sequence successfully if mock mode is true', async () => {
      jest.useFakeTimers();

      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        status: 'PENDING',
        totalAmount: 350.0,
        items: [],
      });

      usersServiceMock.findById.mockResolvedValue({
        id: 'user-123',
        phoneNumber: '0712345678',
      });

      const payment = await service.triggerStkPush('order-123', 'user-123');

      expect(payment.status).toBe('PENDING');
      expect(payment.amount).toBe(350.0);
      expect(payment.transactionReference).toContain('ws_CO_mock_');
      expect(paymentRepoMock.save).toHaveBeenCalled();

      // Fast-forward 3 seconds to trigger callback simulation
      jest.advanceTimersByTime(3000);

      jest.useRealTimers();
    });
  });

  describe('handleCallback', () => {
    it('should update payment status to COMPLETED and order to CONFIRMED on ResultCode 0', async () => {
      const mockPayload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'checkout-123',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [
                { Name: 'MpesaReceiptNumber', Value: 'MPESA_REF_123' },
              ],
            },
          },
        },
      };

      paymentRepoMock.findOne.mockResolvedValue({
        id: 'payment-123',
        orderId: 'order-123',
        status: 'PENDING',
      });

      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        status: 'PENDING',
        items: [],
      });

      await service.handleCallback(mockPayload);

      expect(paymentRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'COMPLETED',
          transactionReference: 'MPESA_REF_123',
        }),
      );

      expect(orderRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CONFIRMED',
        }),
      );
    });

    it('should update payment and order to FAILED, and release portions on ResultCode non-zero', async () => {
      const mockPayload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'checkout-123',
            ResultCode: 1032,
            ResultDesc: 'Request cancelled by user',
          },
        },
      };

      paymentRepoMock.findOne.mockResolvedValue({
        id: 'payment-123',
        orderId: 'order-123',
        status: 'PENDING',
      });

      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        status: 'PENDING',
        items: [
          { dishId: 'dish-1', quantity: 2 },
          { dishId: 'dish-2', quantity: 1 },
        ],
      });

      await service.handleCallback(mockPayload);

      expect(paymentRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
        }),
      );

      expect(orderRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
        }),
      );

      expect(menusServiceMock.releasePortions).toHaveBeenCalledWith('dish-1', 2);
      expect(menusServiceMock.releasePortions).toHaveBeenCalledWith('dish-2', 1);
    });
  });
});
