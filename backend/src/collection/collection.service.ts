import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ReferenceNumber } from '../orders/entities/reference-number.entity';
import { Dish } from '../menus/entities/dish.entity';
import { UsersService } from '../users/users.service';
import { CollectionGateway } from './collection.gateway';

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(ReferenceNumber)
    private readonly referenceRepository: Repository<ReferenceNumber>,
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    private readonly usersService: UsersService,
    private readonly collectionGateway: CollectionGateway,
    private readonly dataSource: DataSource,
  ) {}

  async lookupOrder(referenceCode: string) {
    const ref = await this.referenceRepository.findOne({
      where: { referenceCode: referenceCode.toUpperCase().trim() },
    });

    if (!ref) {
      throw new NotFoundException(
        `Reference code ${referenceCode} not found`,
      );
    }

    const order = await this.orderRepository.findOne({
      where: { id: ref.orderId },
      relations: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order for reference code ${referenceCode} not found`);
    }

    let studentName = 'Walk-In Customer';
    let studentNumber = 'N/A';

    if (order.userId) {
      const student = await this.usersService.findById(order.userId);
      if (student) {
        studentName = student.fullName;
        studentNumber = student.studentNumber || 'N/A';
      }
    }

    const dishIds = order.items.map((i) => i.dishId);
    let dishes: Dish[] = [];
    if (dishIds.length > 0) {
      dishes = await this.dishRepository.find({
        where: { id: In(dishIds) },
      });
    }
    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    return {
      orderId: order.id,
      referenceCode: ref.referenceCode,
      status: order.status,
      studentName,
      studentNumber,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        orderItemId: item.id,
        dishId: item.dishId,
        dishName: dishMap.get(item.dishId)?.name || 'Unknown Dish',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        status: item.status,
      })),
    };
  }

  async collectOrderItem(orderItemId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = await queryRunner.manager.findOne(OrderItem, {
        where: { id: orderItemId },
        relations: { order: true },
      });

      if (!item) {
        throw new NotFoundException(`Order item with ID ${orderItemId} not found`);
      }

      if (item.status === 'COLLECTED' || item.status === 'REFUNDED') {
        throw new BadRequestException(`Item has already been processed with status: ${item.status}`);
      }

      const order = item.order;
      if (!order) {
        throw new NotFoundException(`Parent order for item ${orderItemId} not found`);
      }

      if (order.status !== 'CONFIRMED' && order.status !== 'PARTIALLY_COLLECTED') {
        throw new BadRequestException(
          `Order status must be CONFIRMED or PARTIALLY_COLLECTED to collect items. Current status: ${order.status}`,
        );
      }

      // 1. Mark item as collected
      item.status = 'COLLECTED';
      await queryRunner.manager.save(OrderItem, item);

      // 2. Fetch all items in order to check overall status
      const allItems = await queryRunner.manager.find(OrderItem, {
        where: { orderId: order.id },
      });

      const allCollectedOrRefunded = allItems.every(
        (i) => i.status === 'COLLECTED' || i.status === 'REFUNDED',
      );

      // 3. Update order status
      let newOrderStatus = order.status;
      if (allCollectedOrRefunded) {
        newOrderStatus = 'COLLECTED';
      } else {
        newOrderStatus = 'PARTIALLY_COLLECTED';
      }

      if (newOrderStatus !== order.status) {
        order.status = newOrderStatus;
        await queryRunner.manager.save(Order, order);
      }

      await queryRunner.commitTransaction();

      // 4. Emit websocket events
      this.collectionGateway.emitItemCollected(order.id, item.id, 'COLLECTED');

      if (newOrderStatus === 'COLLECTED') {
        this.collectionGateway.emitOrderCompleted(order.id, 'COLLECTED');
      }

      return {
        orderItemId: item.id,
        itemStatus: item.status,
        orderId: order.id,
        orderStatus: newOrderStatus,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
