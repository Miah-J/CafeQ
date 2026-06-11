import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterStudentDto,
  ProvisionUserDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SendOtpDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('register')
  async register(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent({
      email: dto.email,
      passwordRaw: dto.password,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      studentNumber: dto.studentNumber,
      emailOtp: dto.emailOtp,
      phoneOtp: dto.phoneOtp,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('provision')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  async provision(@Body() dto: ProvisionUserDto) {
    return this.authService.provisionUser({
      email: dto.email,
      passwordRaw: dto.password,
      fullName: dto.fullName,
      role: dto.role,
      phoneNumber: dto.phoneNumber,
      department: dto.department,
      stationNumber: dto.stationNumber,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: Record<string, unknown>) {
    return user;
  }
}
