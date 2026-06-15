import {
  IsDateString,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';

export class CreateMenuDto {
  @IsDateString()
  @IsNotEmpty()
  publishDate: string;
}

export class CreateDishDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dietaryTags?: string[];

  @IsNumber()
  @Min(0)
  preparedQuantity: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class UpdateDishDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dietaryTags?: string[];

  @IsNumber()
  @IsOptional()
  preparedQuantity?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
