import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ReferenceNumber } from './entities/reference-number.entity';
import { ReferenceService } from './reference.service';
import { Payment } from '../payments/entities/payment.entity';
import { Dish } from '../menus/entities/dish.entity';
import { MenusModule } from '../menus/menus.module';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      ReferenceNumber,
      Payment,
      Dish,
    ]),
    MenusModule,
    UsersModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, ReferenceService],
  exports: [OrdersService, ReferenceService, TypeOrmModule],
})
export class OrdersModule {}
