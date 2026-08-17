import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto, LoginDto, RefreshTokenDto, UpdateProfileDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { OAuthService } from './oauth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authService: AuthService,
    @Inject(OAuthService) private readonly oauthService: OAuthService,
  ) {}

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
  @SkipThrottle({ auth: true, generation: true, upload: true })
  @Throttle({ default: { ttl: 60_000, limit: 100 } })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle({ auth: true, generation: true, upload: true })
  @Throttle({ default: { ttl: 60_000, limit: 100 } })
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const token = (req as any).cookies?.refreshToken || (req.body as any)?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('缺少 refreshToken');
    }
    return this.authService.logout(token);
  }

  @Get('me')
  @SkipThrottle({ auth: true, generation: true, upload: true })
  @Throttle({ default: { ttl: 60_000, limit: 100 } })
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    return this.authService.getProfile((req as any).user.userId);
  }

  @Patch('me')
  @SkipThrottle({ auth: true, generation: true, upload: true })
  @Throttle({ default: { ttl: 60_000, limit: 100 } })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile((req as any).user.userId, dto);
  }

  @Post('change-password')
  @SkipThrottle({ auth: true, generation: true, upload: true })
  @Throttle({ default: { ttl: 60_000, limit: 100 } })
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

  // OAuth social login - redirect to provider
  @Get('oauth/:provider')
  @SkipThrottle({ auth: true, generation: true, upload: true })
  @Throttle({ default: { ttl: 60_000, limit: 100 } })
  @ApiOperation({ summary: 'OAuth 登录重定向' })
  @ApiParam({ name: 'provider', enum: ['google', 'github'] })
  async oauthRedirect(@Param('provider') provider: string, @Res() res: any) {
    if (!['google', 'github'].includes(provider)) {
      throw new BadRequestException('不支持的 OAuth 提供商');
    }
    const url = this.oauthService.getAuthorizationRedirect(provider);
    return res.redirect(url);
  }

  // OAuth callback - exchange code, create/find user, redirect to frontend
  @Get('oauth/:provider/callback')
  @SkipThrottle({ auth: true, generation: true, upload: true })
  @Throttle({ default: { ttl: 60_000, limit: 100 } })
  @ApiOperation({ summary: 'OAuth 回调' })
  @ApiParam({ name: 'provider', enum: ['google', 'github'] })
  async oauthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: any,
  ) {
    if (error) {
      const frontendBase = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
      return res.redirect(`${frontendBase}/login?oauth_error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      throw new BadRequestException('缺少授权码');
    }
    const result = await this.authService.oauthLogin(provider, code);
    const frontendBase = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const redirectUrl = `${frontendBase}/oauth-callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    return res.redirect(redirectUrl);
  }
}