import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from '../menus/entities/menu.entity';
import { Dish } from '../menus/entities/dish.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { KitchenGateway } from './kitchen.gateway';

@Injectable()
export class KitchenService {
  private readonly logger = new Logger(KitchenService.name);

  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly kitchenGateway: KitchenGateway,
  ) {}

  async getActiveMenuDishes() {
    const activeMenu = await this.menuRepository.findOne({
      where: { isActive: true },
      relations: { dishes: true },
    });

    if (!activeMenu) {
      return [];
    }

    const dishesWithStats = [];
    for (const dish of activeMenu.dishes) {
      const count = await this.getConfirmedOrderCount(dish.id);
      dishesWithStats.push({
        dishId: dish.id,
        name: dish.name,
        description: dish.description,
        preparedQuantity: dish.preparedQuantity,
        confirmedOrderCount: count,
        isSoldOut: dish.isSoldOut || count >= dish.preparedQuantity,
      });
    }

    return dishesWithStats;
  }

  async getConfirmedOrderCount(dishId: string): Promise<number> {
    const result = await this.orderItemRepository
      .createQueryBuilder('oi')
      .select('SUM(oi.quantity)', 'sum')
      .innerJoin('oi.order', 'o')
      .where('oi.dishId = :dishId', { dishId })
      .andWhere('o.status IN (:...statuses)', {
        statuses: ['CONFIRMED', 'PARTIALLY_COLLECTED', 'COLLECTED'],
      })
      .getRawOne<{ sum: string | null }>();

    return result?.sum ? parseInt(result.sum, 10) : 0;
  }

  async triggerDishUpdate(dishId: string) {
    try {
      const dish = await this.dishRepository.findOne({
        where: { id: dishId },
      });

      if (!dish) {
        this.logger.error(`Dish with ID ${dishId} not found to trigger update`);
        return;
      }

      const count = await this.getConfirmedOrderCount(dishId);
      const isSoldOut = dish.isSoldOut || count >= dish.preparedQuantity;

      this.kitchenGateway.emitDishUpdated({
        dishId: dish.id,
        dish_id: dish.id,
        confirmedOrderCount: count,
        confirmed_order_count: count,
        preparedQuantity: dish.preparedQuantity,
        prepared_quantity: dish.preparedQuantity,
        isSoldOut,
        is_sold_out: isSoldOut,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to trigger dish update for ${dishId}: ${errMsg}`);
    }
  }
}
