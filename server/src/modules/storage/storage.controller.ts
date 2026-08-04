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
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from './storage.service';
import { uploadFileSchema, listFilesQuerySchema } from './dto';
import type { Request } from 'express';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(@Inject(StorageService) private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
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
  async listFiles(
    @Query() query: Record<string, string>,
    @Req() req: Request,
  ) {
    const parsed = listFilesQuerySchema.parse(query);
    const userId = (req as any).user.userId;
    return this.storageService.listFiles(userId, parsed);
  }

  @Get('files/:id')
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
  async getStats(@Req() req: Request) {
    const userId = (req as any).user.userId;
    return this.storageService.getStorageStats(userId);
  }
}