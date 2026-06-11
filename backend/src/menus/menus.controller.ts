import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateMenuDto, CreateDishDto, UpdateDishDto } from './dto/menus.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async createMenu(@Body() dto: CreateMenuDto) {
    return this.menusService.createMenu(dto);
  }

  @Post(':menuId/dishes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async addDish(@Param('menuId') menuId: string, @Body() dto: CreateDishDto) {
    return this.menusService.addDish(menuId, dto);
  }

  @Patch('dishes/:dishId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async editDish(@Param('dishId') dishId: string, @Body() dto: UpdateDishDto) {
    return this.menusService.editDish(dishId, dto);
  }

  @Delete('dishes/:dishId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async deleteDish(@Param('dishId') dishId: string) {
    return this.menusService.deleteDish(dishId);
  }

  @Post(':menuId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async publishMenu(@Param('menuId') menuId: string) {
    return this.menusService.publishMenu(menuId);
  }

  @Patch('dishes/:dishId/sold-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async markDishSoldOut(@Param('dishId') dishId: string) {
    return this.menusService.markDishSoldOut(dishId);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async getActiveMenu(): Promise<unknown> {
    return this.menusService.getActiveMenu();
  }
}
