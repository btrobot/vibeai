import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional, IsObject, MinLength, MaxLength } from 'class-validator';

export enum SettingCategory {
  HOMEPAGE = 'homepage',
  SEO = 'seo',
  FEATURE = 'feature',
  GENERAL = 'general',
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
