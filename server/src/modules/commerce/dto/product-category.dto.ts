import { IsString, IsOptional, IsUUID, IsBoolean, IsObject, IsInt, Min, IsArray, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for creating a product category
 */
export class CreateProductCategoryDto {
  @ApiProperty({ example: '服装', description: '分类名称' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent-category', description: '父分类 ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: 'clothing', description: 'URL 友好的唯一标识' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: '👔', description: '分类图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    example: { size: ['S', 'M', 'L', 'XL'], color: ['红', '蓝', '黑'] },
    description: '分类属性定义'
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ example: 0, description: '排序顺序' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/**
 * DTO for updating a product category
 */
export class UpdateProductCategoryDto {
  @ApiPropertyOptional({ example: '服装', description: '分类名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent-category', description: '父分类 ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: 'clothing', description: 'URL 友好的唯一标识' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: '👔', description: '分类图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    example: { size: ['S', 'M', 'L', 'XL'], color: ['红', '蓝', '黑'] },
    description: '分类属性定义'
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ example: 0, description: '排序顺序' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: true, description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for listing product categories
 */
export class ListProductCategoriesDto {
  @ApiPropertyOptional({ example: 1, description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ example: true, description: '筛选激活状态' })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'uuid-of-parent-category', description: '筛选父分类' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: '服装', description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * DTO for updating category attributes
 */
export class UpdateCategoryAttributesDto {
  @ApiProperty({
    example: { size: ['S', 'M', 'L', 'XL'], color: ['红', '蓝', '黑'], material: ['棉', '涤纶'] },
    description: '分类属性定义'
  })
  @IsObject()
  attributes!: Record<string, any>;
}

/**
 * Response DTO for product category
 */
export class ProductCategoryResponseDto {
  @ApiProperty({ example: 'uuid', description: '分类 ID' })
  id!: string;

  @ApiProperty({ example: '服装', description: '分类名称' })
  name!: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent', description: '父分类 ID' })
  parentId?: string;

  @ApiProperty({ example: 'clothing', description: 'URL slug' })
  slug!: string;

  @ApiPropertyOptional({ example: '👔', description: '分类图标' })
  icon?: string;

  @ApiProperty({ example: { size: ['S', 'M'] }, description: '分类属性' })
  attributes!: Record<string, any>;

  @ApiProperty({ example: 0, description: '排序顺序' })
  sortOrder!: number;

  @ApiProperty({ example: true, description: '是否激活' })
  isActive!: boolean;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '创建时间' })
  createdAt!: string;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '更新时间' })
  updatedAt!: string;
}

/**
 * Response DTO for category tree structure
 */
export class ProductCategoryTreeResponseDto {
  @ApiProperty({ example: 'uuid', description: '分类 ID' })
  id!: string;

  @ApiProperty({ example: '服装', description: '分类名称' })
  name!: string;

  @ApiPropertyOptional({ example: 'uuid-of-parent', description: '父分类 ID' })
  parentId?: string;

  @ApiProperty({ example: 'clothing', description: 'URL slug' })
  slug!: string;

  @ApiPropertyOptional({ example: '👔', description: '分类图标' })
  icon?: string;

  @ApiProperty({ example: { size: ['S', 'M'] }, description: '分类属性' })
  attributes!: Record<string, any>;

  @ApiProperty({ example: 0, description: '排序顺序' })
  sortOrder!: number;

  @ApiProperty({ example: true, description: '是否激活' })
  isActive!: boolean;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '创建时间' })
  createdAt!: string;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '更新时间' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: [ProductCategoryTreeResponseDto], description: '子分类' })
  children?: ProductCategoryTreeResponseDto[];
}
