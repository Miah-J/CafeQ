import { Test, TestingModule } from '@nestjs/testing';
import { CollectionService } from './collection.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ReferenceNumber } from '../orders/entities/reference-number.entity';
import { Dish } from '../menus/entities/dish.entity';
import { UsersService } from '../users/users.service';
import { CollectionGateway } from './collection.gateway';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CollectionService', () => {
  let service: CollectionService;
  let orderRepoMock: any;
  let orderItemRepoMock: any;
  let referenceRepoMock: any;
  let dishRepoMock: any;
  let usersServiceMock: any;
  let collectionGatewayMock: any;
  let dataSourceMock: any;
  let managerMock: any;
  let queryRunnerMock: any;

  beforeEach(async () => {
    orderRepoMock = {
      findOne: jest.fn(),
    };
    orderItemRepoMock = {
      find: jest.fn(),
    };
    referenceRepoMock = {
      findOne: jest.fn(),
    };
    dishRepoMock = {
      find: jest.fn(),
    };
    usersServiceMock = {
      findById: jest.fn(),
    };
    collectionGatewayMock = {
      emitItemCollected: jest.fn(),
      emitOrderCompleted: jest.fn(),
    };

    managerMock = {
      findOne: jest.fn(),
      find: jest.fn(),
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
        CollectionService,
        { provide: getRepositoryToken(Order), useValue: orderRepoMock },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepoMock },
        {
          provide: getRepositoryToken(ReferenceNumber),
          useValue: referenceRepoMock,
        },
        { provide: getRepositoryToken(Dish), useValue: dishRepoMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: CollectionGateway, useValue: collectionGatewayMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('lookupOrder', () => {
    it('should throw NotFoundException if reference code not found', async () => {
      referenceRepoMock.findOne.mockResolvedValue(null);
      await expect(service.lookupOrder('NOTFND')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return order details and decrypt name if student exists', async () => {
      const mockRef = { orderId: 'order-123', referenceCode: 'REF123' };
      const mockOrder = {
        id: 'order-123',
        userId: 'student-123',
        status: 'CONFIRMED',
        createdAt: new Date(),
        items: [
          { id: 'item-1', dishId: 'dish-1', quantity: 2, unitPrice: 150.0, status: 'PENDING' },
        ],
      };
      const mockStudent = { fullName: 'Jane Doe', studentNumber: 'STR999' };
      const mockDish = { id: 'dish-1', name: 'Samosa' };

      referenceRepoMock.findOne.mockResolvedValue(mockRef);
      orderRepoMock.findOne.mockResolvedValue(mockOrder);
      usersServiceMock.findById.mockResolvedValue(mockStudent);
      dishRepoMock.find.mockResolvedValue([mockDish]);

      const res = await service.lookupOrder('REF123');

      expect(res.orderId).toBe('order-123');
      expect(res.studentName).toBe('Jane Doe');
      expect(res.items[0].dishName).toBe('Samosa');
      expect(res.items[0].status).toBe('PENDING');
    });

    it('should return Walk-In Customer for anonymous orders', async () => {
      const mockRef = { orderId: 'order-123', referenceCode: 'REF123' };
      const mockOrder = {
        id: 'order-123',
        userId: null,
        status: 'CONFIRMED',
        createdAt: new Date(),
        items: [
          { id: 'item-1', dishId: 'dish-1', quantity: 2, unitPrice: 150.0, status: 'PENDING' },
        ],
      };

      referenceRepoMock.findOne.mockResolvedValue(mockRef);
      orderRepoMock.findOne.mockResolvedValue(mockOrder);
      dishRepoMock.find.mockResolvedValue([]);

      const res = await service.lookupOrder('REF123');

      expect(res.orderId).toBe('order-123');
      expect(res.studentName).toBe('Walk-In Customer');
      expect(res.studentNumber).toBe('N/A');
    });
  });

  describe('collectOrderItem', () => {
    it('should throw BadRequestException if order status is not CONFIRMED/PARTIALLY_COLLECTED', async () => {
      const mockItem = {
        id: 'item-1',
        status: 'PENDING',
        order: { id: 'order-123', status: 'PENDING' },
      };
      managerMock.findOne.mockResolvedValue(mockItem);

      await expect(service.collectOrderItem('item-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('should mark item collected and auto-close order if all items collected', async () => {
      const mockItem = {
        id: 'item-1',
        status: 'PENDING',
        order: { id: 'order-123', status: 'CONFIRMED' },
      };
      managerMock.findOne.mockResolvedValue(mockItem);

      // Mock that all items are collected after save
      managerMock.find.mockResolvedValue([
        { id: 'item-1', status: 'COLLECTED' },
      ]);

      const result = await service.collectOrderItem('item-1');

      expect(result.itemStatus).toBe('COLLECTED');
      expect(result.orderStatus).toBe('COLLECTED');
      expect(managerMock.save).toHaveBeenCalledTimes(2); // saves item, saves order
      expect(collectionGatewayMock.emitItemCollected).toHaveBeenCalledWith(
        'order-123',
        'item-1',
        'COLLECTED',
      );
      expect(collectionGatewayMock.emitOrderCompleted).toHaveBeenCalledWith(
        'order-123',
        'COLLECTED',
      );
      expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    });

    it('should mark order PARTIALLY_COLLECTED if some items remain pending', async () => {
      const mockItem = {
        id: 'item-1',
        status: 'PENDING',
        order: { id: 'order-123', status: 'CONFIRMED' },
      };
      managerMock.findOne.mockResolvedValue(mockItem);

      // Mock some items collected, some pending
      managerMock.find.mockResolvedValue([
        { id: 'item-1', status: 'COLLECTED' },
        { id: 'item-2', status: 'PENDING' },
      ]);

      const result = await service.collectOrderItem('item-1');

      expect(result.itemStatus).toBe('COLLECTED');
      expect(result.orderStatus).toBe('PARTIALLY_COLLECTED');
      expect(collectionGatewayMock.emitItemCollected).toHaveBeenCalledWith(
        'order-123',
        'item-1',
        'COLLECTED',
      );
      expect(collectionGatewayMock.emitOrderCompleted).not.toHaveBeenCalled();
    });
  });
});
