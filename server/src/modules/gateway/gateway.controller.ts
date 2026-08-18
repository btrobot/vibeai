import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GatewayService } from './gateway.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { sanitizeModelForClient } from './gateway.service';
import { BillingService } from '../billing/billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { GenerateSchema, ChatSchema, QuickCreateSchema } from './dto/index';
import type { GenerateInput, ChatInput, QuickCreateInput } from './dto/index';

@ApiTags('gateway')
@Controller('gateway')
export class GatewayController {
  constructor(
    @Inject('GATEWAY_SERVICE') private readonly gatewayService: GatewayService,
    @Inject('ADAPTER_REGISTRY') private readonly adapterRegistry: AdapterRegistry,
    @Inject('BILLING_SERVICE') private readonly billingService: BillingService,
  ) {}

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
  async listModels(@Req() req: any) {
    const capability = req.query?.capability as string | undefined;
    const modality = req.query?.modality as string | undefined;
    const models = await this.gatewayService.listModels(capability, modality);
    return { success: true, data: models.map(sanitizeModelForClient) };
  }

  @Get('models/:slug')
  @UseGuards(JwtAuthGuard)
  async getModel(@Param('slug') slug: string) {
    const model = await this.gatewayService.getModel(slug);
    if (!model) {
      throw new NotFoundException(`模型 "${slug}" 不存在`);
    }
    return { success: true, data: sanitizeModelForClient(model) };
  }

  // ===== Recipes =====

  @Get('recipes')
  @UseGuards(JwtAuthGuard)
  listRecipes() {
    const recipes = this.gatewayService.listRecipes();
    return { success: true, data: recipes };
  }

  // ===== Generation =====

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async generate(@Req() req: any, @Body() body: GenerateInput) {
    const { projectId, capabilitySlug, modelSlug, input, sourceCreateId } = body;
    const userId = req.user.userId;

    if (!projectId || projectId.trim() === '') {
      throw new BadRequestException('项目 ID 不能为空');
    }

    const result = await this.gatewayService.submitGeneration(userId, projectId, capabilitySlug, input, modelSlug, sourceCreateId);
    return { success: true, data: result };
  }

  // ===== Quick Create =====

  @Post('quick-create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async quickCreate(@Req() req: any, @Body() body: QuickCreateInput) {
    const userId = req.user.userId;
    const result = await this.gatewayService.quickCreate(userId, body.projectId, body.recipeId, body.input);
    return { success: true, data: result };
  }

  // ===== Chat (LLM SSE Streaming) =====

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async chat(@Req() req: any, @Body() body: ChatInput, @Res() res: Response) {
    const userId = req.user.userId;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();

    try {
      // 渠道解析 + fallback 在 GatewayService.chatStream 内完成（与 generate 对齐的 key 合并）
      const result = await this.gatewayService.chatStream(
        userId,
        body,
        body.modelSlug,
        (_progress: number, text: string) => {
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        },
      );

      // Credit deduction (LLM doesn't pre-deduct, charges after completion)
      await this.billingService.deductCredits(
        userId,
        null,
        result.costCredits,
        `LLM 对话: ${result.modelName}`,
      );

      res.write(`data: ${JSON.stringify({ done: true, modelUsed: result.modelUsed })}\n\n`);
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    } finally {
      res.end();
    }
  }

  // ===== Admin: Model & Provider lifecycle =====

  @Post('admin/models/:slug/toggle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleModel(@Param('slug') slug: string) {
    const updated = await this.gatewayService.toggleModelActive(slug);
    if (!updated) {
      throw new NotFoundException(`模型 "${slug}" 不存在`);
    }
    return { success: true, data: updated };
  }

  @Post('admin/channels/:id/toggle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleChannel(@Param('id') id: string) {
    const updated = await this.gatewayService.toggleChannelActive(id);
    if (!updated) {
      throw new NotFoundException(`渠道 "${id}" 不存在`);
    }
    return { success: true, data: updated };
  }
}
