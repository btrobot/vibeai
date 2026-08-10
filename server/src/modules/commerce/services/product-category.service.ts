import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../db/schema';
import { productCategories, products } from '../../../db/schema/commerce';
import { eq, and, desc, asc, or, ilike, sql } from 'drizzle-orm';
import type {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  ListProductCategoriesDto,
  ProductCategoryResponseDto,
  ProductCategoryTreeResponseDto,
  UpdateCategoryAttributesDto,
} from '../dto/product-category.dto';

@Injectable()
export class ProductCategoryService {
  private readonly logger = new Logger(ProductCategoryService.name);

  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Create a new product category
   */
  async create(dto: CreateProductCategoryDto, userId: string): Promise<ProductCategoryResponseDto> {
    this.logger.log(`Creating category: ${dto.name}`);

    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug already exists
    const existing = await this.db
      .select()
      .from(productCategories)
      .where(eq(productCategories.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Category with slug "${slug}" already exists`);
    }

    // If parent is provided, validate it exists and prevent cycles
    if (dto.parentId) {
      await this.validateNoCycle(dto.parentId, null);
    }

    const [category] = await this.db
      .insert(productCategories)
      .values({
        name: dto.name,
        parentId: dto.parentId || null,
        slug,
        icon: dto.icon || null,
        attributes: dto.attributes || {},
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      })
      .returning();

    this.logger.log(`Category created: ${category.id}`);
    return this.toResponseDto(category);
  }

  /**
   * Update a product category
   */
  async update(id: string, dto: UpdateProductCategoryDto): Promise<ProductCategoryResponseDto> {
    this.logger.log(`Updating category: ${id}`);

    const category = await this.getById(id);
    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    // If updating slug, check for conflicts
    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.db
        .select()
        .from(productCategories)
        .where(and(eq(productCategories.slug, dto.slug), sql`${productCategories.id} != ${id}`))
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
      }
    }

    // If updating parent, validate no cycles
    if (dto.parentId && dto.parentId !== category.parentId) {
      await this.validateNoCycle(dto.parentId, id);
    }

    const updateData: any = {
      ...dto,
      updatedAt: new Date(),
    };

    const [updated] = await this.db
      .update(productCategories)
      .set(updateData)
      .where(eq(productCategories.id, id))
      .returning();

    this.logger.log(`Category updated: ${id}`);
    return this.toResponseDto(updated);
  }

  /**
   * Delete a product category
   */
  async delete(id: string, force: boolean = false): Promise<void> {
    this.logger.log(`Deleting category: ${id}`);

    const category = await this.getById(id);
    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    // Check if has children
    const children = await this.db
      .select()
      .from(productCategories)
      .where(eq(productCategories.parentId, id))
      .limit(1);

    if (children.length > 0 && !force) {
      throw new BadRequestException('Cannot delete category with subcategories. Use force=true to delete with children.');
    }

    // Check if has products
    const categoryProducts = await this.db
      .select()
      .from(products)
      .where(eq(products.categoryId, id))
      .limit(1);

    if (categoryProducts.length > 0 && !force) {
      throw new BadRequestException('Cannot delete category with products. Move products first or use force=true.');
    }

    // If force, delete children recursively (cascade handled by DB)
    await this.db.delete(productCategories).where(eq(productCategories.id, id));

    this.logger.log(`Category deleted: ${id}`);
  }

  /**
   * List categories with pagination and filtering
   */
  async list(dto: ListProductCategoriesDto): Promise<{ items: ProductCategoryResponseDto[]; total: number }> {
    const { page = 1, pageSize = 20, isActive, parentId, search } = dto;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (isActive !== undefined) {
      conditions.push(eq(productCategories.isActive, isActive));
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        conditions.push(sql`${productCategories.parentId} IS NULL`);
      } else {
        conditions.push(eq(productCategories.parentId, parentId));
      }
    }

    if (search) {
      conditions.push(
        or(ilike(productCategories.name, `%${search}%`), ilike(productCategories.slug, `%${search}%`))
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productCategories)
      .where(whereClause);

    const total = Number(totalResult?.count || 0);

    // Get items
    const items = await this.db
      .select()
      .from(productCategories)
      .where(whereClause)
      .orderBy(asc(productCategories.sortOrder), desc(productCategories.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: items.map((item) => this.toResponseDto(item)),
      total,
    };
  }

  /**
   * Get category by ID
   */
  async getById(id: string): Promise<ProductCategoryResponseDto | null> {
    const [category] = await this.db.select().from(productCategories).where(eq(productCategories.id, id)).limit(1);

    if (!category) {
      return null;
    }

    return this.toResponseDto(category);
  }

  /**
   * Get category by slug
   */
  async getBySlug(slug: string): Promise<ProductCategoryResponseDto | null> {
    const [category] = await this.db
      .select()
      .from(productCategories)
      .where(eq(productCategories.slug, slug))
      .limit(1);

    if (!category) {
      return null;
    }

    return this.toResponseDto(category);
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async getTree(activeOnly: boolean = true): Promise<ProductCategoryTreeResponseDto[]> {
    const conditions = activeOnly ? [eq(productCategories.isActive, true)] : [];

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all categories
    const allCategories = await this.db
      .select()
      .from(productCategories)
      .where(whereClause)
      .orderBy(asc(productCategories.sortOrder), desc(productCategories.createdAt));

    // Build tree structure
    const categoryMap = new Map<string, ProductCategoryTreeResponseDto>();
    const rootCategories: ProductCategoryTreeResponseDto[] = [];

    // First pass: create map
    for (const category of allCategories) {
      categoryMap.set(category.id, {
        ...this.toResponseDto(category),
        children: [],
      } as ProductCategoryTreeResponseDto);
    }

    // Second pass: build hierarchy
    for (const category of allCategories) {
      const node = categoryMap.get(category.id)!;

      if (!category.parentId) {
        rootCategories.push(node);
      } else {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      }
    }

    return rootCategories;
  }

  /**
   * Update category attributes
   */
  async updateAttributes(id: string, dto: UpdateCategoryAttributesDto): Promise<ProductCategoryResponseDto> {
    this.logger.log(`Updating category attributes: ${id}`);

    const category = await this.getById(id);
    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    const [updated] = await this.db
      .update(productCategories)
      .set({
        attributes: dto.attributes,
        updatedAt: new Date(),
      })
      .where(eq(productCategories.id, id))
      .returning();

    return this.toResponseDto(updated);
  }

  /**
   * Toggle category active status
   */
  async toggleActive(id: string): Promise<ProductCategoryResponseDto> {
    this.logger.log(`Toggling category active status: ${id}`);

    const category = await this.getById(id);
    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    const [updated] = await this.db
      .update(productCategories)
      .set({
        isActive: !category.isActive,
        updatedAt: new Date(),
      })
      .where(eq(productCategories.id, id))
      .returning();

    this.logger.log(`Category ${id} active status toggled to ${updated.isActive}`);
    return this.toResponseDto(updated);
  }

  /**
   * Validate that setting parentId won't create a cycle
   */
  private async validateNoCycle(parentId: string, categoryId: string | null): Promise<void> {
    let currentId = parentId;
    const visited = new Set<string>();
    const maxDepth = 100; // Prevent infinite loops
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (currentId === categoryId) {
        throw new BadRequestException('Cannot create circular category reference');
      }

      if (visited.has(currentId)) {
        throw new BadRequestException('Circular category reference detected');
      }

      visited.add(currentId);

      const [parent] = await this.db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, currentId))
        .limit(1);

      if (!parent) {
        break;
      }

      currentId = parent.parentId || '';
      depth++;
    }

    if (depth >= maxDepth) {
      throw new BadRequestException('Category hierarchy too deep');
    }
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36)
    );
  }

  /**
   * Convert database model to response DTO
   */
  private toResponseDto(category: any): ProductCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parentId || undefined,
      slug: category.slug,
      icon: category.icon || undefined,
      attributes: category.attributes || {},
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
