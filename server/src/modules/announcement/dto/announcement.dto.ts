import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export enum AnnouncementType {
  INFO = 'info',
  WARNING = 'warning',
  MAINTENANCE = 'maintenance',
}

export class CreateAnnouncementDto {
  @ApiProperty({ example: '系统维护通知', description: '公告标题' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: '系统将于今晚 22:00-23:00 进行维护', description: '公告内容' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiProperty({ enum: AnnouncementType, default: 'info', description: '公告类型' })
  @IsEnum(AnnouncementType)
  type!: AnnouncementType;

  @ApiPropertyOptional({ default: true, description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false, description: '是否置顶' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: '定时发布时间 (ISO 8601)', example: '2026-08-11T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: '过期时间 (ISO 8601)', example: '2026-08-20T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ description: '公告标题' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '公告内容' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @ApiPropertyOptional({ enum: AnnouncementType, description: '公告类型' })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '是否置顶' })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ description: '定时发布时间' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ description: '过期时间' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AnnouncementQueryDto {
  @ApiPropertyOptional({ description: '过滤类型' })
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @ApiPropertyOptional({ description: '仅活跃', default: false })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsString()
  limit?: string;
}
