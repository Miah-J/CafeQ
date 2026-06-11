/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { MenusService } from './menus.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Menu } from './entities/menu.entity';
import { Dish } from './entities/dish.entity';
import { RedisService } from '../db/redis.service';
import { BadRequestException } from '@nestjs/common';

describe('MenusService', () => {
  let service: MenusService;
  let menuRepoMock: any;
  let dishRepoMock: any;
  let redisServiceMock: any;
  let redisClientMock: any;

  beforeEach(async () => {
    menuRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    dishRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    redisClientMock = {
      set: jest.fn(),
      get: jest.fn(),
      incrby: jest.fn(),
      decrby: jest.fn(),
    };

    redisServiceMock = {
      getClient: jest.fn().mockReturnValue(redisClientMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        { provide: getRepositoryToken(Menu), useValue: menuRepoMock },
        { provide: getRepositoryToken(Dish), useValue: dishRepoMock },
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

    it('should throw BadRequestException if menu is already active', async () => {
      menuRepoMock.findOne.mockResolvedValue({
        id: 'menu-123',
        isActive: true,
      });

      await expect(
        service.addDish('menu-123', {
          name: 'Pilau',
          price: 150,
          preparedQuantity: 50,
        }),
      ).rejects.toThrow(BadRequestException);
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
  });
});
