import { Controller, Get, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DecryptedUser } from '../users/users.service';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getLoyaltyStatus(@CurrentUser() user: DecryptedUser) {
    return this.loyaltyService.getLoyaltyStatus(user.id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getLoyaltyHistory(@CurrentUser() user: DecryptedUser) {
    return this.loyaltyService.getLoyaltyHistory(user.id);
  }

  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async getAdminStats() {
    return this.loyaltyService.getAdminStats();
  }
}
