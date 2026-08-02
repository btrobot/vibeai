import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProjectSchema, UpdateProjectSchema } from '../../shared-types';
import type { CreateProjectInput, UpdateProjectInput } from '../../shared-types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body(new ZodValidationPipe(CreateProjectSchema)) body: CreateProjectInput) {
    const project = await this.projectService.create(req.user.userId, body);
    return { success: true, data: project };
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.projectService.list(
      req.user.userId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 20)),
    );
    return { success: true, data: result };
  }

  @Get(':id')
  async getById(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const project = await this.projectService.getById(id, req.user.userId);
    return { success: true, data: project };
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateProjectSchema)) body: UpdateProjectInput,
  ) {
    const project = await this.projectService.update(id, req.user.userId, body);
    return { success: true, data: project };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    await this.projectService.delete(id, req.user.userId);
  }
}