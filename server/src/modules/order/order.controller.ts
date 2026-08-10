import { Controller, Get, Post, Body, Param, Query, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService } from './order.service';
import { PaymentService } from '../payment/payment.service';
import type {
  CreateOrderResponse,
  OrderResponse,
} from './types/order.types';
import { CreateOrderDto, OrderQueryDto, OrderIdParamDto } from './dto';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Create an order
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CreateOrderResponse> {
    return this.orderService.createOrder(user.id, dto);
  }

  /**
   * Get order by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(
    @Param() params: OrderIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponse> {
    const order = await this.orderService.getOrder(params.id, user.id);

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  /**
   * Get order by order number
   */
  @Get('number/:orderNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by order number' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderByNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrderResponse> {
    const order = await this.orderService.getOrderByNumber(orderNumber, user.id);

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  /**
   * List orders with pagination
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async listOrders(
    @Query() query: OrderQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ items: OrderResponse[]; total: number }> {
    // Non-admin users can only see their own orders
    const userId = user.role === 'admin' && query.userId ? query.userId : user.id;

    return this.orderService.listOrders({
      ...query,
      userId,
    });
  }

  /**
   * Pay for an order (create payment intent)
   */
  @Post(':id/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment intent for an order' })
  @ApiResponse({ status: 201, description: 'Payment intent created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async payForOrder(
    @Param() params: OrderIdParamDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<any> {
    // Get order
    const order = await this.orderService.getOrder(params.id, user.id);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error('Order is not pending');
    }

    // Check if order is expired
    if (order.expiresAt && new Date(order.expiresAt) < new Date()) {
      await this.orderService.updateOrderStatus(params.id, 'expired' as any);
      throw new Error('Order has expired');
    }

    // Create payment intent
    const payment = await this.paymentService.createPayment(user.id, {
      amount: Number(order.amount),
      currency: order.currency,
      orderId: order.id,
    });

    // Link payment to order
    await this.orderService.linkPayment(order.id, payment.paymentId);

    return {
      ...payment,
      orderNumber: order.orderNumber,
    };
  }

  /**
   * Expire pending orders (cron job endpoint)
   */
  @Post('expire')
  @ApiOperation({ summary: 'Expire pending orders (cron job)' })
  @ApiResponse({ status: 200, description: 'Orders expired successfully' })
  async expireOrders(): Promise<{ expiredCount: number }> {
    const expiredCount = await this.orderService.expireOrders();

    return { expiredCount };
  }
}
