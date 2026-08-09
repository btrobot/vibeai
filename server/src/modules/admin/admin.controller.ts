import { Controller, Get, Patch, Delete, Query, Param, Body, Post, UseGuards, Req, Logger, Inject, BadRequestException, Res } from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { 
  AdminUserQueryService, 
  AdminUserMutationService, 
  AdminExportService,
  AdminNotificationService 
} from './services';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request, Response } from 'express';
import { AdminSendNotificationDto, AdminBroadcastNotificationDto } from './dto/user';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    @Inject('ADMIN_USER_QUERY_SERVICE') private readonly queryService: AdminUserQueryService,
    @Inject('ADMIN_USER_MUTATION_SERVICE') private readonly mutationService: AdminUserMutationService,
    @Inject('ADMIN_EXPORT_SERVICE') private readonly exportService: AdminExportService,
    @Inject('ADMIN_NOTIFICATION_SERVICE') private readonly notificationService: AdminNotificationService,
  ) {}

  private checkAdmin(req: Request) {
    const user = (req as any).user;
    if (user?.role !== 'admin') {
      throw new BadRequestException('无权限访问');
    }
    return user;
  }

  // ===== Dashboard =====

  @Get('stats')
  @ApiOperation({ summary: '获取平台统计数据' })
  async getStats(@Req() req: Request) {
    this.checkAdmin(req);
    return await this.queryService.getStats();
  }

  // ===== User Management =====

  @Get('users')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOperation({ summary: '获取用户列表（分页）' })
  async getUsers(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    this.checkAdmin(req);
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    if (p < 1 || l < 1 || l > 100) {
      throw new BadRequestException('分页参数无效');
    }
    return await this.queryService.getUsers(p, l, search);
  }

  @Get('users/search')
  @ApiOperation({ summary: '搜索用户' })
  async searchUsers(
    @Req() req: Request,
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ) {
    this.checkAdmin(req);
    const l = limit ? parseInt(limit, 10) : 10;
    if (l < 1 || l > 50) {
      throw new BadRequestException('限制参数无效（1-50）');
    }
    if (!keyword) {
      throw new BadRequestException('搜索关键词不能为空');
    }
    return await this.queryService.searchUsers(keyword, l);
  }

  @Get('users/export')
  @ApiOperation({ summary: '导出用户列表为 CSV' })
  @ApiResponse({ type: 'text/csv', description: 'CSV file' })
  async exportUsers(
    @Req() req: Request,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('role') role?: 'user' | 'admin',
    @Query('status') status?: 'active' | 'banned',
    @Query('limit') limit?: string,
    @Query('includeBOM') includeBOM?: string,
  ) {
    this.checkAdmin(req);
    
    const l = limit ? parseInt(limit, 10) : 10000;
    const bom = includeBOM === 'true' ? true : includeBOM === 'false' ? false : true;
    
    this.logger.log(`Admin ${(req as any).user?.email} exporting users`);
    
    const result = await this.exportService.exportUsersToCsv({
      search,
      role,
      status,
      limit: l,
      includeBOM: bom,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.csv);
  }

  @Post('users/:id/notify')
  @ApiOperation({ summary: '发送通知给用户' })
  async sendNotificationToUser(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AdminSendNotificationDto,
  ) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} sending notification to user ${id}`);
    
    return await this.notificationService.sendNotificationToUser(
      id,
      dto,
      (req as any).user?.id
    );
  }

  @Post('users/notify/broadcast')
  @ApiOperation({ summary: '群发通知' })
  async broadcastNotification(
    @Req() req: Request,
    @Body() dto: AdminBroadcastNotificationDto,
  ) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} broadcasting notification to ${dto.targetRole || 'all'} users`);
    
    return await this.notificationService.broadcastNotification(
      dto,
      (req as any).user?.id
    );
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: '封禁用户' })
  async banUser(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} banned user ${id}`);
    return await this.mutationService.banUser(id);
  }

  @Patch('users/:id/unban')
  @ApiOperation({ summary: '解封用户' })
  async unbanUser(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} unbanned user ${id}`);
    return await this.mutationService.unbanUser(id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: '修改用户角色' })
  async updateUserRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    this.checkAdmin(req);
    if (!role) {
      throw new BadRequestException('角色不能为空');
    }
    this.logger.log(`Admin ${(req as any).user?.email} changed user ${id} role to ${role}`);
    return await this.mutationService.updateUserRole(id, role);
  }

  // ===== Gallery Moderation =====

  @Get('gallery')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['published', 'unpublished'] })
  @ApiOperation({ summary: '获取画廊作品列表（分页）' })
  async getGalleryWorks(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'published' | 'unpublished',
  ) {
    this.checkAdmin(req);
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    if (p < 1 || l < 1 || l > 100) {
      throw new BadRequestException('分页参数无效');
    }
    return await this.queryService.getGalleryWorks(p, l, status);
  }

  @Get('gallery/export')
  @ApiOperation({ summary: '导出画廊作品为 CSV' })
  @ApiResponse({ type: 'text/csv', description: 'CSV file' })
  async exportGallery(
    @Req() req: Request,
    @Res() res: Response,
    @Query('status') status?: 'published' | 'unpublished',
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('includeBOM') includeBOM?: string,
  ) {
    this.checkAdmin(req);
    
    const l = limit ? parseInt(limit, 10) : 10000;
    const bom = includeBOM === 'true' ? true : includeBOM === 'false' ? false : true;
    
    this.logger.log(`Admin ${(req as any).user?.email} exporting gallery`);
    
    const result = await this.exportService.exportGalleryToCsv({
      status,
      type,
      limit: l,
      includeBOM: bom,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${result.filename}`);
    res.send(result.csv);
  }

  @Patch('gallery/:id/unpublish')
  @ApiOperation({ summary: '下架画廊作品' })
  async unpublishWork(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} unpublished work ${id}`);
    return await this.mutationService.unpublishWork(id);
  }

  @Delete('gallery/:id')
  @ApiOperation({ summary: '删除画廊作品' })
  async deleteWork(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} deleted work ${id}`);
    return await this.mutationService.deleteWork(id);
  }
}
