import { IsString, IsOptional, IsUUID, IsArray, IsEnum, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Product status enum
 */
export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/**
 * DTO for creating a product
 */
export class CreateProductDto {
  @ApiProperty({ example: '时尚T恤', description: '商品名称' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: '优质纯棉T恤，舒适透气', description: '商品描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'uuid-of-category', description: '分类 ID' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: ['file-id-1', 'file-id-2'], description: '图片文件 ID 列表' })
  @IsArray()
  @IsUUID('4', { each: true })
  images!: string[];

  @ApiPropertyOptional({
    example: { brand: 'Nike', material: 'Cotton', size: ['S', 'M', 'L'] },
    description: '商品元数据'
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 'draft', description: '商品状态', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

/**
 * DTO for updating a product
 */
export class UpdateProductDto {
  @ApiPropertyOptional({ example: '时尚T恤', description: '商品名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: '优质纯棉T恤，舒适透气', description: '商品描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'uuid-of-category', description: '分类 ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: ['file-id-1', 'file-id-2'], description: '图片文件 ID 列表' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  images?: string[];

  @ApiPropertyOptional({
    example: { brand: 'Nike', material: 'Cotton', size: ['S', 'M', 'L'] },
    description: '商品元数据'
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 'active', description: '商品状态', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

/**
 * DTO for updating product status
 */
export class UpdateProductStatusDto {
  @ApiProperty({ example: 'active', description: '商品状态', enum: ProductStatus })
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}

/**
 * DTO for updating product images
 */
export class UpdateProductImagesDto {
  @ApiProperty({ example: ['file-id-1', 'file-id-2'], description: '图片文件 ID 列表' })
  @IsArray()
  @IsUUID('4', { each: true })
  images!: string[];
}

/**
 * DTO for listing products
 */
export class ListProductsDto {
  @ApiPropertyOptional({ example: 1, description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 20;

  @ApiPropertyOptional({ example: 'uuid-of-category', description: '筛选分类' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'active', description: '筛选状态', enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: 'uuid-of-user', description: '筛选用户' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'T恤', description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Response DTO for product
 */
export class ProductResponseDto {
  @ApiProperty({ example: 'uuid', description: '商品 ID' })
  id!: string;

  @ApiProperty({ example: 'uuid-of-user', description: '用户 ID' })
  userId!: string;

  @ApiProperty({ example: '时尚T恤', description: '商品名称' })
  name!: string;

  @ApiPropertyOptional({ example: '优质纯棉T恤', description: '商品描述' })
  description?: string;

  @ApiPropertyOptional({ example: 'uuid-of-category', description: '分类 ID' })
  categoryId?: string;

  @ApiProperty({ example: ['file-id-1', 'file-id-2'], description: '图片文件 ID 列表' })
  images!: string[];

  @ApiProperty({ example: 'draft', description: '商品状态', enum: ProductStatus })
  status!: ProductStatus;

  @ApiProperty({ example: { brand: 'Nike' }, description: '商品元数据' })
  metadata!: Record<string, any>;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '创建时间' })
  createdAt!: string;

  @ApiProperty({ example: '2026-08-10T10:00:00.000Z', description: '更新时间' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: Object, description: '分类信息' })
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Response DTO for product list
 */
export class ProductListResponseDto {
  @ApiProperty({ type: [ProductResponseDto], description: '商品列表' })
  items!: ProductResponseDto[];

  @ApiProperty({ example: 100, description: '总数' })
  total!: number;
}
