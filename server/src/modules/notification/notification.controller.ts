import { Inject, Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(@Inject(NotificationService) private readonly service: NotificationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const items = await this.service.listForUser(user.id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
    return { success: true, data: { items, total: items.length } };
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async unreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.service.unreadCount(user.id);
    return { success: true, data: { count } };
  }

  @Post(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const result = await this.service.markRead(user.id, id);
    return { success: true, data: result };
  }

  @Post('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async markAllRead(@CurrentUser() user: JwtPayload) {
    const result = await this.service.markAllRead(user.id);
    return { success: true, data: result };
  }
}