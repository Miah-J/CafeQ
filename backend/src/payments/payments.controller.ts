import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DecryptedUser } from '../users/users.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stk-push')
  @UseGuards(JwtAuthGuard)
  async triggerStkPush(
    @CurrentUser() user: DecryptedUser,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentsService.triggerStkPush(orderId, user.id);
  }

  @Get('status/:orderId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(orderId);
  }

  @Post('mpesa/callback')
  @HttpCode(HttpStatus.OK)
  async mpesaCallback(@Body() payload: any) {
    await this.paymentsService.handleCallback(payload);
    return { ResultCode: 0, ResultDesc: 'Success' };
  }

  @Post('mock-callback')
  @HttpCode(HttpStatus.OK)
  async mockCallback(@Body() payload: any) {
    await this.paymentsService.handleCallback(payload);
    return { ResultCode: 0, ResultDesc: 'Success' };
  }
}
