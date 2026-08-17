import { Inject, Controller, Get, Post, Body, Param, Query, Logger, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';
import { PaymentService } from '../billing/payment.service';
import type {
  CreateOrderResponse,
  OrderResponse,
} from './types/order.types';
import { CreateOrderDto, OrderQueryDto, OrderIdParamDto } from './dto';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(@Inject(OrderService) private readonly orderService: OrderService,
    @Inject(PaymentService) private readonly paymentService: PaymentService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an order' })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreateOrderResponse> {
    return this.orderService.createOrder(user.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(
    @Param() params: OrderIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponse> {
    const order = await this.orderService.getOrder(params.id, user.id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  @Get('number/:orderNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by order number' })
  async getOrderByNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponse> {
    const order = await this.orderService.getOrderByNumber(orderNumber, user.id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List orders' })
  async listOrders(
    @Query() query: OrderQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ items: OrderResponse[]; total: number }> {
    const userId = user.role === 'admin' && query.userId ? query.userId : user.id;
    return this.orderService.listOrders({ ...query, userId });
  }

  @Post(':id/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe Checkout Session for an order' })
  async checkoutOrder(
    @Param() params: OrderIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string; sessionId: string }> {
    const order = await this.orderService.getOrder(params.id, user.id);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'pending') throw new BadRequestException('Order is not pending');
    if (order.expiresAt && new Date(order.expiresAt) < new Date()) {
      await this.orderService.updateOrderStatus(params.id, 'expired' as any);
      throw new BadRequestException('Order has expired');
    }

    const result = await this.paymentService.createOneTimeCheckoutSession(
      user.id,
      order.id,
      Number(order.amount),
      order.currency,
      order.credits,
    );

    return { url: result.url, sessionId: result.sessionId };
  }

  @Post('expire')
  @ApiOperation({ summary: 'Expire pending orders (cron job)' })
  async expireOrders(): Promise<{ expiredCount: number }> {
    const expiredCount = await this.orderService.expireOrders();
    return { expiredCount };
  }
}
