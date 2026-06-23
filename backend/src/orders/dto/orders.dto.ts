import {
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @IsUUID()
  dishId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsToRedeem?: number;
}

export class CreateCashierOrderDto {
  @IsOptional()
  @IsString()
  studentNumber?: string;

  @IsIn(['CASH', 'MPESA'])
  paymentMethod: 'CASH' | 'MPESA';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
