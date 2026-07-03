import { Controller, Get, Query, Res, UseGuards, Post, Body, Delete, Param } from '@nestjs/common';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Dish } from '../menus/entities/dish.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Menu } from '../menus/entities/menu.entity';
import { RedisService } from '../db/redis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';


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
    private readonly redisService: RedisService,
    private readonly analyticsService: AnalyticsService,
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

  @Get('records')
  async getOrderRecords() {
    const orders = await this.orderRepository.find({
      order: { createdAt: 'DESC' },
    });

    const payments = await this.paymentRepository.find();
    const paymentMap = new Map<string, Payment>();
    for (const p of payments) {
      if (p.orderId) {
        paymentMap.set(p.orderId, p);
      }
    }

    return orders.map((o) => {
      const payment = paymentMap.get(o.id);
      return {
        orderId: o.id,
        userId: o.userId || 'Walk-In',
        totalAmount: Number(o.totalAmount),
        status: o.status,
        pointsRedeemed: o.pointsRedeemed,
        paymentMethod: payment?.method || 'N/A',
        transactionReference: payment?.transactionReference || 'N/A',
        createdAt: o.createdAt,
      };
    });
  }

  /**
   * Returns complete filtered dashboard data for admin analytics.
   * Leverages the AnalyticsService executing raw queries.
   */
  @Get('dashboard')
  async getDashboardData(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Query('granularity') granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      kpi,
      overview,
      hourly,
      menu,
      payment,
      fulfillment,
      behavior,
      inventory,
    ] = await Promise.all([
      this.analyticsService.getKpiStats(),
      this.analyticsService.getOrderOverview(startDate, endDate, granularity),
      this.analyticsService.getHourlyDistribution(startDate, endDate),
      this.analyticsService.getMenuPerformance(startDate, endDate),
      this.analyticsService.getPaymentHealth(startDate, endDate),
      this.analyticsService.getFulfillmentStats(startDate, endDate),
      this.analyticsService.getUserBehavior(startDate, endDate),
      this.analyticsService.getInventoryStats(startDate, endDate),
    ]);

    return {
      kpi,
      overview,
      hourly,
      menu,
      payment,
      fulfillment,
      behavior,
      inventory,
    };
  }

  @Get('export-csv')
  async exportCsv(
    @Res() res: Response,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
  ) {
    let csvContent = 'Order ID,User ID,Total Amount,Status,Points Redeemed,Payment Method,Transaction Reference,Created At\n';

    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const records = await this.analyticsService.getFilteredExportData(startDate, endDate);
      for (const r of records) {
        const createdAtStr = r.createdAt instanceof Date 
          ? r.createdAt.toISOString() 
          : new Date(r.createdAt).toISOString();
        csvContent += `"${r.orderId}","${r.userId}",${r.totalAmount},"${r.status}",${r.pointsRedeemed},"${r.paymentMethod}","${r.transactionReference}","${createdAtStr}"\n`;
      }
    } else {
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

      for (const o of orders) {
        const payment = paymentMap.get(o.id);
        const paymentMethod = payment?.method || 'N/A';
        const txRef = payment?.transactionReference || 'N/A';
        const userId = o.userId || 'Walk-In';
        
        csvContent += `"${o.id}","${userId}",${o.totalAmount},"${o.status}",${o.pointsRedeemed},"${paymentMethod}","${txRef}","${o.createdAt.toISOString()}"\n`;
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=cafeq_orders_revenue.csv');
    return res.status(200).send(csvContent);
  }

  /**
   * Fetches all academic calendar events for administrative management.
   */
  @Get('academic-events')
  async getAcademicEvents() {
    return this.analyticsService.getAcademicEvents();
  }

  /**
   * Creates a new academic event to overlay on the correlation chart.
   */
  @Post('academic-events')
  async createAcademicEvent(
    @Body() body: { name: string; eventType: string; startDate: string; endDate: string },
  ) {
    return this.analyticsService.createAcademicEvent(
      body.name,
      body.eventType,
      body.startDate,
      body.endDate,
    );
  }

  /**
   * Deletes an academic event by its unique ID.
   */
  @Delete('academic-events/:id')
  async deleteAcademicEvent(@Param('id') id: string) {
    await this.analyticsService.deleteAcademicEvent(id);
    return { success: true };
  }
}
