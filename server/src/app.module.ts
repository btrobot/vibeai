import { join } from 'path';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';
import { CustomThrottlerGuard } from './common/throttler.guard';
import { AuditInterceptor } from './common/audit.interceptor';
import { AdminAuditService } from './modules/admin/services/admin-audit.service';
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
import { OrderModule } from './modules/order/order.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { NotificationModule } from './modules/notification/notification.module';
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
    // 全局限流：default 100 req/min per IP（按路由隔离，@nestjs/throttler v6 的
    // storage key 含路由路径）。更严格的业务限流（auth 防爆破 5/min、
    // generation 10/min、upload 20/min）通过各路由 @Throttle({ default: { limit } })
    // 覆盖实现 —— 避免无覆盖路由被所有命名限流器共同计数导致误伤 429。
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
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
    OrderModule,
    CommerceModule,
    AnnouncementModule,
    SystemConfigModule,
    NotificationModule,
  ],
  providers: [
    HealthService,
    {
      provide: APP_FILTER,
      useClass: MulterExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      inject: [AdminAuditService],
      useFactory: (auditService: AdminAuditService) => new AuditInterceptor(auditService),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpRequestLoggerMiddleware).forRoutes('/api/*');
  }
}
