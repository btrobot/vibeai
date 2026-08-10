import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '管理员 ID 筛选' })
  @IsOptional()
  @IsString()
  adminId?: string;

  @ApiPropertyOptional({ description: '操作类型', enum: ['create', 'update', 'delete', 'ban', 'unban', 'refund', 'export', 'update_role'] })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: '实体类型', enum: ['user', 'order', 'gallery', 'announcement', 'config', 'product', 'promo_code', 'category'] })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: '操作状态', enum: ['success', 'failed'] })
  @IsOptional()
  @IsString()
  @IsIn(['success', 'failed'])
  status?: string;
}
