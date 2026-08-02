import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { StorageModule } from './modules/storage/storage.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { WsModule } from './modules/ws/ws.module';
import { ProjectModule } from './modules/project/project.module';
import { TaskModule } from './modules/task/task.module';
import { DrizzleModule } from './common/drizzle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DrizzleModule,
    WsModule,
    AuthModule,
    UserModule,
    StorageModule,
    GatewayModule,
    ProjectModule,
    TaskModule,
  ],
})
export class AppModule {}