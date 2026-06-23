/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { MenusService } from './menus.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Menu } from './entities/menu.entity';
import { Dish } from './entities/dish.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { RedisService } from '../db/redis.service';
import { BadRequestException } from '@nestjs/common';

describe('MenusService', () => {
  let service: MenusService;
  let menuRepoMock: any;
  let dishRepoMock: any;
  let orderItemRepoMock: any;
  let redisServiceMock: any;
  let redisClientMock: any;

  beforeEach(async () => {
    menuRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const executeMock = jest.fn().mockResolvedValue({ affected: 1 });
    const whereMock = jest.fn().mockImplementation(() => ({ execute: executeMock }));
    const setMock = jest.fn().mockImplementation(() => ({ where: whereMock }));
    const updateMock = jest.fn().mockImplementation(() => ({ set: setMock }));

    dishRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockImplementation(() => ({
        update: updateMock,
        set: setMock,
        where: whereMock,
        execute: executeMock,
      })),
    };

    orderItemRepoMock = {
      count: jest.fn(),
    };

    redisClientMock = {
      set: jest.fn(),
      get: jest.fn(),
      incrby: jest.fn(),
      decrby: jest.fn(),
      eval: jest.fn(),
      del: jest.fn(),
    };

    redisServiceMock = {
      getClient: jest.fn().mockReturnValue(redisClientMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        { provide: getRepositoryToken(Menu), useValue: menuRepoMock },
        { provide: getRepositoryToken(Dish), useValue: dishRepoMock },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepoMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    service = module.get<MenusService>(MenusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMenu', () => {
    it('should create a new draft menu successfully', async () => {
      menuRepoMock.findOne.mockResolvedValue(null);
      menuRepoMock.create.mockReturnValue({
        publishDate: '2026-06-12',
        isActive: false,
      });
      menuRepoMock.save.mockResolvedValue({
        id: 'menu-123',
        publishDate: '2026-06-12',
        isActive: false,
      });

      const result = await service.createMenu({ publishDate: '2026-06-12' });
      expect(result.id).toBe('menu-123');
      expect(menuRepoMock.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if menu for date already exists', async () => {
      menuRepoMock.findOne.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.createMenu({ publishDate: '2026-06-12' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addDish', () => {
    it('should add a dish to a draft menu', async () => {
      menuRepoMock.findOne.mockResolvedValue({
        id: 'menu-123',
        isActive: false,
      });
      dishRepoMock.create.mockReturnValue({ name: 'Pilau' });
      dishRepoMock.save.mockResolvedValue({ id: 'dish-123', name: 'Pilau' });

      const result = await service.addDish('menu-123', {
        name: 'Pilau',
        price: 150,
        preparedQuantity: 50,
      });

      expect(result.id).toBe('dish-123');
      expect(dishRepoMock.save).toHaveBeenCalled();
    });

    it('should add a dish to an active menu and set its availability in Redis', async () => {
      menuRepoMock.findOne.mockResolvedValue({
        id: 'menu-123',
        isActive: true,
      });
      dishRepoMock.create.mockReturnValue({ name: 'Pilau', preparedQuantity: 50 });
      dishRepoMock.save.mockResolvedValue({ id: 'dish-123', name: 'Pilau', preparedQuantity: 50 });

      const result = await service.addDish('menu-123', {
        name: 'Pilau',
        price: 150,
        preparedQuantity: 50,
      });

      expect(result.id).toBe('dish-123');
      expect(dishRepoMock.save).toHaveBeenCalled();
      expect(redisClientMock.set).toHaveBeenCalledWith(
        'dish:availability:dish-123',
        50,
      );
    });
  });

  describe('publishMenu', () => {
    it('should activate menu and load portion counts to Redis', async () => {
      const dishes = [
        { id: 'dish-1', name: 'Pilau', preparedQuantity: 50, isSoldOut: false },
        {
          id: 'dish-2',
          name: 'Beef Stew',
          preparedQuantity: 30,
          isSoldOut: false,
        },
      ];
      menuRepoMock.findOne.mockResolvedValue({
        id: 'menu-123',
        isActive: false,
        dishes,
      });
      menuRepoMock.save.mockResolvedValue({
        id: 'menu-123',
        isActive: true,
        dishes,
      });

      const result = await service.publishMenu('menu-123');

      expect(menuRepoMock.update).toHaveBeenCalledWith({}, { isActive: false });
      expect(redisClientMock.set).toHaveBeenCalledTimes(2);
      expect(redisClientMock.set).toHaveBeenNthCalledWith(
        1,
        'dish:availability:dish-1',
        50,
      );
      expect(redisClientMock.set).toHaveBeenNthCalledWith(
        2,
        'dish:availability:dish-2',
        30,
      );
      expect(result.isActive).toBe(true);
    });
  });

  describe('markDishSoldOut', () => {
    it('should set dish isSoldOut to true and set Redis portion to 0', async () => {
      dishRepoMock.findOne.mockResolvedValue({
        id: 'dish-123',
        name: 'Pilau',
        isSoldOut: false,
        menu: { isActive: true },
      });
      dishRepoMock.save.mockResolvedValue({
        id: 'dish-123',
        name: 'Pilau',
        isSoldOut: true,
      });

      const result = await service.markDishSoldOut('dish-123');

      expect(dishRepoMock.save).toHaveBeenCalled();
      expect(redisClientMock.set).toHaveBeenCalledWith(
        'dish:availability:dish-123',
        0,
      );
      expect(result.isSoldOut).toBe(true);
    });
  });

  describe('getActiveMenu', () => {
    it('should load active menu and fetch live quantities from Redis', async () => {
      const dishes = [
        {
          id: 'dish-1',
          name: 'Pilau',
          preparedQuantity: 50,
          isSoldOut: false,
          dietaryTags: ['Halal'],
        },
        {
          id: 'dish-2',
          name: 'Beef Stew',
          preparedQuantity: 30,
          isSoldOut: false,
          dietaryTags: ['None'],
        },
      ];
      menuRepoMock.findOne.mockResolvedValue({
        id: 'menu-123',
        isActive: true,
        dishes,
      });
      redisClientMock.get
        .mockResolvedValueOnce('45')
        .mockResolvedValueOnce(null);

      const result = await service.getActiveMenu();

      expect(result.id).toBe('menu-123');
      expect(result.dishes[0].liveQuantity).toBe(45);
      expect(result.dishes[1].liveQuantity).toBe(30);
      expect(redisClientMock.set).toHaveBeenCalledWith(
        'dish:availability:dish-2',
        30,
      );
    });

    it('should filter dishes by dietary tags in memory', async () => {
      const dishes = [
        {
          id: 'dish-1',
          name: 'Pilau',
          preparedQuantity: 50,
          isSoldOut: false,
          dietaryTags: ['Halal'],
        },
        {
          id: 'dish-2',
          name: 'Beef Stew',
          preparedQuantity: 30,
          isSoldOut: false,
          dietaryTags: ['None'],
        },
      ];
      menuRepoMock.findOne.mockResolvedValue({
        id: 'menu-123',
        isActive: true,
        dishes,
      });
      redisClientMock.get.mockResolvedValueOnce('45');

      const result = await service.getActiveMenu(['Halal']);

      expect(result.dishes.length).toBe(1);
      expect(result.dishes[0].id).toBe('dish-1');
    });
  });

  describe('reservePortions', () => {
    it('should atomically reserve portions using eval code', async () => {
      redisClientMock.eval.mockResolvedValue(40);

      const result = await service.reservePortions('dish-1', 10);
      expect(result).toBe(40);
      expect(redisClientMock.eval).toHaveBeenCalled();
    });

    it('should reload from DB and retry if Redis key does not exist', async () => {
      redisClientMock.eval.mockResolvedValueOnce(-1).mockResolvedValueOnce(35);

      dishRepoMock.findOne.mockResolvedValue({
        id: 'dish-1',
        name: 'Pilau',
        preparedQuantity: 50,
        isSoldOut: false,
        menu: { isActive: true },
      });

      const result = await service.reservePortions('dish-1', 15);
      expect(result).toBe(35);
      expect(redisClientMock.set).toHaveBeenCalledWith(
        'dish:availability:dish-1',
        50,
      );
    });

    it('should throw BadRequestException if portions are insufficient', async () => {
      redisClientMock.eval.mockResolvedValue(-2);
      dishRepoMock.findOne.mockResolvedValue({
        id: 'dish-1',
        name: 'Pilau',
      });

      await expect(service.reservePortions('dish-1', 100)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('releasePortions', () => {
    it('should release portions back to Redis', async () => {
      redisClientMock.incrby.mockResolvedValue(55);

      const result = await service.releasePortions('dish-1', 5);
      expect(result).toBe(55);
      expect(redisClientMock.incrby).toHaveBeenCalledWith(
        'dish:availability:dish-1',
        5,
      );
    });
  });

  describe('deleteDish', () => {
    it('should delete a dish successfully if it has no orders', async () => {
      dishRepoMock.findOne.mockResolvedValue({
        id: 'dish-123',
        menu: { isActive: true },
      });
      orderItemRepoMock.count.mockResolvedValue(0);

      const result = await service.deleteDish('dish-123');

      expect(orderItemRepoMock.count).toHaveBeenCalledWith({ where: { dishId: 'dish-123' } });
      expect(dishRepoMock.remove).toHaveBeenCalled();
      expect(redisClientMock.del).toHaveBeenCalledWith('dish:availability:dish-123');
      expect(result.message).toBe('Dish removed successfully');
    });

    it('should throw BadRequestException if the dish has already been ordered', async () => {
      dishRepoMock.findOne.mockResolvedValue({
        id: 'dish-123',
        menu: { isActive: true },
      });
      orderItemRepoMock.count.mockResolvedValue(5);

      await expect(service.deleteDish('dish-123')).rejects.toThrow(BadRequestException);
      expect(dishRepoMock.remove).not.toHaveBeenCalled();
    });
  });
});
