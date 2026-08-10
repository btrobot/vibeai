import { Controller, Post, Get, Body, Param, Query, Req, Res, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from './payment.service';
import type {
  CreatePaymentResponse,
  PaymentResponse,
} from './types/payment.types';
import { CreatePaymentIntentDto, PaymentQueryDto, PaymentIdParamDto } from './dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a payment intent
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment intent' })
  @ApiResponse({ status: 201, description: 'Payment intent created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async createPayment(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreatePaymentResponse> {
    return this.paymentService.createPayment(user.id, dto);
  }

  /**
   * Get payment by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPayment(
    @Param() params: PaymentIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentService.getPayment(params.id, user.id);

    if (!payment) {
      throw new Error('Payment not found');
    }

    return payment;
  }

  /**
   * List payments with pagination
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payments' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  async listPayments(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ items: PaymentResponse[]; total: number }> {
    // Non-admin users can only see their own payments
    const userId = user.role === 'admin' && query.userId ? query.userId : user.id;

    return this.paymentService.listPayments({
      ...query,
      userId,
    });
  }

  /**
   * Handle Stripe webhook
   */
  @Post('webhook')
  @ApiOperation({ summary: 'Handle Stripe webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;
    const payload = req.body;

    // Verify webhook signature
    const isValid = this.paymentService.verifyWebhookSignature(
      JSON.stringify(payload),
      signature,
    );

    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    // Parse Stripe event
    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;

    try {
      await this.paymentService.handleWebhook(event);
      res.status(200).json({ received: true });
    } catch (error) {
      this.logger.error(`Webhook handling failed: ${error}`);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}
