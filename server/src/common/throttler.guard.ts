import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * 自定义限流守卫
 *
 * 在测试/集成测试环境下跳过所有限流，避免集成测试被 rate-limit 阻断。
 * 生产环境使用父类 ThrottlerGuard 的默认行为 + @Throttle 装饰器配置。
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' || process.env.INTEGRATION_TEST === 'true') {
      return true;
    }
    return super.shouldSkip(_context);
  }
}
