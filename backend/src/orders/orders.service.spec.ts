/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Dish } from '../menus/entities/dish.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MenusService } from '../menus/menus.service';
import { UsersService } from '../users/users.service';
import { ReferenceService } from './reference.service';
import { PaymentsService } from '../payments/payments.service';
import { DataSource } from 'typeorm';
import { KitchenService } from '../kitchen/kitchen.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepoMock: any;
  let orderItemRepoMock: any;
  let dishRepoMock: any;
  let paymentRepoMock: any;
  let menusServiceMock: any;
  let usersServiceMock: any;
  let referenceServiceMock: any;
  let paymentsServiceMock: any;
  let dataSourceMock: any;
  let kitchenServiceMock: any;
  let managerMock: any;
  let queryRunnerMock: any;

  beforeEach(async () => {
    orderRepoMock = {
      findOne: jest.fn(),
    };
    orderItemRepoMock = {};
    dishRepoMock = {};
    paymentRepoMock = {
      save: jest.fn((p) => Promise.resolve({ id: 'pay-id', ...p })),
    };
    menusServiceMock = {
      reservePortions: jest.fn(),
      releasePortions: jest.fn(),
    };
    usersServiceMock = {
      findById: jest.fn(),
      findStudentByNumber: jest.fn(),
    };
    referenceServiceMock = {
      generateReference: jest.fn(() =>
        Promise.resolve({ referenceCode: 'ABC123' }),
      ),
      sendPaymentConfirmationSms: jest.fn(() => Promise.resolve()),
    };
    paymentsServiceMock = {
      triggerStkPush: jest.fn(() =>
        Promise.resolve({ id: 'mpesa-pay-id', status: 'PENDING' }),
      ),
    };

    kitchenServiceMock = {
      triggerDishUpdate: jest.fn(),
    };

    managerMock = {
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
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepoMock },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepoMock },
        { provide: getRepositoryToken(Dish), useValue: dishRepoMock },
        { provide: getRepositoryToken(Payment), useValue: paymentRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: MenusService, useValue: menusServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: ReferenceService, useValue: referenceServiceMock },
        { provide: PaymentsService, useValue: paymentsServiceMock },
        { provide: KitchenService, useValue: kitchenServiceMock },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    it('should place an order successfully and calculate total amount', async () => {
      // Mock finding dishes
      managerMock.findOne
        .mockResolvedValueOnce({ id: 'dish-1', name: 'Pilau', price: 150.0 })
        .mockResolvedValueOnce({
          id: 'dish-2',
          name: 'Beef Stew',
          price: 100.0,
        });

      // Mock portion lock success
      menusServiceMock.reservePortions.mockResolvedValue(true);

      // Mock saved order return
      const mockSavedOrder = {
        id: 'order-123',
        userId: 'user-123',
        totalAmount: 400.0, // (150 * 2) + (100 * 1)
        status: 'PENDING',
      };
      managerMock.save.mockResolvedValue(mockSavedOrder);

      const result = await service.createOrder('user-123', {
        items: [
          { dishId: 'dish-1', quantity: 2 },
          { dishId: 'dish-2', quantity: 1 },
        ],
      });

      expect(result.id).toBe('order-123');
      expect(result.totalAmount).toBe(400.0);
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('should release portions and rollback transaction on portion check failure', async () => {
      // Mock first dish succeeds, second fails portion check
      managerMock.findOne
        .mockResolvedValueOnce({ id: 'dish-1', name: 'Pilau', price: 150.0 })
        .mockResolvedValueOnce({
          id: 'dish-2',
          name: 'Beef Stew',
          price: 100.0,
        });

      menusServiceMock.reservePortions
        .mockResolvedValueOnce(true) // dish-1 succeeds
        .mockRejectedValueOnce(new Error('Out of stock')); // dish-2 fails

      await expect(
        service.createOrder('user-123', {
          items: [
            { dishId: 'dish-1', quantity: 2 },
            { dishId: 'dish-2', quantity: 10 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify releasePortions is called back for dish-1
      expect(menusServiceMock.releasePortions).toHaveBeenCalledWith(
        'dish-1',
        2,
      );
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('createCashierOrder', () => {
    it('should create a CASH order immediately with CONFIRMED status and reference code', async () => {
      usersServiceMock.findStudentByNumber.mockResolvedValue({
        id: 'student-123',
        fullName: 'John Doe',
        studentNumber: 'STR001',
        phoneNumber: '0712345678',
      });

      managerMock.findOne.mockResolvedValue({
        id: 'dish-1',
        name: 'Pilau',
        price: 200.0,
      });
      menusServiceMock.reservePortions.mockResolvedValue(true);

      const mockSavedOrder = {
        id: 'cashier-order-1',
        userId: 'student-123',
        totalAmount: 400.0,
        status: 'CONFIRMED',
      };
      managerMock.save.mockResolvedValue(mockSavedOrder);

      const result = await service.createCashierOrder({
        studentNumber: 'STR001',
        paymentMethod: 'CASH',
        items: [{ dishId: 'dish-1', quantity: 2 }],
      });

      expect(result.paymentStatus).toBe('SUCCESS');
      expect(result.referenceCode).toBe('ABC123');
      expect(referenceServiceMock.generateReference).toHaveBeenCalledWith(
        'cashier-order-1',
      );
      expect(
        referenceServiceMock.sendPaymentConfirmationSms,
      ).toHaveBeenCalledWith('cashier-order-1', 'ABC123');
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('should create an MPESA order with PENDING status and trigger STK push', async () => {
      usersServiceMock.findStudentByNumber.mockResolvedValue({
        id: 'student-123',
        fullName: 'Jane Doe',
        studentNumber: 'STR002',
        phoneNumber: '0712345678',
      });

      managerMock.findOne.mockResolvedValue({
        id: 'dish-1',
        name: 'Ugali',
        price: 100.0,
      });
      menusServiceMock.reservePortions.mockResolvedValue(true);

      const mockSavedOrder = {
        id: 'cashier-order-2',
        userId: 'student-123',
        totalAmount: 100.0,
        status: 'PENDING',
      };
      managerMock.save.mockResolvedValue(mockSavedOrder);

      const result = await service.createCashierOrder({
        studentNumber: 'STR002',
        paymentMethod: 'MPESA',
        items: [{ dishId: 'dish-1', quantity: 1 }],
      });

      expect(result.paymentStatus).toBe('PENDING');
      expect(result.referenceCode).toBeUndefined();
      expect(paymentsServiceMock.triggerStkPush).toHaveBeenCalledWith(
        'cashier-order-2',
        'student-123',
      );
    });

    it('should throw NotFoundException when student number is invalid', async () => {
      usersServiceMock.findStudentByNumber.mockResolvedValue(null);

      await expect(
        service.createCashierOrder({
          studentNumber: 'INVALID',
          paymentMethod: 'CASH',
          items: [{ dishId: 'dish-1', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for MPESA without student number', async () => {
      await expect(
        service.createCashierOrder({
          paymentMethod: 'MPESA',
          items: [{ dishId: 'dish-1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create anonymous CASH order without student number', async () => {
      managerMock.findOne.mockResolvedValue({
        id: 'dish-1',
        name: 'Chapati',
        price: 50.0,
      });
      menusServiceMock.reservePortions.mockResolvedValue(true);

      const mockSavedOrder = {
        id: 'anon-order-1',
        userId: null,
        totalAmount: 150.0,
        status: 'CONFIRMED',
      };
      managerMock.save.mockResolvedValue(mockSavedOrder);

      const result = await service.createCashierOrder({
        paymentMethod: 'CASH',
        items: [{ dishId: 'dish-1', quantity: 3 }],
      });

      expect(result.paymentStatus).toBe('SUCCESS');
      expect(result.referenceCode).toBe('ABC123');
      // SMS should NOT be dispatched for anonymous orders
      expect(
        referenceServiceMock.sendPaymentConfirmationSms,
      ).not.toHaveBeenCalled();
    });
  });
});
