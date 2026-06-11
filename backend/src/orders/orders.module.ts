import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ReferenceNumber } from './entities/reference-number.entity';
import { ReferenceService } from './reference.service';
import { MenusModule } from '../menus/menus.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ReferenceNumber]),
    MenusModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, ReferenceService],
  exports: [OrdersService, ReferenceService, TypeOrmModule],
})
export class OrdersModule {}
