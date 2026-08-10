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
import { ProductService } from '../services/product.service';
import type {
  CreateProductDto,
  UpdateProductDto,
  ListProductsDto,
  ProductResponseDto,
  UpdateProductStatusDto,
  UpdateProductImagesDto,
} from '../dto/product.dto';

@ApiTags('Admin - Commerce - Products')
@Controller('admin/commerce/products')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * Create a new product
   */
  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async create(@Body() dto: CreateProductDto, @CurrentUser() admin: JwtPayload): Promise<ProductResponseDto> {
    return this.productService.create(dto, admin.id);
  }

  /**
   * List all products with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'List all products' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  async list(@Query() query: ListProductsDto) {
    return this.productService.list(query);
  }

  /**
   * Get product by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getById(@Param('id') id: string): Promise<ProductResponseDto> {
    const product = await this.productService.getById(id);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  /**
   * Update product
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() admin: JwtPayload): Promise<ProductResponseDto> {
    return this.productService.update(id, dto);
  }

  /**
   * Delete product (soft delete)
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete product (soft delete)' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async delete(@Param('id') id: string, @CurrentUser() admin: JwtPayload): Promise<void> {
    return this.productService.delete(id, admin.id);
  }

  /**
   * Update product status
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update product status' })
  @ApiResponse({ status: 200, description: 'Product status updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateProductStatusDto): Promise<ProductResponseDto> {
    return this.productService.updateStatus(id, dto);
  }

  /**
   * Update product images
   */
  @Put(':id/images')
  @ApiOperation({ summary: 'Update product images' })
  @ApiResponse({ status: 200, description: 'Product images updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateImages(@Param('id') id: string, @Body() dto: UpdateProductImagesDto): Promise<ProductResponseDto> {
    return this.productService.updateImages(id, dto);
  }
}
