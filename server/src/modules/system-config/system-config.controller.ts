import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { SystemConfigService } from './system-config.service';
import { UpsertSettingDto, SettingQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('system-config')
@Controller('system-config')
export class SystemConfigController {
  private readonly logger = new Logger(SystemConfigController.name);

  constructor(private readonly configService: SystemConfigService) {}

  /**
   * 公开：获取公开配置列表
   */
  @Get('public')
  @ApiOperation({ summary: '获取公开系统配置（公开）' })
  async listPublic(@Query('category') category?: string) {
    return this.configService.listPublic(category);
  }

  /**
   * 公开：获取单个配置
   */
  @Get('public/:key')
  @ApiOperation({ summary: '获取单个配置（公开）' })
  async getByKey(@Param('key') key: string) {
    return this.configService.getByKey(key);
  }

  /**
   * 管理员：获取所有配置
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：获取所有配置' })
  async listForAdmin(@Query() query: SettingQueryDto, @Req() req: Request) {
    this.checkAdmin(req);
    return this.configService.listForAdmin(query);
  }

  /**
   * 管理员：创建或更新配置
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：创建或更新配置' })
  @ApiResponse({ status: 201, description: '配置创建/更新成功' })
  async upsert(@Body() dto: UpsertSettingDto, @Req() req: Request) {
    this.checkAdmin(req);
    return this.configService.upsert(dto);
  }

  /**
   * 管理员：删除配置
   */
  @Delete(':key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：删除配置' })
  async delete(@Param('key') key: string, @Req() req: Request) {
    this.checkAdmin(req);
    return this.configService.delete(key);
  }

  private checkAdmin(req: Request) {
    const user = (req as any).user;
    if (user?.role !== 'admin') {
      throw new Error('无权限访问');
    }
    return user as { userId: string; role: string };
  }
}
