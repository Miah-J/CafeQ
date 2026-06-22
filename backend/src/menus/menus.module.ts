import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from './entities/menu.entity';
import { Dish } from './entities/dish.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';
import { DbModule } from '../db/db.module';

@Module({
  imports: [TypeOrmModule.forFeature([Menu, Dish, OrderItem]), DbModule],
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
