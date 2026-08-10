import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductCategoryService } from '../services/product-category.service';
import { createDrizzleMockForNestJS, mockSingle, mockMany, mockEmpty } from '../../../test/drizzle-mock';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from '../dto/product-category.dto';

describe('ProductCategoryService', () => {
  let service: ProductCategoryService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new ProductCategoryService(db as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category successfully', async () => {
      const dto: CreateProductCategoryDto = {
        name: 'Test Category',
        slug: 'test-category',
        icon: '🧪',
        sortOrder: 0,
      };

      // Mock: category slug doesn't exist
      mockEmpty(db);

      // Mock: insert returns created category
      const createdCategory = {
        id: 'cat-123',
        name: dto.name,
        slug: dto.slug,
        icon: dto.icon,
        attributes: {},
        sortOrder: 0,
        isActive: true,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSingle(db, createdCategory);

      const result = await service.create(dto, 'user-123');

      expect(result).toBeDefined();
      expect(result.name).toBe(dto.name);
      expect(result.slug).toBe(dto.slug);
    });

    it('should throw conflict error if slug exists', async () => {
      const dto: CreateProductCategoryDto = {
        name: 'Test Category',
        slug: 'existing-category',
      };

      // Mock: category slug already exists
      mockSingle(db, { id: 'existing' });

      await expect(service.create(dto, 'user-123')).rejects.toThrow('already exists');
    });
  });

  describe('getById', () => {
    it('should return category if found', async () => {
      const mockCategory = {
        id: 'cat-123',
        name: 'Test',
        slug: 'test',
        icon: '🧪',
        attributes: {},
        sortOrder: 0,
        isActive: true,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, mockCategory);

      const result = await service.getById('cat-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('cat-123');
    });

    it('should return null if not found', async () => {
      mockEmpty(db);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should return paginated categories', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Category 1',
          slug: 'cat-1',
          icon: '1️⃣',
          attributes: {},
          sortOrder: 0,
          isActive: true,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cat-2',
          name: 'Category 2',
          slug: 'cat-2',
          icon: '2️⃣',
          attributes: {},
          sortOrder: 1,
          isActive: true,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock count query
      mockSingle(db, { count: '2' });
      // Mock data query
      mockMany(db, mockCategories);

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('update', () => {
    it('should update category successfully', async () => {
      const existingCategory = {
        id: 'cat-123',
        name: 'Old Name',
        slug: 'old-slug',
        icon: '🧪',
        attributes: {},
        sortOrder: 0,
        isActive: true,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: getById returns existing category
      mockSingle(db, existingCategory);

      // Mock: update returns updated category (wrapped in array for returning)
      const updatedCategory = { ...existingCategory, name: 'New Name' };
      mockSingle(db, updatedCategory);

      const dto: UpdateProductCategoryDto = { name: 'New Name' };
      const result = await service.update('cat-123', dto);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Name');
    });

    it('should throw not found if category does not exist', async () => {
      mockEmpty(db);

      await expect(service.update('nonexistent', {})).rejects.toThrow('not found');
    });
  });

  describe('delete', () => {
    it('should delete category successfully', async () => {
      const existingCategory = {
        id: 'cat-123',
        name: 'Test',
        slug: 'test',
        icon: '🧪',
        attributes: {},
        sortOrder: 0,
        isActive: true,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: category exists
      mockSingle(db, existingCategory);
      // Mock: no children
      mockEmpty(db);
      // Mock: no products
      mockEmpty(db);

      await expect(service.delete('cat-123')).resolves.not.toThrow();
    });

    it('should prevent deletion if has children', async () => {
      const existingCategory = {
        id: 'cat-123',
        name: 'Test',
        slug: 'test',
        icon: '🧪',
        attributes: {},
        sortOrder: 0,
        isActive: true,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: category exists
      mockSingle(db, existingCategory);
      // Mock: has children
      mockSingle(db, { id: 'child-1' });

      await expect(service.delete('cat-123')).rejects.toThrow('Cannot delete category with subcategories');
    });
  });

  describe('getTree', () => {
    it('should return hierarchical tree structure', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Parent',
          slug: 'parent',
          icon: '👨‍👧',
          attributes: {},
          sortOrder: 0,
          isActive: true,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cat-2',
          name: 'Child',
          slug: 'child',
          icon: '👶',
          attributes: {},
          sortOrder: 0,
          isActive: true,
          parentId: 'cat-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockMany(db, mockCategories);

      const result = await service.getTree(true);

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].name).toBe('Child');
    });
  });
});
