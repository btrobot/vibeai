import {
  Controller,
  Get,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminAuditService } from './services/admin-audit.service';
import { AuditLogQueryDto } from './dto/admin-audit.dto';

@ApiTags('admin')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: '获取审计日志列表' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'adminId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: '审计日志列表' })
  async list(@Query() query: AuditLogQueryDto) {
    return this.auditService.list(query);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取审计日志统计' })
  @ApiResponse({ status: 200, description: '审计日志统计' })
  async stats() {
    return this.auditService.getStats();
  }
}
