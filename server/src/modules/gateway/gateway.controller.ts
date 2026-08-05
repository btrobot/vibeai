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
import type { Response } from 'express';
import { GatewayService } from './gateway.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { BillingService } from '../billing/billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSchema, ChatSchema, QuickCreateSchema } from './dto/index';
import type { GenerateInput, ChatInput, QuickCreateInput } from './dto/index';

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
    const models = await this.gatewayService.listModels(capability);
    return { success: true, data: models };
  }

  @Get('models/:slug')
  @UseGuards(JwtAuthGuard)
  async getModel(@Param('slug') slug: string) {
    const model = await this.gatewayService.getModel(slug);
    if (!model) {
      throw new NotFoundException(`模型 "${slug}" 不存在`);
    }
    return { success: true, data: model };
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
  @Throttle({ generation: { ttl: 60_000, limit: 10 } })
  async generate(@Req() req: any, @Body() body: GenerateInput) {
    const { projectId, capabilitySlug, modelSlug, input, sourceCreateId } = body;
    const userId = req.user.userId;

    const result = await this.gatewayService.submitGeneration(userId, projectId, capabilitySlug, input, modelSlug, sourceCreateId);
    return { success: true, data: result };
  }

  // ===== Quick Create =====

  @Post('quick-create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ generation: { ttl: 60_000, limit: 10 } })
  async quickCreate(@Req() req: any, @Body() body: QuickCreateInput) {
    const userId = req.user.userId;
    const result = await this.gatewayService.quickCreate(userId, body.projectId, body.recipeId, body.input);
    return { success: true, data: result };
  }

  // ===== Chat (LLM SSE Streaming) =====

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @Throttle({ generation: { ttl: 60_000, limit: 10 } })
  async chat(@Req() req: any, @Body() body: ChatInput, @Res() res: Response) {
    const userId = req.user.userId;

    // Resolve model
    const model = body.modelSlug
      ? await this.gatewayService.getModel(body.modelSlug)
      : await this.gatewayService.getDefaultModel('text-generation');

    if (!model) {
      throw new NotFoundException('没有可用的文本生成模型');
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();

    try {
      const adapter = this.adapterRegistry.getAdapter('llm');
      const result = await adapter.execute(body, model, {
        taskId: `llm-${Date.now()}`,
        userId,
        onProgress: (_progress: number, text: string) => {
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        },
      });

      // Credit deduction (LLM doesn't pre-deduct, charges after completion)
      await this.billingService.deductCredits(
        userId,
        null,
        model.costCredits,
        `LLM 对话: ${model.name}`,
      );

      res.write(`data: ${JSON.stringify({ done: true, modelUsed: model.slug })}\n\n`);
    } catch (e: any) {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    } finally {
      res.end();
    }
  }
}
