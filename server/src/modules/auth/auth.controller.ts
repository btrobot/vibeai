import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto, LoginDto, RefreshTokenDto, UpdateProfileDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.socket?.remoteAddress || '');
    const ua = req.headers['user-agent'];
    const deviceInfo = Array.isArray(ua) ? ua[0] : (ua || '');
    return this.authService.login(dto, ip, deviceInfo);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const token = (req as any).cookies?.refreshToken || (req.body as any)?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('缺少 refreshToken');
    }
    return this.authService.logout(token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    return this.authService.getProfile((req as any).user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile((req as any).user.userId, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword((req as any).user.userId, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}