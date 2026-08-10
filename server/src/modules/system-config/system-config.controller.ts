import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, Logger, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SystemConfigService } from './system-config.service';
import { UpsertSettingDto, SettingQueryDto, ImportSettingsDto, TestEmailDto } from './dto';
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
   * 管理员：导出所有配置
   */
  @Get('export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：导出所有配置' })
  async exportAll(@Req() req: Request, @Res() res: Response) {
    this.checkAdmin(req);
    const result = await this.configService.exportAll();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="system-config-export.json"');
    res.json(result);
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
   * 管理员：批量导入配置
   */
  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：批量导入配置' })
  @ApiResponse({ status: 201, description: '导入完成' })
  async importAll(@Body() dto: ImportSettingsDto, @Req() req: Request) {
    this.checkAdmin(req);
    return this.configService.importAll(dto);
  }

  /**
   * 管理员：测试邮件连通性
   */
  @Post('test-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：测试邮件连通性' })
  async testEmail(@Body() dto: TestEmailDto, @Req() req: Request) {
    this.checkAdmin(req);
    return this.configService.testEmail(dto.to);
  }

  /**
   * 管理员：测试存储连通性
   */
  @Post('test-storage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：测试存储连通性' })
  async testStorage(@Req() req: Request) {
    this.checkAdmin(req);
    return this.configService.testStorage();
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
    const user = (req as unknown as { user?: { role?: string } }).user;
    if (user?.role !== 'admin') {
      throw new Error('无权限访问');
    }
    return user as { userId: string; role: string };
  }
}
