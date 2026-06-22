import { Test, TestingModule } from '@nestjs/testing';
import { KitchenService } from './kitchen.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Menu } from '../menus/entities/menu.entity';
import { Dish } from '../menus/entities/dish.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { KitchenGateway } from './kitchen.gateway';

describe('KitchenService', () => {
  let service: KitchenService;
  let menuRepoMock: any;
  let dishRepoMock: any;
  let orderItemRepoMock: any;
  let kitchenGatewayMock: any;

  // Mocking Query Builder for TypeORM
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };

  beforeEach(async () => {
    menuRepoMock = {
      findOne: jest.fn(),
    };
    dishRepoMock = {
      findOne: jest.fn(),
    };
    orderItemRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };
    kitchenGatewayMock = {
      emitDishUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitchenService,
        { provide: getRepositoryToken(Menu), useValue: menuRepoMock },
        { provide: getRepositoryToken(Dish), useValue: dishRepoMock },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepoMock },
        { provide: KitchenGateway, useValue: kitchenGatewayMock },
      ],
    }).compile();

    service = module.get<KitchenService>(KitchenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveMenuDishes', () => {
    it('should return empty list if no active menu', async () => {
      menuRepoMock.findOne.mockResolvedValue(null);
      const res = await service.getActiveMenuDishes();
      expect(res).toEqual([]);
    });

    it('should aggregate dish details and count confirmed quantities', async () => {
      const mockActiveMenu = {
        id: 'menu-1',
        dishes: [
          { id: 'dish-1', name: 'Pilau', preparedQuantity: 50, isSoldOut: false },
        ],
      };
      menuRepoMock.findOne.mockResolvedValue(mockActiveMenu);
      mockQueryBuilder.getRawOne.mockResolvedValue({ sum: '10' });

      const res = await service.getActiveMenuDishes();

      expect(res.length).toBe(1);
      expect(res[0].dishId).toBe('dish-1');
      expect(res[0].confirmedOrderCount).toBe(10);
      expect(res[0].isSoldOut).toBe(false);
    });
  });

  describe('triggerDishUpdate', () => {
    it('should fetch stats and emit websocket event', async () => {
      const mockDish = {
        id: 'dish-1',
        name: 'Pilau',
        preparedQuantity: 50,
        isSoldOut: false,
      };
      dishRepoMock.findOne.mockResolvedValue(mockDish);
      mockQueryBuilder.getRawOne.mockResolvedValue({ sum: '15' });

      await service.triggerDishUpdate('dish-1');

      expect(kitchenGatewayMock.emitDishUpdated).toHaveBeenCalledWith({
        dishId: 'dish-1',
        dish_id: 'dish-1',
        confirmedOrderCount: 15,
        confirmed_order_count: 15,
        preparedQuantity: 50,
        prepared_quantity: 50,
        isSoldOut: false,
        is_sold_out: false,
      });
    });
  });
});
