import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseUUIDPipe,
  Req,
  Res,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from './storage.service';
import { uploadFileSchema, listFilesQuerySchema } from './dto';
import type { Request, Response } from 'express';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(@Inject('STORAGE_SERVICE') private readonly storageService: StorageService) {}

  /**
   * Serve a stored file by its storage key (path).
   * Public endpoint — no auth required (for displaying generated images/videos).
   * URL format: /api/storage/serve/users/{userId}/generated/{filename}
   */
  @Get('serve/*splat')
  async serveFile(@Param('splat') splat: string | string[], @Res() res: Response) {
    const key = Array.isArray(splat) ? splat.join('/') : splat;
    try {
      const result = await this.storageService.readFile(key);
      if (!result) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(result.data);
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 20) * 1024 * 1024 } }))
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, string>,
    @Req() req: Request,
  ) {
    const input = uploadFileSchema.parse({
      category: body.category || 'temp',
      isPublic: body.isPublic === 'true',
    });

    const userId = (req as any).user.userId;
    return this.storageService.uploadFile(userId, file, input);
  }

  @Get('files')
  @UseGuards(JwtAuthGuard)
  async listFiles(
    @Query() query: Record<string, string>,
    @Req() req: Request,
  ) {
    const parsed = listFilesQuerySchema.parse(query);
    const userId = (req as any).user.userId;
    return this.storageService.listFiles(userId, parsed);
  }

  @Get('files/:id')
  @UseGuards(JwtAuthGuard)
  async getFileDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId;
    const file = await this.storageService.getFileDetail(userId, id);
    if (!file) {
      return { error: 'File not found' };
    }
    return file;
  }

  @Delete('files/:id')
  @UseGuards(JwtAuthGuard)
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId;
    const deleted = await this.storageService.deleteFile(userId, id);
    if (!deleted) {
      return { error: 'File not found or access denied' };
    }
    return { success: true };
  }

  @Get('files/:id/signed-url')
  @UseGuards(JwtAuthGuard)
  async getSignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId;
    const url = await this.storageService.getSignedUrl(userId, id);
    if (!url) {
      return { error: 'File not found' };
    }
    return { url };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: Request) {
    const userId = (req as any).user.userId;
    return this.storageService.getStorageStats(userId);
  }
}
