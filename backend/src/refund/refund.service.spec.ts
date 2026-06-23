import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { PaymentsService } from '../payments/payments.service';
import { DataSource } from 'typeorm';
import { LoyaltyService } from '../loyalty/loyalty.service';

describe('RefundService', () => {
  let service: RefundService;
  let orderRepoMock: any;
  let orderItemRepoMock: any;
  let paymentRepoMock: any;
  let walletRepoMock: any;
  let paymentsServiceMock: any;
  let dataSourceMock: any;
  let managerMock: any;
  let queryRunnerMock: any;
  let loyaltyServiceMock: any;

  beforeEach(async () => {
    orderRepoMock = {
      find: jest.fn(),
    };
    orderItemRepoMock = {};
    paymentRepoMock = {};
    walletRepoMock = {};
    paymentsServiceMock = {
      triggerB2cRefund: jest.fn(),
      getOrCreateWallet: jest.fn(),
    };

    loyaltyServiceMock = {
      deductPointsForRefund: jest.fn(),
    };

    managerMock = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: managerMock,
    };

    dataSourceMock = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: getRepositoryToken(Order), useValue: orderRepoMock },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepoMock },
        { provide: getRepositoryToken(Payment), useValue: paymentRepoMock },
        { provide: getRepositoryToken(Wallet), useValue: walletRepoMock },
        { provide: PaymentsService, useValue: paymentsServiceMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: LoyaltyService, useValue: loyaltyServiceMock },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processUncollectedRefunds', () => {
    it('should skip orders with no uncollected items', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'CONFIRMED',
        items: [{ id: 'item-1', status: 'COLLECTED' }],
      };
      orderRepoMock.find.mockResolvedValue([mockOrder]);

      const result = await service.processUncollectedRefunds();

      expect(result.processedOrdersCount).toBe(0);
      expect(queryRunnerMock.connect).not.toHaveBeenCalled();
    });

    it('should process M-Pesa B2C refund for uncollected items and update order status', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'CONFIRMED',
        userId: 'student-123',
        items: [
          { id: 'item-1', status: 'PENDING', quantity: 2, unitPrice: 100.0, dishId: 'dish-1' },
        ],
      };
      orderRepoMock.find.mockResolvedValue([mockOrder]);

      const mockItems = [
        { id: 'item-1', status: 'PENDING', quantity: 2, unitPrice: 100.0, dishId: 'dish-1' },
      ];
      managerMock.find.mockImplementation((entity: any) => {
        if (entity === Payment) {
          return Promise.resolve([{ method: 'MPESA', status: 'COMPLETED' }]);
        }
        return Promise.resolve(mockItems);
      });

      managerMock.findOne.mockImplementation((entity: any) => {
        if (entity === Order) {
          return Promise.resolve(mockOrder);
        }
        if (entity === Wallet) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      // Mock successful B2C refund
      paymentsServiceMock.triggerB2cRefund.mockResolvedValue({
        success: true,
        transactionId: 'B2C123',
      });

      const result = await service.processUncollectedRefunds();

      expect(result.processedOrdersCount).toBe(1);
      expect(result.refundedItemsCount).toBe(1);
      expect(result.totalRefundedAmount).toBe(200.0);
      expect(paymentsServiceMock.triggerB2cRefund).toHaveBeenCalledWith(
        'student-123',
        200.0,
        'order-1',
      );
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('should fall back to wallet credit if B2C refund fails', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'CONFIRMED',
        userId: 'student-123',
        items: [
          { id: 'item-1', status: 'PENDING', quantity: 1, unitPrice: 150.0, dishId: 'dish-1' },
        ],
      };
      orderRepoMock.find.mockResolvedValue([mockOrder]);

      const mockItems = [
        { id: 'item-1', status: 'PENDING', quantity: 1, unitPrice: 150.0, dishId: 'dish-1' },
      ];
      managerMock.find.mockImplementation((entity: any) => {
        if (entity === Payment) {
          return Promise.resolve([{ method: 'MPESA', status: 'COMPLETED' }]);
        }
        return Promise.resolve(mockItems);
      });

      // Mock wallet entity return and B2C failure
      const mockWallet = { userId: 'student-123', balance: 0.0 };
      managerMock.findOne.mockImplementation((entity: any) => {
        if (entity === Order) {
          return Promise.resolve(mockOrder);
        }
        if (entity === Wallet) {
          return Promise.resolve(mockWallet);
        }
        return Promise.resolve(null);
      });

      paymentsServiceMock.triggerB2cRefund.mockResolvedValue({
        success: false,
        error: 'System busy',
      });

      const result = await service.processUncollectedRefunds();

      expect(result.processedOrdersCount).toBe(1);
      expect(paymentsServiceMock.triggerB2cRefund).toHaveBeenCalled();
      // Should save wallet with updated balance
      expect(managerMock.save).toHaveBeenCalledWith(Wallet, expect.objectContaining({
        balance: 150.0,
      }));
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('should credit wallet directly for WALLET/CASH payments', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'CONFIRMED',
        userId: 'student-123',
        items: [
          { id: 'item-1', status: 'PENDING', quantity: 1, unitPrice: 50.0, dishId: 'dish-1' },
        ],
      };
      orderRepoMock.find.mockResolvedValue([mockOrder]);

      managerMock.find
        .mockResolvedValueOnce([mockOrder.items[0]])
        .mockResolvedValueOnce([
          { id: 'item-1', status: 'REFUNDED' },
        ]);

      // Mock that payments table contains no MPESA payments (was paid via WALLET)
      managerMock.find.mockImplementation((entity: any) => {
        if (entity === Payment) {
          return Promise.resolve([{ method: 'WALLET', status: 'COMPLETED' }]);
        }
        return Promise.resolve([mockOrder.items[0]]);
      });

      const mockWallet = { userId: 'student-123', balance: 10.0 };
      managerMock.findOne.mockImplementation((entity: any) => {
        if (entity === Order) {
          return Promise.resolve(mockOrder);
        }
        if (entity === Wallet) {
          return Promise.resolve(mockWallet);
        }
        return Promise.resolve(null);
      });

      const result = await service.processUncollectedRefunds();

      expect(result.processedOrdersCount).toBe(1);
      expect(paymentsServiceMock.triggerB2cRefund).not.toHaveBeenCalled();
      expect(managerMock.save).toHaveBeenCalledWith(Wallet, expect.objectContaining({
        balance: 60.0,
      }));
    });
  });
});
