import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards, HttpCode, HttpStatus, Patch, Inject } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

@Controller('gallery')
export class GalleryController {
  constructor(@Inject(GalleryService) private readonly gallery: GalleryService) {}

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
}