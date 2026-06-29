import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateMenuDto, CreateDishDto, UpdateDishDto } from './dto/menus.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

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
  @Roles('Admin', 'KitchenStaff')
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
  @Roles('Admin', 'KitchenStaff')
  async markDishSoldOut(@Param('dishId') dishId: string) {
    return this.menusService.markDishSoldOut(dishId);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async getActiveMenu(@Query('tags') tags?: string): Promise<unknown> {
    const dietaryTags = tags ? tags.split(',') : undefined;
    return this.menusService.getActiveMenu(dietaryTags);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async getAllMenus() {
    return this.menusService.getAllMenus();
  }

  @Patch(':menuId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async updateMenu(@Param('menuId') menuId: string, @Body() dto: CreateMenuDto) {
    return this.menusService.updateMenu(menuId, dto);
  }

  @Delete(':menuId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async deleteMenu(@Param('menuId') menuId: string) {
    return this.menusService.deleteMenu(menuId);
  }

  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { imageUrl: null };
    }
    return { imageUrl: `http://localhost:3001/uploads/${file.filename}` };
  }
}
