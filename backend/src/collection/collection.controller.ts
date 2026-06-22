import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CollectionService } from './collection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('collection')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get('lookup/:referenceCode')
  @Roles('ServingStaff', 'Admin')
  async lookupOrder(@Param('referenceCode') referenceCode: string) {
    return this.collectionService.lookupOrder(referenceCode);
  }

  @Post('collect/:orderItemId')
  @Roles('ServingStaff')
  async collectOrderItem(@Param('orderItemId') orderItemId: string) {
    return this.collectionService.collectOrderItem(orderItemId);
  }
}
