import { Controller, Post, UseGuards } from '@nestjs/common';
import { RefundService } from './refund.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('refund')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post('trigger')
  @Roles('Admin')
  async triggerRefunds() {
    const stats = await this.refundService.processUncollectedRefunds();
    return {
      success: true,
      message: 'Uncollected items refund job completed successfully',
      stats,
    };
  }
}
