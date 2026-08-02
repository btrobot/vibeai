import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import type { CreateSubscriptionInput } from '../../shared-types';

@Controller('api/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  async getPlans() {
    const plans = await this.billing.getPlans();
    return { success: true, data: plans };
  }

  @Get('plans/:slug')
  async getPlan(@Param('slug') slug: string) {
    const plan = await this.billing.getPlanBySlug(slug);
    return { success: true, data: plan };
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@Req() req: Request) {
    const userId = (req as any).user.userId;
    const sub = await this.billing.getSubscription(userId);
    return { success: true, data: sub };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription')
  async createSubscription(
    @Req() req: Request,
    @Body() input: CreateSubscriptionInput,
  ) {
    const userId = (req as any).user.userId;
    const sub = await this.billing.createOrUpdateSubscription(userId, input);
    return { success: true, data: sub };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Req() req: Request) {
    const userId = (req as any).user.userId;
    await this.billing.cancelSubscription(userId);
    return { success: true, message: '订阅已取消' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@Req() req: Request) {
    const userId = (req as any).user.userId;
    const stats = await this.billing.getUsageStats(userId);
    return { success: true, data: stats };
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(@Req() req: Request) {
    const userId = (req as any).user.userId;
    const history = await this.billing.getCreditHistory(userId);
    return { success: true, data: history };
  }
}