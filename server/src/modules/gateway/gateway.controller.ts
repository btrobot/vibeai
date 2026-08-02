import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSchema } from './dto/index';
import type { GenerateInput } from './dto/index';

@Controller('api/gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  // ===== Capabilities =====

  @Get('capabilities')
  listCapabilities() {
    const capabilities = this.gatewayService.listCapabilities();
    return { success: true, data: capabilities };
  }

  @Get('capabilities/:slug')
  getCapability(@Param('slug') slug: string) {
    const capability = this.gatewayService.getCapability(slug);
    if (!capability) {
      throw new NotFoundException(`能力 "${slug}" 不存在`);
    }
    return { success: true, data: capability };
  }

  @Get('capabilities/:slug/models')
  getModelsForCapability(@Param('slug') slug: string) {
    const models = this.gatewayService.getModelsForCapability(slug);
    return { success: true, data: models };
  }

  // ===== Models =====

  @Get('models')
  listModels() {
    const models = this.gatewayService.listModels();
    return { success: true, data: models };
  }

  @Get('models/:slug')
  getModel(@Param('slug') slug: string) {
    const model = this.gatewayService.getModel(slug);
    if (!model) {
      throw new NotFoundException(`模型 "${slug}" 不存在`);
    }
    return { success: true, data: model };
  }

  // ===== Generation =====

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(@Req() req: any, @Body() body: GenerateInput) {
    const { capabilitySlug, modelSlug, input } = body;
    const userId = req.user.userId;

    const result = await this.gatewayService.submitGeneration(userId, capabilitySlug, input, modelSlug);
    return { success: true, data: result };
  }

  @Get('tasks/:taskId')
  @UseGuards(JwtAuthGuard)
  async getTask(@Req() req: any, @Param('taskId') taskId: string) {
    const task = await this.gatewayService.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`任务 "${taskId}" 不存在`);
    }
    return { success: true, data: task };
  }
}