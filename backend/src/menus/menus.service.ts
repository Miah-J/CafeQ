import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { Dish } from './entities/dish.entity';
import { CreateMenuDto, CreateDishDto, UpdateDishDto } from './dto/menus.dto';
import { RedisService } from '../db/redis.service';

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    private readonly redisService: RedisService,
  ) {}

  async createMenu(dto: CreateMenuDto): Promise<Menu> {
    const existing = await this.menuRepository.findOne({
      where: { publishDate: dto.publishDate },
    });
    if (existing) {
      throw new BadRequestException(
        `Menu for date ${dto.publishDate} already exists`,
      );
    }
    const menu = this.menuRepository.create({
      publishDate: dto.publishDate,
      isActive: false,
    });
    return this.menuRepository.save(menu);
  }

  async addDish(menuId: string, dto: CreateDishDto): Promise<Dish> {
    const menu = await this.menuRepository.findOne({ where: { id: menuId } });
    if (!menu) {
      throw new NotFoundException(`Menu with ID ${menuId} not found`);
    }
    if (menu.isActive) {
      throw new BadRequestException('Cannot add dishes to an active menu');
    }
    const dish = this.dishRepository.create({
      ...dto,
      menuId,
      isSoldOut: false,
    });
    return this.dishRepository.save(dish);
  }

  async editDish(dishId: string, dto: UpdateDishDto): Promise<Dish> {
    const dish = await this.dishRepository.findOne({
      where: { id: dishId },
      relations: { menu: true },
    });
    if (!dish) {
      throw new NotFoundException(`Dish with ID ${dishId} not found`);
    }

    const oldQuantity = dish.preparedQuantity;
    Object.assign(dish, dto);

    const savedDish = await this.dishRepository.save(dish);

    if (dish.menu.isActive && dto.preparedQuantity !== undefined) {
      const delta = dto.preparedQuantity - oldQuantity;
      const redis = this.redisService.getClient();
      const key = `dish:availability:${dish.id}`;

      if (delta > 0) {
        await redis.incrby(key, delta);
      } else if (delta < 0) {
        await redis.decrby(key, Math.abs(delta));
      }
    }

    return savedDish;
  }

  async deleteDish(dishId: string): Promise<{ message: string }> {
    const dish = await this.dishRepository.findOne({
      where: { id: dishId },
      relations: { menu: true },
    });
    if (!dish) {
      throw new NotFoundException(`Dish with ID ${dishId} not found`);
    }
    if (dish.menu.isActive) {
      throw new BadRequestException('Cannot delete dishes from an active menu');
    }
    await this.dishRepository.remove(dish);
    return { message: 'Dish removed successfully' };
  }

  async publishMenu(menuId: string): Promise<Menu> {
    const menu = await this.menuRepository.findOne({
      where: { id: menuId },
      relations: { dishes: true },
    });
    if (!menu) {
      throw new NotFoundException(`Menu with ID ${menuId} not found`);
    }

    await this.menuRepository.update({}, { isActive: false });

    menu.isActive = true;
    const savedMenu = await this.menuRepository.save(menu);

    const redis = this.redisService.getClient();
    for (const dish of menu.dishes) {
      const key = `dish:availability:${dish.id}`;
      await redis.set(key, dish.isSoldOut ? 0 : dish.preparedQuantity);
    }

    return savedMenu;
  }

  async markDishSoldOut(dishId: string): Promise<Dish> {
    const dish = await this.dishRepository.findOne({
      where: { id: dishId },
      relations: { menu: true },
    });
    if (!dish) {
      throw new NotFoundException(`Dish with ID ${dishId} not found`);
    }

    dish.isSoldOut = true;
    const savedDish = await this.dishRepository.save(dish);

    if (dish.menu.isActive) {
      const redis = this.redisService.getClient();
      await redis.set(`dish:availability:${dish.id}`, 0);
    }

    return savedDish;
  }

  async getActiveMenu(dietaryTags?: string[]): Promise<any> {
    const menu = await this.menuRepository.findOne({
      where: { isActive: true },
      relations: { dishes: true },
    });

    if (!menu) {
      return null;
    }

    const redis = this.redisService.getClient();
    const dishesWithLiveQuantity = [];

    // Filter dishes by dietary tags in memory if provided
    let dishes = menu.dishes;
    if (dietaryTags && dietaryTags.length > 0) {
      const lowerTags = dietaryTags.map((t) => t.toLowerCase());
      dishes = dishes.filter((dish) => {
        if (!dish.dietaryTags) return false;
        const dishTags = dish.dietaryTags.map((t) => t.toLowerCase());
        return lowerTags.every((tag) => dishTags.includes(tag));
      });
    }

    for (const dish of dishes) {
      const key = `dish:availability:${dish.id}`;
      const liveVal = await redis.get(key);

      let liveQuantity: number;
      if (liveVal === null) {
        liveQuantity = dish.isSoldOut ? 0 : dish.preparedQuantity;
        await redis.set(key, liveQuantity);
      } else {
        liveQuantity = parseInt(liveVal, 10);
      }

      dishesWithLiveQuantity.push({
        ...dish,
        liveQuantity: Math.max(0, liveQuantity),
        isSoldOut: dish.isSoldOut || liveQuantity <= 0,
      });
    }

    return {
      ...menu,
      dishes: dishesWithLiveQuantity,
    };
  }

  async reservePortions(dishId: string, quantity: number): Promise<number> {
    const redis = this.redisService.getClient();
    const key = `dish:availability:${dishId}`;

    const script = `
      local key = KEYS[1]
      local quantity = tonumber(ARGV[1])
      local current = redis.call('GET', key)
      if not current then
          return -1
      end
      current = tonumber(current)
      if current >= quantity then
          local next_val = redis.call('DECRBY', key, quantity)
          return next_val
      else
          return -2
      end
    `;

    const result = await redis.eval(script, 1, key, quantity);
    const code = Number(result);

    if (code === -1) {
      const dish = await this.dishRepository.findOne({
        where: { id: dishId },
        relations: { menu: true },
      });
      if (!dish) {
        throw new NotFoundException(`Dish with ID ${dishId} not found`);
      }
      if (!dish.menu.isActive) {
        throw new BadRequestException('Dish is not on an active menu');
      }

      const initialQuantity = dish.isSoldOut ? 0 : dish.preparedQuantity;
      await redis.set(key, initialQuantity);

      const retryResult = await redis.eval(script, 1, key, quantity);
      const retryCode = Number(retryResult);
      if (retryCode === -2) {
        throw new BadRequestException(
          `Insufficient portions left for dish: ${dish.name}`,
        );
      }
      return retryCode;
    }

    if (code === -2) {
      const dish = await this.dishRepository.findOne({ where: { id: dishId } });
      const dishName = dish ? dish.name : 'Selected dish';
      throw new BadRequestException(
        `Insufficient portions left for dish: ${dishName}`,
      );
    }

    return code;
  }

  async releasePortions(dishId: string, quantity: number): Promise<number> {
    const redis = this.redisService.getClient();
    const key = `dish:availability:${dishId}`;
    const result = await redis.incrby(key, quantity);
    return result;
  }
}
