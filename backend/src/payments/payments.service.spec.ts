/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Wallet } from './entities/wallet.entity';
import { UsersService } from '../users/users.service';
import { MenusService } from '../menus/menus.service';
import { ConfigService } from '@nestjs/config';
import { ReferenceService } from '../orders/reference.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KitchenService } from '../kitchen/kitchen.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepoMock: any;
  let orderRepoMock: any;
  let walletRepoMock: any;
  let usersServiceMock: any;
  let menusServiceMock: any;
  let configServiceMock: any;
  let referenceServiceMock: any;
  let kitchenServiceMock: any;
  let loyaltyServiceMock: any;

  beforeEach(async () => {
    paymentRepoMock = {
      save: jest.fn((p) => Promise.resolve({ id: 'payment-id', ...p })),
      findOne: jest.fn(),
    };

    orderRepoMock = {
      findOne: jest.fn(),
      save: jest.fn((o) => Promise.resolve(o)),
    };

    walletRepoMock = {
      findOne: jest.fn(),
      save: jest.fn((w) => Promise.resolve({ id: 'wallet-id', ...w })),
    };

    usersServiceMock = {
      findById: jest.fn(),
    };

    menusServiceMock = {
      releasePortions: jest.fn(),
    };

    referenceServiceMock = {
      generateReference: jest.fn(() =>
        Promise.resolve({ referenceCode: 'MOCKRF' }),
      ),
      getReferenceByOrderId: jest.fn(() =>
        Promise.resolve({ referenceCode: 'MOCKRF' }),
      ),
      sendPaymentConfirmationSms: jest.fn(() => Promise.resolve()),
    };

    kitchenServiceMock = {
      triggerDishUpdate: jest.fn(),
    };

    loyaltyServiceMock = {
      restorePoints: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'mpesa.callbackUrl')
          return 'http://localhost:3001/payments/mpesa/callback';
        if (key === 'mpesa.passkey')
          return 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72dec1144c9f3';
        if (key === 'mpesa.shortcode') return '174379';
        if (key === 'mpesa.simulate') return true;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepoMock },
        { provide: getRepositoryToken(Order), useValue: orderRepoMock },
        { provide: getRepositoryToken(Wallet), useValue: walletRepoMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: MenusService, useValue: menusServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ReferenceService, useValue: referenceServiceMock },
        { provide: KitchenService, useValue: kitchenServiceMock },
        { provide: LoyaltyService, useValue: loyaltyServiceMock },
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
      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        status: 'CONFIRMED',
      });

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
              Item: [{ Name: 'MpesaReceiptNumber', Value: 'MPESA_REF_123' }],
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

      expect(menusServiceMock.releasePortions).toHaveBeenCalledWith(
        'dish-1',
        2,
      );
      expect(menusServiceMock.releasePortions).toHaveBeenCalledWith(
        'dish-2',
        1,
      );
    });
  });

  describe('wallet operations', () => {
    it('should retrieve wallet balance correctly', async () => {
      walletRepoMock.findOne.mockResolvedValue({
        id: 'wallet-123',
        userId: 'user-123',
        balance: 450.0,
      });

      const balance = await service.getWalletBalance('user-123');
      expect(balance).toBe(450.0);
    });

    it('should trigger wallet top-up successfully in mock mode', async () => {
      jest.useFakeTimers();

      usersServiceMock.findById.mockResolvedValue({
        id: 'user-123',
        phoneNumber: '0712345678',
      });

      const payment = await service.triggerWalletTopUp('user-123', 200);

      expect(payment.orderId).toBeNull();
      expect(payment.userId).toBe('user-123');
      expect(payment.amount).toBe(200);
      expect(payment.transactionReference).toContain('ws_CO_mock_topup_');

      jest.advanceTimersByTime(3000);
      jest.useRealTimers();
    });

    it('should process payment fully covered by wallet', async () => {
      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        status: 'PENDING',
        totalAmount: 150.0,
        items: [],
      });

      walletRepoMock.findOne.mockResolvedValue({
        id: 'wallet-123',
        userId: 'user-123',
        balance: 200.0,
      });

      const res = await service.processPayment(
        'user-123',
        'order-123',
        'WALLET',
        false,
      );
      expect(res.status).toBe('SUCCESS');
      expect(walletRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ balance: 50.0 }),
      );
    });

    it('should process split payment (wallet + MPESA)', async () => {
      jest.useFakeTimers();

      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        status: 'PENDING',
        totalAmount: 500.0,
        items: [],
      });

      walletRepoMock.findOne.mockResolvedValue({
        id: 'wallet-123',
        userId: 'user-123',
        balance: 200.0,
      });

      usersServiceMock.findById.mockResolvedValue({
        id: 'user-123',
        phoneNumber: '0712345678',
      });

      const res = await service.processPayment(
        'user-123',
        'order-123',
        'MPESA',
        true,
      );

      expect(res.status).toBe('PENDING');
      expect(res.remainder).toBe(300.0);

      // Verify wallet was emptied
      expect(walletRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ balance: 0.0 }),
      );

      // Verify WALLET payment record was created as COMPLETED
      expect(paymentRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'WALLET',
          amount: 200.0,
          status: 'COMPLETED',
        }),
      );

      // Verify MPESA remainder payment record was created as PENDING
      expect(paymentRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'MPESA',
          amount: 300.0,
          status: 'PENDING',
        }),
      );

      jest.useRealTimers();
    });
  });

  describe('handleCallback wallet interactions', () => {
    it('should credit wallet on successful top-up callback', async () => {
      const mockPayload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'checkout-topup-123',
            ResultCode: 0,
            ResultDesc: 'Success',
            CallbackMetadata: {
              Item: [{ Name: 'MpesaReceiptNumber', Value: 'MPESA_TOPUP_REF' }],
            },
          },
        },
      };

      paymentRepoMock.findOne.mockResolvedValue({
        id: 'payment-topup',
        orderId: null,
        userId: 'user-123',
        amount: 300.0,
        status: 'PENDING',
      });

      walletRepoMock.findOne.mockResolvedValue({
        id: 'wallet-123',
        userId: 'user-123',
        balance: 100.0,
      });

      await service.handleCallback(mockPayload);

      expect(walletRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ balance: 400.0 }),
      );
    });

    it('should refund wallet payment on failed remainder checkout callback', async () => {
      const mockPayload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: 'checkout-remainder-123',
            ResultCode: 1032,
            ResultDesc: 'Cancelled by user',
          },
        },
      };

      paymentRepoMock.findOne
        .mockResolvedValueOnce({
          id: 'payment-mpesa-remainder',
          orderId: 'order-123',
          userId: 'user-123',
          amount: 300.0,
          status: 'PENDING',
        })
        .mockResolvedValueOnce({
          id: 'payment-wallet-part',
          orderId: 'order-123',
          userId: 'user-123',
          amount: 200.0,
          method: 'WALLET',
          status: 'COMPLETED',
        });

      orderRepoMock.findOne.mockResolvedValue({
        id: 'order-123',
        status: 'PENDING',
        items: [],
      });

      walletRepoMock.findOne.mockResolvedValue({
        id: 'wallet-123',
        userId: 'user-123',
        balance: 0.0,
      });

      await service.handleCallback(mockPayload);

      expect(walletRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ balance: 200.0 }),
      );

      expect(paymentRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REFUNDED',
        }),
      );
    });
  });

  describe('getPaymentStatusByPaymentId', () => {
    it('should return payment status successfully if payment exists', async () => {
      paymentRepoMock.findOne.mockResolvedValue({
        id: 'payment-123',
        status: 'COMPLETED',
        transactionReference: 'REF-123',
      });

      const status = await service.getPaymentStatusByPaymentId('payment-123');
      expect(status).toEqual({
        status: 'COMPLETED',
        transactionReference: 'REF-123',
        referenceCode: null,
      });
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      paymentRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.getPaymentStatusByPaymentId('payment-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
