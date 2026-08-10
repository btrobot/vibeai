import { join } from 'path';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CustomThrottlerGuard } from './common/throttler.guard';
import { LoggerModule } from './common/logger.module';
import { EmailModule } from './common/email.module';
import { HealthService } from './common/health.service';
import { HttpRequestLoggerMiddleware } from './common/http-request-logger.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { StorageModule } from './modules/storage/storage.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { WsModule } from './modules/ws/ws.module';
import { ProjectModule } from './modules/project/project.module';
import { TaskModule } from './modules/task/task.module';
import { CreateModule } from './modules/create/create.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { PaymentModule } from './modules/payment/payment.module';
import { OrderModule } from './modules/order/order.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { DrizzleModule } from './common/drizzle.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'dist'),
      exclude: ['/api/{*path}', '/ws/{*path}'],
      serveStaticOptions: {
        index: 'index.html',
        fallthrough: true,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Global rate limiting: 100 req/min per IP (default)
    // Stricter limits applied per-controller via @Throttle decorator
    // Test/integration mode is skipped via CustomThrottlerGuard
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 5,
      },
      {
        name: 'generation',
        ttl: 60_000,
        limit: 10,
      },
      {
        name: 'upload',
        ttl: 60_000,
        limit: 20,
      },
    ]),
    DrizzleModule,
    LoggerModule,
    EmailModule,
    WsModule,
    AuthModule,
    StorageModule,
    GatewayModule,
    ProjectModule,
    TaskModule,
    CreateModule,
    BillingModule,
    AdminModule,
    GalleryModule,
    PaymentModule,
    OrderModule,
    CommerceModule,
  ],
  providers: [
    HealthService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpRequestLoggerMiddleware).forRoutes('/api/*');
  }
}