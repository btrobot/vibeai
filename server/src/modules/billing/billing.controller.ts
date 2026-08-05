import { Controller, Get, Post, Patch, Body, Param, Req, Headers, UseGuards, HttpCode, HttpStatus, Inject, BadRequestException, RawBodyRequest } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import type { CreateSubscriptionInput } from '../../shared-types';

@Controller('billing')
export class BillingController {
  constructor(
    @Inject('BILLING_SERVICE') private readonly billing: BillingService,
    private readonly payment: PaymentService,
  ) {}

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

  // ===== Payment (Stripe) =====

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckoutSession(
    @Req() req: Request,
    @Body() body: { planSlug: string; billingCycle: 'monthly' | 'yearly' },
  ) {
    const userId = (req as any).user.userId;
    if (!body.planSlug || !body.billingCycle) {
      throw new BadRequestException('缺少 planSlug 或 billingCycle');
    }
    const result = await this.payment.createCheckoutSession(userId, body.planSlug, body.billingCycle);
    return { success: true, data: result };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('缺少 stripe-signature 头');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('缺少请求体');
    }
    const result = await this.payment.handleWebhook(rawBody, signature);
    return { success: true, data: result };
  }

  @Get('payment-status')
  getPaymentStatus() {
    return {
      success: true,
      data: {
        enabled: this.payment.isPaymentEnabled(),
      },
    };
  }
}