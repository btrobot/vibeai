import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { products, productCategories } from '../../../db/schema/commerce';
import { eq, and, desc, asc, or, ilike, sql } from 'drizzle-orm';
import type {
  CreateProductDto,
  UpdateProductDto,
  ListProductsDto,
  ProductResponseDto,
  UpdateProductStatusDto,
  UpdateProductImagesDto,
  ProductStatus,
} from '../dto/product.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Create a new product
   */
  async create(dto: CreateProductDto, userId: string): Promise<ProductResponseDto> {
    this.logger.log(`Creating product: ${dto.name} for user: ${userId}`);

    // Validate category exists
    if (dto.categoryId) {
      const category = await this.db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, dto.categoryId))
        .limit(1);

      if (category.length === 0) {
        throw new NotFoundException(`Category not found: ${dto.categoryId}`);
      }
    }

    // Validate images array
    if (!dto.images || dto.images.length === 0) {
      throw new BadRequestException('Product must have at least one image');
    }

    const [product] = await this.db
      .insert(products)
      .values({
        userId,
        name: dto.name,
        description: dto.description || null,
        categoryId: dto.categoryId || null,
        images: dto.images,
        status: dto.status || 'draft',
        metadata: dto.metadata || {},
      })
      .returning();

    this.logger.log(`Product created: ${product.id}`);
    return this.toResponseDto(product);
  }

  /**
   * Update a product
   */
  async update(id: string, dto: UpdateProductDto, userId?: string): Promise<ProductResponseDto> {
    this.logger.log(`Updating product: ${id}`);

    const product = await this.getById(id);
    if (!product) {
      throw new NotFoundException(`Product not found: ${id}`);
    }

    // Check permission if userId provided
    if (userId && product.userId !== userId) {
      throw new BadRequestException('You do not have permission to update this product');
    }

    // Validate category exists if updating
    if (dto.categoryId) {
      const category = await this.db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, dto.categoryId))
        .limit(1);

      if (category.length === 0) {
        throw new NotFoundException(`Category not found: ${dto.categoryId}`);
      }
    }

    const updateData: any = {
      ...dto,
      updatedAt: new Date(),
    };

    const [updated] = await this.db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    this.logger.log(`Product updated: ${id}`);
    return this.toResponseDto(updated);
  }

  /**
   * Delete a product (soft delete)
   */
  async delete(id: string, userId?: string): Promise<void> {
    this.logger.log(`Deleting product: ${id}`);

    const product = await this.getById(id);
    if (!product) {
      throw new NotFoundException(`Product not found: ${id}`);
    }

    // Check permission if userId provided
    if (userId && product.userId !== userId) {
      throw new BadRequestException('You do not have permission to delete this product');
    }

    // Soft delete by setting status to archived
    await this.db
      .update(products)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    this.logger.log(`Product deleted (archived): ${id}`);
  }

  /**
   * Permanently delete a product
   */
  async permanentDelete(id: string, userId?: string): Promise<void> {
    this.logger.log(`Permanently deleting product: ${id}`);

    const product = await this.getById(id);
    if (!product) {
      throw new NotFoundException(`Product not found: ${id}`);
    }

    // Check permission if userId provided
    if (userId && product.userId !== userId) {
      throw new BadRequestException('You do not have permission to delete this product');
    }

    await this.db.delete(products).where(eq(products.id, id));

    this.logger.log(`Product permanently deleted: ${id}`);
  }

  /**
   * List products with pagination and filtering
   */
  async list(dto: ListProductsDto): Promise<{ items: ProductResponseDto[]; total: number }> {
    const { page = 1, pageSize = 20, categoryId, status, userId, search } = dto;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (categoryId !== undefined) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (status !== undefined) {
      conditions.push(eq(products.status, status));
    }

    if (userId !== undefined) {
      conditions.push(eq(products.userId, userId));
    }

    if (search) {
      conditions.push(or(ilike(products.name, `%${search}%`), ilike(products.description || '', `%${search}%`)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    // Get items with category info
    const items = await this.db
      .select({
        product: products,
        category: {
          id: productCategories.id,
          name: productCategories.name,
          slug: productCategories.slug,
        },
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((item) => this.toResponseDto({ ...item.product, category: item.category })),
      total,
    };
  }

  /**
   * Get product by ID
   */
  async getById(id: string): Promise<ProductResponseDto | null> {
    const [result] = await this.db
      .select({
        product: products,
        category: {
          id: productCategories.id,
          name: productCategories.name,
          slug: productCategories.slug,
        },
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(eq(products.id, id))
      .limit(1);

    if (!result) {
      return null;
    }

    return this.toResponseDto({ ...result.product, category: result.category });
  }

  /**
   * Search products by name or description
   */
  async search(query: string, filters?: { categoryId?: string; status?: ProductStatus }): Promise<{
    items: ProductResponseDto[];
    total: number;
  }> {
    const conditions = [
      or(ilike(products.name, `%${query}%`), ilike(products.description || '', `%${query}%`)),
    ];

    if (filters?.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }

    if (filters?.status) {
      conditions.push(eq(products.status, filters.status));
    }

    const whereClause = and(...conditions);

    const items = await this.db
      .select({
        product: products,
        category: {
          id: productCategories.id,
          name: productCategories.name,
          slug: productCategories.slug,
        },
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(50);

    return {
      items: items.map((item) => this.toResponseDto({ ...item.product, category: item.category })),
      total: items.length,
    };
  }

  /**
   * Update product status
   */
  async updateStatus(id: string, dto: UpdateProductStatusDto, userId?: string): Promise<ProductResponseDto> {
    this.logger.log(`Updating product status: ${id} to ${dto.status}`);

    const product = await this.getById(id);
    if (!product) {
      throw new NotFoundException(`Product not found: ${id}`);
    }

    // Check permission if userId provided
    if (userId && product.userId !== userId) {
      throw new BadRequestException('You do not have permission to update this product');
    }

    const [updated] = await this.db
      .update(products)
      .set({
        status: dto.status,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return this.toResponseDto(updated);
  }

  /**
   * Update product images
   */
  async updateImages(id: string, dto: UpdateProductImagesDto, userId?: string): Promise<ProductResponseDto> {
    this.logger.log(`Updating product images: ${id}`);

    const product = await this.getById(id);
    if (!product) {
      throw new NotFoundException(`Product not found: ${id}`);
    }

    // Check permission if userId provided
    if (userId && product.userId !== userId) {
      throw new BadRequestException('You do not have permission to update this product');
    }

    // Validate images array
    if (!dto.images || dto.images.length === 0) {
      throw new BadRequestException('Product must have at least one image');
    }

    const [updated] = await this.db
      .update(products)
      .set({
        images: dto.images,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return this.toResponseDto(updated);
  }

  /**
   * Get products by user ID
   */
  async getByUserId(userId: string, page: number = 1, pageSize: number = 20): Promise<{
    items: ProductResponseDto[];
    total: number;
  }> {
    const offset = (page - 1) * pageSize;

    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.userId, userId));

    const total = Number(totalResult?.count || 0);

    const items = await this.db
      .select({
        product: products,
        category: {
          id: productCategories.id,
          name: productCategories.name,
          slug: productCategories.slug,
        },
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(eq(products.userId, userId))
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((item) => this.toResponseDto({ ...item.product, category: item.category })),
      total,
    };
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(product: any): ProductResponseDto {
    return {
      id: product.id,
      userId: product.userId,
      name: product.name,
      description: product.description || undefined,
      categoryId: product.categoryId || undefined,
      images: product.images || [],
      status: product.status,
      metadata: product.metadata || {},
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      category: product.category || undefined,
    };
  }
}
