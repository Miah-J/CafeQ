import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateCashierOrderDto } from './dto/orders.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DecryptedUser, UsersService } from '../users/users.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  async createOrder(
    @CurrentUser() user: DecryptedUser,
    @Body() dto: CreateOrderDto,
  ) {
    const userId = user ? user.id : null;
    return this.ordersService.createOrder(userId, dto);
  }

  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  @Get('student/:studentNumber')
  @UseGuards(RolesGuard)
  @Roles('Cashier')
  async lookupStudent(@Param('studentNumber') studentNumber: string) {
    const student = await this.usersService.findStudentByNumber(studentNumber);
    if (!student) {
      return { found: false };
    }
    return {
      found: true,
      id: student.id,
      fullName: student.fullName,
      studentNumber: student.studentNumber,
    };
  }

  @Post('cashier')
  @UseGuards(RolesGuard)
  @Roles('Cashier')
  async createCashierOrder(@Body() dto: CreateCashierOrderDto) {
    return this.ordersService.createCashierOrder(dto);
  }
}
