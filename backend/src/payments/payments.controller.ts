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

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stk-push')
  @UseGuards(JwtAuthGuard)
  async triggerStkPush(
    @CurrentUser() user: DecryptedUser,
    @Body() dto: TriggerStkPushDto,
  ) {
    return this.paymentsService.triggerStkPush(dto.orderId, user.id);
  }

  @Get('status/:orderId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentStatus(orderId);
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
