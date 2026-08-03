import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './modules/auth/auth.module';
import { StorageModule } from './modules/storage/storage.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { WsModule } from './modules/ws/ws.module';
import { ProjectModule } from './modules/project/project.module';
import { TaskModule } from './modules/task/task.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { DrizzleModule } from './common/drizzle.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'dist'),
      exclude: ['/api*', '/ws*'],
      serveStaticOptions: {
        index: 'index.html',
        fallthrough: false,
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DrizzleModule,
    WsModule,
    AuthModule,
    StorageModule,
    GatewayModule,
    ProjectModule,
    TaskModule,
    BillingModule,
    AdminModule,
    GalleryModule,
  ],
})
export class AppModule {}