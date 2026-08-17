import { Inject, Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { JwtAuthGuard } from '../../../modules/auth/jwt-auth.guard';
import { PromoCodeService } from '../services/promo-code.service';
import type {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  ListPromoCodesDto,
  PromoCodeResponseDto,
  ValidatePromoCodeDto,
  PromoCodeValidationResponseDto,
  PromoCodeUsageStatsResponseDto,
} from '../dto/promo-code.dto';

@ApiTags('Admin - Commerce - Promo Codes')
@Controller('admin/commerce/promo-codes')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class PromoCodeController {
  constructor(@Inject(PromoCodeService) private readonly promoCodeService: PromoCodeService) {}

  /**
   * Create a new promo code
   */
  @Post()
  @ApiOperation({ summary: 'Create a new promo code' })
  @ApiResponse({ status: 201, description: 'Promo code created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Promo code already exists' })
  async create(@Body() dto: CreatePromoCodeDto): Promise<PromoCodeResponseDto> {
    return this.promoCodeService.create(dto);
  }

  /**
   * List all promo codes with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'List all promo codes' })
  @ApiResponse({ status: 200, description: 'Promo codes retrieved successfully' })
  async list(@Query() query: ListPromoCodesDto) {
    return this.promoCodeService.list(query);
  }

  /**
   * Get promo code by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get promo code by ID' })
  @ApiResponse({ status: 200, description: 'Promo code retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async getById(@Param('id') id: string): Promise<PromoCodeResponseDto> {
    const promoCode = await this.promoCodeService.getById(id);
    if (!promoCode) {
      throw new Error('Promo code not found');
    }
    return promoCode;
  }

  /**
   * Get promo code by code
   */
  @Get('code/:code')
  @ApiOperation({ summary: 'Get promo code by code' })
  @ApiResponse({ status: 200, description: 'Promo code retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async getByCode(@Param('code') code: string): Promise<PromoCodeResponseDto> {
    const promoCode = await this.promoCodeService.getByCode(code);
    if (!promoCode) {
      throw new Error('Promo code not found');
    }
    return promoCode;
  }

  /**
   * Get promo code usage statistics
   */
  @Get(':id/usage')
  @ApiOperation({ summary: 'Get promo code usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async getUsageStats(@Param('id') id: string): Promise<PromoCodeUsageStatsResponseDto> {
    return this.promoCodeService.getUsageStats(id);
  }

  /**
   * Update promo code
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update promo code' })
  @ApiResponse({ status: 200, description: 'Promo code updated successfully' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async update(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto): Promise<PromoCodeResponseDto> {
    return this.promoCodeService.update(id, dto);
  }

  /**
   * Delete promo code
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete promo code' })
  @ApiResponse({ status: 200, description: 'Promo code deleted successfully' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete promo code that has been used' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.promoCodeService.delete(id);
  }
}

/**
 * Public controller for promo code validation
 */
@ApiTags('Commerce - Promo Codes')
@Controller('api/commerce/promo-codes')
export class PublicPromoCodeController {
  constructor(@Inject(PromoCodeService) private readonly promoCodeService: PromoCodeService) {}

  /**
   * Validate a promo code (public endpoint)
   */
  @Post('validate')
  @ApiOperation({ summary: 'Validate a promo code' })
  @ApiResponse({ status: 200, description: 'Promo code validated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid promo code' })
  async validate(@Body() dto: ValidatePromoCodeDto): Promise<PromoCodeValidationResponseDto> {
    return this.promoCodeService.validate(dto);
  }
}
