import { Controller, Get, Post, Param, Query, Req, UseGuards, Inject } from '@nestjs/common';
import { CreateService } from './create.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class CreateController {
  constructor(@Inject(CreateService) private readonly createService: CreateService) {}

  @Get('creates')
  async listAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.createService.listAllCreates(req.user.userId, {
      status,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
    });
    return { success: true, data: result };
  }

  @Get('projects/:projectId/creates')
  async list(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.createService.listCreates(projectId, req.user.userId, {
      status,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 50)),
    });
    return { success: true, data: result };
  }

  @Get('creates/:id')
  async getById(@Req() req: any, @Param('id') id: string) {
    const create = await this.createService.getCreate(id, req.user.userId);
    return { success: true, data: create };
  }

  @Post('creates/:id/retry')
  async retry(@Req() req: any, @Param('id') id: string) {
    const create = await this.createService.retryCreate(id, req.user.userId);
    return { success: true, data: create };
  }
}
