import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto, AnnouncementQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementController {
  private readonly logger = new Logger(AnnouncementController.name);

  constructor(private readonly announcementService: AnnouncementService) {}

  /**
   * 公开：获取当前生效的公告列表
   */
  @Get('active')
  @ApiOperation({ summary: '获取当前生效的公告（公开）' })
  async listActive() {
    return this.announcementService.listActive();
  }

  /**
   * 公开：获取单条公告
   */
  @Get(':id')
  @ApiOperation({ summary: '获取公告详情' })
  async getById(@Param('id') id: string) {
    return this.announcementService.getById(id);
  }

  /**
   * 管理员：获取公告列表（含未发布）
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：获取公告列表' })
  async listForAdmin(@Query() query: AnnouncementQueryDto, @Req() req: Request) {
    this.checkAdmin(req);
    return this.announcementService.listForAdmin(query);
  }

  /**
   * 管理员：创建公告
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：创建公告' })
  @ApiResponse({ status: 201, description: '公告创建成功' })
  async create(@Body() dto: CreateAnnouncementDto, @Req() req: Request) {
    const user = this.checkAdmin(req);
    return this.announcementService.create(dto, user.userId);
  }

  /**
   * 管理员：更新公告
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：更新公告' })
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto, @Req() req: Request) {
    this.checkAdmin(req);
    return this.announcementService.update(id, dto);
  }

  /**
   * 管理员：删除公告
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '管理员：删除公告' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    this.checkAdmin(req);
    return this.announcementService.delete(id);
  }

  private checkAdmin(req: Request) {
    const user = (req as any).user;
    if (user?.role !== 'admin') {
      throw new Error('无权限访问');
    }
    return user as { userId: string; role: string };
  }
}
