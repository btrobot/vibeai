import { Body, Controller, Get, Inject, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ModelConfigService } from '../gateway/model-config.service';
import {
  CreateModelSchema,
  CreateProviderSchema,
  ReplaceCapabilityRoutesSchema,
  SetStatusSchema,
  UpdateModelSchema,
  UpdateProviderSchema,
} from '../gateway/dto/model-config';
import type {
  CreateModelInput,
  CreateProviderInput,
  ReplaceCapabilityRoutesInput,
  SetStatusInput,
  UpdateModelInput,
  UpdateProviderInput,
} from '../gateway/dto/model-config';

@ApiTags('admin-model-config')
@ApiBearerAuth()
@Controller('admin/model-config')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminModelConfigController {
  constructor(
    @Inject('MODEL_CONFIG_SERVICE') private readonly modelConfigService: ModelConfigService,
  ) {}

  @Get()
  async getConfiguration() {
    return { success: true, data: await this.modelConfigService.getConfiguration() };
  }

  @Post('models')
  async createModel(
    @Body(new ZodValidationPipe(CreateModelSchema)) body: CreateModelInput,
  ) {
    return { success: true, data: await this.modelConfigService.createModel(body) };
  }

  @Patch('models/:slug')
  async updateModel(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(UpdateModelSchema)) body: UpdateModelInput,
  ) {
    return { success: true, data: await this.modelConfigService.updateModel(slug, body) };
  }

  @Patch('models/:slug/status')
  async setModelStatus(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(SetStatusSchema)) body: SetStatusInput,
  ) {
    return { success: true, data: await this.modelConfigService.setModelStatus(slug, body.isActive) };
  }

  @Post('providers')
  async createProvider(
    @Body(new ZodValidationPipe(CreateProviderSchema)) body: CreateProviderInput,
  ) {
    return { success: true, data: await this.modelConfigService.createProvider(body) };
  }

  @Patch('providers/:id')
  async updateProvider(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProviderSchema)) body: UpdateProviderInput,
  ) {
    return { success: true, data: await this.modelConfigService.updateProvider(id, body) };
  }

  @Patch('providers/:id/status')
  async setProviderStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetStatusSchema)) body: SetStatusInput,
  ) {
    return { success: true, data: await this.modelConfigService.setProviderStatus(id, body.isActive) };
  }

  @Put('routes/:capabilitySlug')
  async replaceCapabilityRoutes(
    @Param('capabilitySlug') capabilitySlug: string,
    @Body(new ZodValidationPipe(ReplaceCapabilityRoutesSchema)) body: ReplaceCapabilityRoutesInput,
  ) {
    return {
      success: true,
      data: await this.modelConfigService.replaceCapabilityRoutes(capabilitySlug, body.modelSlugs),
    };
  }
}
