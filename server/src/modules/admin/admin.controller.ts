import { Controller, Get, UseGuards, Req, Logger, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(@Inject('ADMIN_SERVICE') private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats(@Req() req: Request) {
    const user = (req as any).user;
    if (user?.role !== 'admin') {
      return { success: false, error: '无权限访问', statusCode: 403 };
    }
    try {
      const stats = await this.adminService.getStats();
      return stats;
    } catch (e) {
      this.logger.error('获取管理统计失败', e);
      return { success: false, error: '获取统计失败', statusCode: 500 };
    }
  }
}