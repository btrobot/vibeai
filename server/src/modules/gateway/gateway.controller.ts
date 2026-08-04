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

@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  // ===== Capabilities =====

  @Get('capabilities')
  @UseGuards(JwtAuthGuard)
  listCapabilities() {
    const capabilities = this.gatewayService.listCapabilities();
    return { success: true, data: capabilities };
  }

  @Get('capabilities/:slug')
  @UseGuards(JwtAuthGuard)
  getCapability(@Param('slug') slug: string) {
    const capability = this.gatewayService.getCapability(slug);
    if (!capability) {
      throw new NotFoundException(`能力 "${slug}" 不存在`);
    }
    return { success: true, data: capability };
  }

  // ===== Models =====

  @Get('models')
  @UseGuards(JwtAuthGuard)
  listModels() {
    const models = this.gatewayService.listModels();
    return { success: true, data: models };
  }

  @Get('models/:slug')
  @UseGuards(JwtAuthGuard)
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

  // ===== Chat (LLM SSE Streaming) =====

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  async chat(@Req() req: any, @Body() body: { modelSlug: string; messages: unknown[] }) {
    // TODO: Implement SSE streaming via LLMClient.stream()
    // For now, return a placeholder response
    return {
      success: true,
      data: { message: 'Chat endpoint - SSE streaming will be implemented' },
    };
  }

  // ===== Quick Create =====

  @Post('quick-create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async quickCreate(
    @Req() req: any,
    @Body() body: { recipeId: string; input?: Record<string, unknown> },
  ) {
    // TODO: Implement recipe lookup + parameter merge + submitGeneration
    throw new NotFoundException(`快捷创作方案 "${body.recipeId}" 不存在`);
  }
}
