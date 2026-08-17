import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ModelConfigService } from '../gateway/model-config.service';
import {
  CreateChannelSchema,
  CreateModelSchema,
  CreatePlatformSchema,
  ReplaceCapabilityRoutesSchema,
  SetStatusSchema,
  UpdateChannelSchema,
  UpdateModelSchema,
  UpdatePlatformSchema,
} from '../gateway/dto/model-config';
import type {
  CreateChannelInput,
  CreateModelInput,
  CreatePlatformInput,
  ReplaceCapabilityRoutesInput,
  SetStatusInput,
  UpdateChannelInput,
  UpdateModelInput,
  UpdatePlatformInput,
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

  // ===== 模型 =====

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

  // ===== 平台 =====

  @Post('platforms')
  async createPlatform(
    @Body(new ZodValidationPipe(CreatePlatformSchema)) body: CreatePlatformInput,
  ) {
    return { success: true, data: await this.modelConfigService.createPlatform(body) };
  }

  @Patch('platforms/:id')
  async updatePlatform(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlatformSchema)) body: UpdatePlatformInput,
  ) {
    return { success: true, data: await this.modelConfigService.updatePlatform(id, body) };
  }

  @Patch('platforms/:id/status')
  async setPlatformStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetStatusSchema)) body: SetStatusInput,
  ) {
    return { success: true, data: await this.modelConfigService.setPlatformStatus(id, body.isActive) };
  }

  @Delete('platforms/:id')
  async deletePlatform(@Param('id') id: string) {
    return { success: true, data: await this.modelConfigService.deletePlatform(id) };
  }

  // ===== 渠道 =====

  @Post('channels')
  async createChannel(
    @Body(new ZodValidationPipe(CreateChannelSchema)) body: CreateChannelInput,
  ) {
    return { success: true, data: await this.modelConfigService.createChannel(body) };
  }

  @Patch('channels/:id')
  async updateChannel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateChannelSchema)) body: UpdateChannelInput,
  ) {
    return { success: true, data: await this.modelConfigService.updateChannel(id, body) };
  }

  @Patch('channels/:id/status')
  async setChannelStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetStatusSchema)) body: SetStatusInput,
  ) {
    return { success: true, data: await this.modelConfigService.setChannelStatus(id, body.isActive) };
  }

  @Delete('channels/:id')
  async deleteChannel(@Param('id') id: string) {
    return { success: true, data: await this.modelConfigService.deleteChannel(id) };
  }

  // ===== 能力路由 =====

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
