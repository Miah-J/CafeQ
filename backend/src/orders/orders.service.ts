import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/orders.dto';
import { MenusService } from '../menus/menus.service';
import { Dish } from '../menus/entities/dish.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    private readonly dataSource: DataSource,
    private readonly menusService: MenusService,
  ) {}

  async createOrder(
    userId: string | null,
    dto: CreateOrderDto,
  ): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const reservedPortions: Array<{ dishId: string; quantity: number }> = [];

    try {
      let totalAmount = 0;
      const orderItemsToSave: OrderItem[] = [];

      const dbOrder = new Order();
      dbOrder.userId = userId;
      dbOrder.status = 'PENDING';
      dbOrder.totalAmount = 0;

      for (const item of dto.items) {
        const dish = await queryRunner.manager.findOne(Dish, {
          where: { id: item.dishId },
        });
        if (!dish) {
          throw new NotFoundException(`Dish with ID ${item.dishId} not found`);
        }

        try {
          await this.menusService.reservePortions(item.dishId, item.quantity);
          reservedPortions.push({
            dishId: item.dishId,
            quantity: item.quantity,
          });
        } catch (error: any) {
          throw new BadRequestException(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            error.message ||
              `Insufficient portion availability for dish: ${dish.name}`,
          );
        }

        const unitPrice = Number(dish.price);
        totalAmount += unitPrice * item.quantity;

        const dbItem = new OrderItem();
        dbItem.dishId = item.dishId;
        dbItem.quantity = item.quantity;
        dbItem.unitPrice = unitPrice;
        dbItem.status = 'PENDING';
        dbItem.order = dbOrder;

        orderItemsToSave.push(dbItem);
      }

      dbOrder.totalAmount = totalAmount;
      dbOrder.items = orderItemsToSave;

      const savedOrder = await queryRunner.manager.save(Order, dbOrder);

      await queryRunner.commitTransaction();

      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();

      for (const res of reservedPortions) {
        await this.menusService.releasePortions(res.dishId, res.quantity);
      }

      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return order;
  }
}
