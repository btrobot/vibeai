import { Controller, Get, Patch, Delete, Query, Param, Body, UseGuards, Req, Logger, Inject, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(@Inject('ADMIN_SERVICE') private readonly adminService: AdminService) {}

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
    return await this.adminService.getStats();
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
    return await this.adminService.getUsers(p, l, search);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: '封禁用户' })
  async banUser(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} banned user ${id}`);
    return await this.adminService.banUser(id);
  }

  @Patch('users/:id/unban')
  @ApiOperation({ summary: '解封用户' })
  async unbanUser(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} unbanned user ${id}`);
    return await this.adminService.unbanUser(id);
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
    return await this.adminService.updateUserRole(id, role);
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
    return await this.adminService.getGalleryWorks(p, l, status);
  }

  @Patch('gallery/:id/unpublish')
  @ApiOperation({ summary: '下架画廊作品' })
  async unpublishWork(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} unpublished work ${id}`);
    return await this.adminService.unpublishWork(id);
  }

  @Delete('gallery/:id')
  @ApiOperation({ summary: '删除画廊作品' })
  async deleteWork(@Req() req: Request, @Param('id') id: string) {
    this.checkAdmin(req);
    this.logger.log(`Admin ${(req as any).user?.email} deleted work ${id}`);
    return await this.adminService.deleteWork(id);
  }
}
