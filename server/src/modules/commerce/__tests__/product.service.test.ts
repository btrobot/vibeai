import { describe, it, expect, beforeEach } from 'vitest';
import { ProductService } from '../services/product.service';
import { createDrizzleMockForNestJS, mockSingle, mockMany, mockEmpty } from '../../../test/drizzle-mock';
import { CreateProductDto, UpdateProductDto, UpdateProductStatusDto } from '../dto/product.dto';

describe('ProductService', () => {
  let service: ProductService;
  let db: ReturnType<typeof createDrizzleMockForNestJS>;

  beforeEach(() => {
    db = createDrizzleMockForNestJS();
    service = new ProductService(db as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const dto: CreateProductDto = {
        name: 'Test Product',
        description: 'Test description',
        categoryId: 'cat-123',
        images: ['file-1', 'file-2'],
        status: 'active',
      };

      // Mock: category exists
      mockSingle(db, { id: 'cat-123' });

      // Mock: insert returns created product
      const createdProduct = {
        id: 'prod-123',
        userId: 'user-123',
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        images: dto.images,
        status: dto.status,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSingle(db, createdProduct);

      const result = await service.create(dto, 'user-123');

      expect(result).toBeDefined();
      expect(result.name).toBe(dto.name);
      expect(result.status).toBe(dto.status);
    });

    it('should throw error if no images provided', async () => {
      const dto: CreateProductDto = {
        name: 'Test Product',
        images: [],
      };

      await expect(service.create(dto, 'user-123')).rejects.toThrow('at least one image');
    });

    it('should throw error if category not found', async () => {
      const dto: CreateProductDto = {
        name: 'Test Product',
        categoryId: 'nonexistent',
        images: ['file-1'],
      };

      // Mock: category doesn't exist
      mockEmpty(db);

      await expect(service.create(dto, 'user-123')).rejects.toThrow('Category not found');
    });
  });

  describe('getById', () => {
    it('should return product if found', async () => {
      const mockProduct = {
        id: 'prod-123',
        userId: 'user-123',
        name: 'Test Product',
        description: 'Description',
        categoryId: 'cat-123',
        images: ['file-1'],
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock query returns product with category
      mockSingle(db, {
        product: mockProduct,
        category: { id: 'cat-123', name: 'Test Category', slug: 'test' },
      });

      const result = await service.getById('prod-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('prod-123');
      expect(result?.category).toBeDefined();
    });

    it('should return null if not found', async () => {
      // Mock empty result
      mockEmpty(db);

      const result = await service.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should return paginated products', async () => {
      const mockProducts = [
        {
          product: {
            id: 'prod-1',
            userId: 'user-123',
            name: 'Product 1',
            description: 'Desc 1',
            categoryId: 'cat-123',
            images: ['file-1'],
            status: 'active',
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          category: { id: 'cat-123', name: 'Category', slug: 'cat' },
        },
        {
          product: {
            id: 'prod-2',
            userId: 'user-123',
            name: 'Product 2',
            description: 'Desc 2',
            categoryId: 'cat-123',
            images: ['file-2'],
            status: 'active',
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          category: { id: 'cat-123', name: 'Category', slug: 'cat' },
        },
      ];

      // Mock count
      mockSingle(db, { count: '2' });
      // Mock products
      mockMany(db, mockProducts);

      const result = await service.list({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('update', () => {
    it('should update product successfully', async () => {
      const existingProduct = {
        id: 'prod-123',
        userId: 'user-123',
        name: 'Old Name',
        description: 'Old description',
        categoryId: 'cat-123',
        images: ['file-1'],
        status: 'draft',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: product exists
      mockSingle(db, {
        product: existingProduct,
        category: null,
      });

      // Mock: update returns updated product
      const updatedProduct = { ...existingProduct, name: 'New Name' };
      mockSingle(db, updatedProduct);

      const dto: UpdateProductDto = { name: 'New Name' };
      const result = await service.update('prod-123', dto);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Name');
    });
  });

  describe('updateStatus', () => {
    it('should update product status', async () => {
      const existingProduct = {
        id: 'prod-123',
        userId: 'user-123',
        name: 'Test',
        description: 'Desc',
        categoryId: 'cat-123',
        images: ['file-1'],
        status: 'draft',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSingle(db, {
        product: existingProduct,
        category: null,
      });

      // Mock: update returns updated product
      const updatedProduct = { ...existingProduct, status: 'active' };
      mockSingle(db, updatedProduct);

      const dto: UpdateProductStatusDto = { status: 'active' };
      const result = await service.updateStatus('prod-123', dto);

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
    });
  });

  describe('delete', () => {
    it('should soft delete product', async () => {
      const existingProduct = {
        id: 'prod-123',
        userId: 'user-123',
        name: 'Test',
        description: 'Desc',
        categoryId: 'cat-123',
        images: ['file-1'],
        status: 'active',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: product exists
      mockSingle(db, {
        product: existingProduct,
        category: null,
      });

      // Mock: delete succeeds
      mockSingle(db, undefined);

      await expect(service.delete('prod-123', 'user-123')).resolves.not.toThrow();
    });
  });
});
