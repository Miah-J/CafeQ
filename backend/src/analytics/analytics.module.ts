import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Dish } from '../menus/entities/dish.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Menu } from '../menus/entities/menu.entity';
import { ForecastingModule } from '../forecasting/forecasting.module';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Dish, Payment, Menu]),
    ForecastingModule,
    DbModule,
  ],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
