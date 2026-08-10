import { Controller, Get, Post, Patch, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
import { AdminOrderService } from './services/admin-order.service';
import { AdminOrderQueryDto, AdminOrderIdParamDto, AdminRefundOrderDto, AdminUpdateOrderDto } from './dto/admin-orders.dto';

@ApiTags('Admin - Orders')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminOrderController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  /**
   * Get order statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getOrderStats(@Query('range') range?: string) {
    return this.adminOrderService.getOrderStats(range);
  }

  /**
   * List all orders
   */
  @Get()
  @ApiOperation({ summary: 'List all orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async listOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminOrderService.listOrders(query);
  }

  /**
   * Get order detail
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get order detail' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderDetail(@Param() params: AdminOrderIdParamDto) {
    return this.adminOrderService.getOrderDetail(params.id);
  }

  /**
   * Update order status
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(
    @Param() params: AdminOrderIdParamDto,
    @Body() dto: AdminUpdateOrderDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    if (!dto.status) {
      throw new Error('Status is required');
    }
    return this.adminOrderService.updateOrderStatus(params.id, dto.status);
  }

  /**
   * Refund order
   */
  @Post(':id/refund')
  @ApiOperation({ summary: 'Refund order' })
  @ApiResponse({ status: 200, description: 'Order refunded successfully' })
  @ApiResponse({ status: 400, description: 'Order cannot be refunded' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async refundOrder(
    @Param() params: AdminOrderIdParamDto,
    @Body() dto: AdminRefundOrderDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminOrderService.refundOrder(params.id, dto, admin.id);
  }

  /**
   * Export orders to CSV
   */
  @Get('export')
  @ApiOperation({ summary: 'Export orders to CSV' })
  @ApiResponse({ status: 200, description: 'Orders exported successfully', type: 'text/csv' })
  async exportOrders(
    @Query() query: AdminOrderQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.adminOrderService.exportOrders(query);
    const bom = '﻿';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=orders_${Date.now()}.csv`);
    res.send(bom + csv);
  }

  // ===== Refund Management Endpoints =====

  /**
   * Get refund statistics
   */
  @Get('refunds/stats')
  @ApiOperation({ summary: 'Get refund statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getRefundStats(@Query('range') range?: string) {
    return this.adminOrderService.getRefundStats(range);
  }

  /**
   * List all refunds
   */
  @Get('refunds')
  @ApiOperation({ summary: 'List all refunds' })
  @ApiResponse({ status: 200, description: 'Refunds retrieved successfully' })
  async listRefunds(@Query() query: any) {
    return this.adminOrderService.listRefunds(query);
  }

  /**
   * Get refund detail
   */
  @Get('refunds/:id')
  @ApiOperation({ summary: 'Get refund detail' })
  @ApiResponse({ status: 200, description: 'Refund retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Refund not found' })
  async getRefundDetail(@Param('id') id: string) {
    return this.adminOrderService.getRefundDetail(id);
  }

  /**
   * Export refunds to CSV
   */
  @Get('refunds/export')
  @ApiOperation({ summary: 'Export refunds to CSV' })
  @ApiResponse({ status: 200, description: 'Refunds exported successfully', type: 'text/csv' })
  async exportRefunds(
    @Query() query: any,
    @Res() res: Response,
  ) {
    const csv = await this.adminOrderService.exportRefunds(query);
    const bom = '﻿';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=refunds_${Date.now()}.csv`);
    res.send(bom + csv);
  }
}
