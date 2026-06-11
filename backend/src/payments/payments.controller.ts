import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentsService, MpesaCallbackPayload } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DecryptedUser } from '../users/users.service';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class TriggerStkPushDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;
}

export class ProcessPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @IsNotEmpty()
  method: 'MPESA' | 'WALLET';

  @IsNotEmpty()
  useWallet: boolean;
}

export class TopUpWalletDto {
  @IsNotEmpty()
  amount: number;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('pay')
  @UseGuards(JwtAuthGuard)
  async processPayment(
    @CurrentUser() user: DecryptedUser,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.paymentsService.processPayment(
      user.id,
      dto.orderId,
      dto.method,
      dto.useWallet,
    );
  }

  @Post('stk-push')
  @UseGuards(JwtAuthGuard)
  async triggerStkPush(
    @CurrentUser() user: DecryptedUser,
    @Body() dto: TriggerStkPushDto,
  ) {
    return this.paymentsService.triggerStkPush(dto.orderId, user.id);
  }

  @Post('wallet/topup')
  @UseGuards(JwtAuthGuard)
  async triggerWalletTopUp(
    @CurrentUser() user: DecryptedUser,
    @Body() dto: TopUpWalletDto,
  ) {
    return this.paymentsService.triggerWalletTopUp(user.id, Number(dto.amount));
  }

  @Get('wallet/balance')
  @UseGuards(JwtAuthGuard)
  async getWalletBalance(@CurrentUser() user: DecryptedUser) {
    const balance = await this.paymentsService.getWalletBalance(user.id);
    return { balance };
  }

  @Get('status/:orderId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(orderId);
  }

  @Get('status/payment/:paymentId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatusByPaymentId(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getPaymentStatusByPaymentId(paymentId);
  }

  @Post('mpesa/callback')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }),
  )
  async mpesaCallback(@Body() payload: MpesaCallbackPayload) {
    await this.paymentsService.handleCallback(payload);
    return { ResultCode: 0, ResultDesc: 'Success' };
  }

  @Post('mock-callback')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }),
  )
  async mockCallback(@Body() payload: MpesaCallbackPayload) {
    await this.paymentsService.handleCallback(payload);
    return { ResultCode: 0, ResultDesc: 'Success' };
  }
}
