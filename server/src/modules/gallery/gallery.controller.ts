import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus, Patch, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GalleryService } from './gallery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  constructor(@Inject('GALLERY_SERVICE') private readonly gallery: GalleryService) {}

  @Get('works')
  async listWorks(
    @Query('type') type?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gallery.listWorks({
      type,
      sort,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('works/:id')
  async getWork(@Param('id') id: string) {
    return this.gallery.getWork(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('works')
  async publishWork(@Req() req: Request, @Body() input: any) {
    const userId = (req as any).user.userId;
    return this.gallery.publishWork(userId, input);
  }

  @UseGuards(JwtAuthGuard)
  @Post('works/:id/like')
  @HttpCode(HttpStatus.OK)
  async toggleLike(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user.userId;
    return this.gallery.toggleLike(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('works/:id/like')
  async checkLike(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user.userId;
    return this.gallery.checkLike(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('works/:id')
  @HttpCode(HttpStatus.OK)
  async deleteWork(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user.userId;
    return this.gallery.deleteWork(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-works')
  async myWorks(@Req() req: Request) {
    const userId = (req as any).user.userId;
    return this.gallery.listWorks({ userId });
  }
  // ===== Gallery Publication (Admin) =====

  @UseGuards(JwtAuthGuard)
  @Post('works/:id/publish')
  @ApiOperation({ summary: '管理员：发布作品到公开画廊' })
  async publishToGallery(@Param('id') id: string, @Body() body: { isFeatured?: boolean; featuredOrder?: number; expiresAt?: string }, @Req() req: Request) {
    this.checkAdmin(req);
    return this.gallery.publishWorkToGallery(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('works/:id/publish')
  @ApiOperation({ summary: '管理员：从公开画廊下架作品' })
  async unpublishFromGallery(@Param('id') id: string, @Req() req: Request) {
    this.checkAdmin(req);
    return this.gallery.unpublishFromGallery(id);
  }

  @Get('featured')
  @ApiOperation({ summary: '获取推荐作品' })
  async listFeatured(@Query('limit') limit?: string) {
    return this.gallery.listFeaturedWorks(limit ? parseInt(limit) : undefined);
  }

  private checkAdmin(req: Request) {
    const user = (req as any).user;
    if (user?.role !== 'admin') {
      throw new Error('无权限访问');
    }
  }
}
