import { Controller, Get, Post, Param, Query, Req, UseGuards, ParseUUIDPipe, Inject } from '@nestjs/common';
import { TaskService } from './task.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(@Inject(TaskService) private readonly taskService: TaskService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const result = await this.taskService.listTasks(req.user.userId, {
      projectId,
      status,
      type,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
    });
    return { success: true, data: result };
  }

  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    const task = await this.taskService.getTask(id, req.user.userId);
    return { success: true, data: task };
  }

  @Post(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    const task = await this.taskService.cancelTask(id, req.user.userId);
    return { success: true, data: task };
  }

  @Post(':id/retry')
  async retry(@Req() req: any, @Param('id') id: string) {
    const task = await this.taskService.retryTask(id, req.user.userId);
    return { success: true, data: task };
  }

  @Get(':id/states')
  async getExecutionStates(@Req() req: any, @Param('id') id: string) {
    // Verify ownership first
    await this.taskService.getTask(id, req.user.userId);
    const states = await this.taskService.getExecutionStates(id);
    return { success: true, data: states };
  }
}