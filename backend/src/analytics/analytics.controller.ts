import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Dish } from '../menus/entities/dish.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Menu } from '../menus/entities/menu.entity';
import { ForecastingService } from '../forecasting/forecasting.service';
import { RedisService } from '../db/redis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class AnalyticsController {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    private readonly forecastingService: ForecastingService,
    private readonly redisService: RedisService,
  ) {}

  @Get('revenue')
  async getRevenue() {
    const totalPayments = await this.paymentRepository
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where("p.status = 'COMPLETED'")
      .getRawOne<{ total: string | null }>();

    const totalRevenue = Number(totalPayments?.total || 0);

    const dishSales = await this.orderItemRepository
      .createQueryBuilder('oi')
      .select('d.name', 'dishName')
      .addSelect('SUM(oi.quantity * oi.unit_price)', 'sales')
      .innerJoin(Dish, 'd', 'oi.dish_id = d.id')
      .innerJoin(Order, 'o', 'oi.order_id = o.id')
      .where("o.status IN ('CONFIRMED', 'PARTIALLY_COLLECTED', 'COLLECTED')")
      .groupBy('d.name')
      .getRawMany<{ dishName: string; sales: string }>();

    const salesByDish = dishSales.map((item) => ({
      dishName: item.dishName,
      sales: Number(item.sales),
    }));

    return {
      totalRevenue,
      salesByDish,
    };
  }

  @Get('orders')
  async getOrdersStats() {
    const totalPlaced = await this.orderRepository.count();
    const totalCollected = await this.orderRepository.count({
      where: { status: 'COLLECTED' },
    });

    const collectionRate = totalPlaced > 0 ? (totalCollected / totalPlaced) * 100 : 0;

    return {
      totalPlaced,
      totalCollected,
      collectionRate: Number(collectionRate.toFixed(2)),
    };
  }

  @Get('dish-demand')
  async getDishDemand() {
    const activeMenu = await this.menuRepository.findOne({
      where: { isActive: true },
      relations: { dishes: true },
    });

    if (!activeMenu) {
      return { dishes: [] };
    }

    const dishNames = activeMenu.dishes.map((d) => d.name);
    const forecasts = await this.forecastingService.getRecommendedQuantities(dishNames);

    const redis = this.redisService.getClient();
    const resultDishes = [];

    for (const dish of activeMenu.dishes) {
      const key = `dish:availability:${dish.id}`;
      const liveVal = await redis.get(key);
      const remainingQty = liveVal !== null ? Math.max(0, parseInt(liveVal, 10)) : 0;

      // Confirmed orders quantity (ordered in active daily menu)
      const confirmedOrdersRes = await this.orderItemRepository
        .createQueryBuilder('oi')
        .select('SUM(oi.quantity)', 'total')
        .innerJoin(Order, 'o', 'oi.order_id = o.id')
        .where('oi.dish_id = :dishId', { dishId: dish.id })
        .andWhere("o.status IN ('CONFIRMED', 'PARTIALLY_COLLECTED', 'COLLECTED')")
        .getRawOne<{ total: string | null }>();

      const confirmedQty = Number(confirmedOrdersRes?.total || 0);

      // Collected items quantity
      const collectedItemsRes = await this.orderItemRepository
        .createQueryBuilder('oi')
        .select('SUM(oi.quantity)', 'total')
        .where('oi.dish_id = :dishId', { dishId: dish.id })
        .andWhere("oi.status = 'COLLECTED'")
        .getRawOne<{ total: string | null }>();

      const collectedQty = Number(collectedItemsRes?.total || 0);
      const collectionRate = confirmedQty > 0 ? (collectedQty / confirmedQty) * 100 : 0;

      resultDishes.push({
        dishId: dish.id,
        name: dish.name,
        forecastedQty: forecasts[dish.name] || 50,
        preparedQty: dish.preparedQuantity,
        confirmedQty,
        remainingQty,
        collectionRate: Number(collectionRate.toFixed(2)),
      });
    }

    return { dishes: resultDishes };
  }

  @Get('low-stock')
  async getLowStockAlerts() {
    const activeMenu = await this.menuRepository.findOne({
      where: { isActive: true },
      relations: { dishes: true },
    });

    if (!activeMenu) {
      return { alerts: [] };
    }

    const dishIds = activeMenu.dishes.map((d) => d.id);
    if (dishIds.length === 0) {
      return { alerts: [] };
    }

    const redis = this.redisService.getClient();
    const alerts = [];

    // Query dishes that are in low-stock or sold-out thresholds in DB
    const lowStockDishes = await this.dishRepository.find({
      where: { id: In(dishIds) },
    });

    for (const dish of lowStockDishes) {
      const key = `dish:availability:${dish.id}`;
      const liveVal = await redis.get(key);
      const remainingQty = liveVal !== null ? Math.max(0, parseInt(liveVal, 10)) : 0;

      if (remainingQty <= 15 || dish.isSoldOut) {
        alerts.push({
          dishId: dish.id,
          name: dish.name,
          preparedQuantity: dish.preparedQuantity,
          remainingQuantity: remainingQty,
          lowStockAt: dish.lowStockAt,
          soldOutAt: dish.soldOutAt,
          isSoldOut: dish.isSoldOut || remainingQty === 0,
        });
      }
    }

    // Sort by most recent alert timestamp
    alerts.sort((a, b) => {
      const timeA = new Date(a.soldOutAt || a.lowStockAt || 0).getTime();
      const timeB = new Date(b.soldOutAt || b.lowStockAt || 0).getTime();
      return timeB - timeA;
    });

    return { alerts };
  }

  @Get('export-csv')
  async exportCsv(@Res() res: Response) {
    const orders = await this.orderRepository.find({
      order: { createdAt: 'DESC' },
      relations: { items: true },
    });

    const payments = await this.paymentRepository.find();
    const paymentMap = new Map<string, Payment>();
    for (const p of payments) {
      if (p.orderId) {
        paymentMap.set(p.orderId, p);
      }
    }

    // Construct CSV Header
    let csvContent = 'Order ID,User ID,Total Amount,Status,Points Redeemed,Payment Method,Transaction Reference,Created At\n';

    // Construct CSV Rows
    for (const o of orders) {
      const payment = paymentMap.get(o.id);
      const paymentMethod = payment?.method || 'N/A';
      const txRef = payment?.transactionReference || 'N/A';
      const userId = o.userId || 'Walk-In';
      
      csvContent += `"${o.id}","${userId}",${o.totalAmount},"${o.status}",${o.pointsRedeemed},"${paymentMethod}","${txRef}","${o.createdAt.toISOString()}"\n`;
    }

    // Return file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=cafeq_orders_revenue.csv');
    return res.status(200).send(csvContent);
  }
}
