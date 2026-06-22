import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ReferenceNumber } from '../orders/entities/reference-number.entity';
import { Dish } from '../menus/entities/dish.entity';
import { UsersModule } from '../users/users.module';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { CollectionGateway } from './collection.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ReferenceNumber, Dish]),
    UsersModule,
  ],
  controllers: [CollectionController],
  providers: [CollectionService, CollectionGateway],
  exports: [CollectionService, CollectionGateway],
})
export class CollectionModule {}
