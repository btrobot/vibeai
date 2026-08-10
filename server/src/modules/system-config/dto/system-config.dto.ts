import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional, IsObject, IsArray, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum SettingCategory {
  HOMEPAGE = 'homepage',
  SEO = 'seo',
  FEATURE = 'feature',
  GENERAL = 'general',
  SITE = 'site',
  REGISTER = 'register',
  SECURITY = 'security',
  AI = 'ai',
  EMAIL = 'email',
  STORAGE = 'storage',
  PAYMENT = 'payment',
}

export class UpsertSettingDto {
  @ApiProperty({ example: 'homepage.carousel', description: '配置键' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @ApiProperty({ example: { items: [{ imageUrl: '...', link: '/gallery' }] }, description: '配置值 (JSON)' })
  @IsObject()
  value!: Record<string, unknown>;

  @ApiProperty({ enum: SettingCategory, default: 'general', description: '配置分类' })
  @IsEnum(SettingCategory)
  category!: SettingCategory;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true, description: '是否允许未登录用户读取' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class SettingQueryDto {
  @ApiPropertyOptional({ enum: SettingCategory, description: '按分类筛选' })
  @IsOptional()
  @IsEnum(SettingCategory)
  category?: SettingCategory;
}

export class ImportSettingItemDto {
  @ApiProperty({ description: '配置键' })
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty({ description: '配置值 (JSON)' })
  @IsObject()
  value!: Record<string, unknown>;

  @ApiProperty({ enum: SettingCategory, description: '配置分类' })
  @IsEnum(SettingCategory)
  category!: SettingCategory;

  @ApiPropertyOptional({ description: '配置描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true, description: '是否公开' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class ImportSettingsDto {
  @ApiProperty({ description: '配置列表', type: [ImportSettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSettingItemDto)
  settings!: ImportSettingItemDto[];
}

export class TestEmailDto {
  @ApiProperty({ example: 'admin@vibeai.com', description: '测试收件邮箱' })
  @IsString()
  to!: string;
}
