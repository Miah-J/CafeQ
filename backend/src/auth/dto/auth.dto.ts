import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsIn,
  IsString,
} from 'class-validator';

export class RegisterStudentDto {
  @IsEmail()
  email: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  studentNumber: string;

  @IsNotEmpty()
  @IsString()
  emailOtp: string;

  @IsNotEmpty()
  @IsString()
  phoneOtp: string;
}

export class SendOtpDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  studentNumber: string;
}

export class ProvisionUserDto {
  @IsEmail()
  email: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsIn(['Admin', 'Cashier', 'ServingStaff', 'KitchenStaff'])
  role: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  stationNumber?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty()
  token: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
