import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../../modules/auth/jwt-auth.guard';
import { ProductCategoryService } from '../services/product-category.service';
import type {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  ListProductCategoriesDto,
  UpdateCategoryAttributesDto,
  ProductCategoryResponseDto,
  ProductCategoryTreeResponseDto,
} from '../dto/product-category.dto';

@ApiTags('Admin - Commerce - Product Categories')
@Controller('admin/commerce/categories')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class ProductCategoryController {
  constructor(private readonly productCategoryService: ProductCategoryService) {}

  /**
   * Create a new product category
   */
  @Post()
  @ApiOperation({ summary: 'Create a new product category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Category already exists' })
  async create(@Body() dto: CreateProductCategoryDto, @CurrentUser() admin: JwtPayload): Promise<ProductCategoryResponseDto> {
    return this.productCategoryService.create(dto, admin.id);
  }

  /**
   * List all categories with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async list(@Query() query: ListProductCategoriesDto) {
    return this.productCategoryService.list(query);
  }

  /**
   * Get category tree (hierarchical structure)
   */
  @Get('tree')
  @ApiOperation({ summary: 'Get category tree' })
  @ApiResponse({ status: 200, description: 'Category tree retrieved successfully' })
  async getTree(@Query('activeOnly') activeOnly?: string): Promise<ProductCategoryTreeResponseDto[]> {
    return this.productCategoryService.getTree(activeOnly !== 'false');
  }

  /**
   * Get category by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getById(@Param('id') id: string): Promise<ProductCategoryResponseDto> {
    const category = await this.productCategoryService.getById(id);
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  /**
   * Update category
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto): Promise<ProductCategoryResponseDto> {
    return this.productCategoryService.update(id, dto);
  }

  /**
   * Delete category
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete category with children or products' })
  async delete(@Param('id') id: string, @Query('force') force?: string): Promise<void> {
    return this.productCategoryService.delete(id, force === 'true');
  }

  /**
   * Toggle category active status
   */
  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle category active status' })
  @ApiResponse({ status: 200, description: 'Category status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async toggleActive(@Param('id') id: string): Promise<ProductCategoryResponseDto> {
    return this.productCategoryService.toggleActive(id);
  }

  /**
   * Update category attributes
   */
  @Put(':id/attributes')
  @ApiOperation({ summary: 'Update category attributes' })
  @ApiResponse({ status: 200, description: 'Category attributes updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateAttributes(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryAttributesDto,
  ): Promise<ProductCategoryResponseDto> {
    return this.productCategoryService.updateAttributes(id, dto);
  }
}
