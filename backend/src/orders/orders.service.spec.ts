/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Dish } from '../menus/entities/dish.entity';
import { MenusService } from '../menus/menus.service';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepoMock: any;
  let orderItemRepoMock: any;
  let dishRepoMock: any;
  let menusServiceMock: any;
  let dataSourceMock: any;
  let managerMock: any;
  let queryRunnerMock: any;

  beforeEach(async () => {
    orderRepoMock = {
      findOne: jest.fn(),
    };
    orderItemRepoMock = {};
    dishRepoMock = {};
    menusServiceMock = {
      reservePortions: jest.fn(),
      releasePortions: jest.fn(),
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
        { provide: DataSource, useValue: dataSourceMock },
        { provide: MenusService, useValue: menusServiceMock },
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
});
