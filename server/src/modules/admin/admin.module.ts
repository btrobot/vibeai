import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DrizzleModule } from '../../common/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [AdminController],
  providers: [{ provide: 'ADMIN_SERVICE', useClass: AdminService }],
})
export class AdminModule {}