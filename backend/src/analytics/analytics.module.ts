import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Dish } from '../menus/entities/dish.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Menu } from '../menus/entities/menu.entity';
import { DbModule } from '../db/db.module';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Dish, Payment, Menu]),
    DbModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}

