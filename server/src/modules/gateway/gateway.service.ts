import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleService } from '../../common/drizzle.service';
import { tasks } from '../../db/schema/task-engine';
import { builtInCapabilityMap } from './capabilities/index';
import { builtInModelMap } from './models/index';
import { routeCapability, getModelsForCapability } from './router/index';
import type { CapabilityDefinition } from './capabilities/index';
import type { ModelDefinition } from './models/index';
import { eq } from 'drizzle-orm';
import { TaskExecutionService } from './task-execution.service';

// ===== Gateway Types =====
export interface GenerationTaskResponse {
  taskId: string;
  capabilitySlug: string;
  modelSlug: string;
  status: 'queued' | 'submitting' | 'completing' | 'completed' | 'failed';
  createdAt: string;
  estimatedCompletionAt?: string;
}

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly taskExecution: TaskExecutionService,
  ) {}

  // ===== Capabilities =====

  listCapabilities(): CapabilityDefinition[] {
    return Array.from(builtInCapabilityMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getCapability(slug: string): CapabilityDefinition | null {
    return builtInCapabilityMap.get(slug) ?? null;
  }

  // ===== Models =====

  listModels(): ModelDefinition[] {
    return Array.from(builtInModelMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getModel(slug: string): ModelDefinition | null {
    return builtInModelMap.get(slug) ?? null;
  }

  getModelsForCapability(capabilitySlug: string): ModelDefinition[] {
    const modelSlugs = getModelsForCapability(capabilitySlug);
    return modelSlugs
      .map((slug) => builtInModelMap.get(slug))
      .filter((m): m is ModelDefinition => m !== undefined);
  }

  // ===== Generation =====

  async submitGeneration(
    userId: string,
    capabilitySlug: string,
    input: Record<string, unknown>,
    preferredModel?: string,
  ): Promise<GenerationTaskResponse> {
    // Validate capability
    const capability = builtInCapabilityMap.get(capabilitySlug);
    if (!capability) {
      throw new NotFoundException(`能力 "${capabilitySlug}" 不存在`);
    }

    // Route to model
    const route = routeCapability(capabilitySlug, preferredModel);
    if (!route) {
      throw new BadRequestException(`能力 "${capabilitySlug}" 没有可用的模型`);
    }

    // Create task record in unified tasks table
    const taskId = uuidv4();
    const now = new Date();

    try {
      await this.drizzle.db.insert(tasks).values({
        id: taskId,
        userId,
        type: capabilitySlug,
        capabilitySlug,
        modelSlug: route.modelSlug,
        input,
        status: 'queued',
        creditsCost: 0,
        createdAt: now,
        updatedAt: now,
      } as any);
    } catch (error) {
      this.logger.error(`Failed to create task: ${error}`);
      // If DB insert fails, still return the task
    }

    this.logger.log(`Generation task ${taskId}: ${capabilitySlug} → ${route.modelSlug}`);

    // Trigger async execution
    this.taskExecution.executeTask(taskId, userId, capabilitySlug, input).catch((err) => {
      this.logger.error(`Async execution failed for task ${taskId}: ${err.message}`);
    });

    return {
      taskId,
      status: 'queued',
      capabilitySlug,
      modelSlug: route.modelSlug,
      createdAt: now.toISOString(),
    };
  }

  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    try {
      const [task] = await this.drizzle.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (!task) return null;

      return {
        id: task.id,
        status: task.status,
        capabilitySlug: task.capabilitySlug ?? task.type,
        modelSlug: task.modelSlug,
        input: task.input,
        output: task.output,
        errorMessage: task.errorMessage,
        startedAt: task.startedAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ===== SDK Integration Placeholders =====

  async executeWithLLM(input: Record<string, unknown>): Promise<string> {
    this.logger.log('LLM execution requested', JSON.stringify(input));
    return 'execution_placeholder';
  }

  async executeImageGeneration(input: Record<string, unknown>): Promise<string[]> {
    this.logger.log('Image generation requested', JSON.stringify(input));
    return [];
  }

  async executeVideoGeneration(input: Record<string, unknown>): Promise<string | null> {
    this.logger.log('Video generation requested', JSON.stringify(input));
    return null;
  }
}
