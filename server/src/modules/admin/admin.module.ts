import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { 
  AdminUserQueryService, 
  AdminUserMutationService, 
  AdminExportService,
  AdminNotificationService 
} from './services';
import { DrizzleModule } from '../../common/drizzle.module';

@Module({
  imports: [DrizzleModule],
  controllers: [AdminController],
  providers: [
    {
      provide: 'ADMIN_USER_QUERY_SERVICE',
      useClass: AdminUserQueryService,
    },
    {
      provide: 'ADMIN_USER_MUTATION_SERVICE',
      useClass: AdminUserMutationService,
    },
    {
      provide: 'ADMIN_EXPORT_SERVICE',
      useClass: AdminExportService,
    },
    {
      provide: 'ADMIN_NOTIFICATION_SERVICE',
      useClass: AdminNotificationService,
    },
  ],
  exports: [
    {
      provide: 'ADMIN_USER_QUERY_SERVICE',
      useClass: AdminUserQueryService,
    },
    {
      provide: 'ADMIN_USER_MUTATION_SERVICE',
      useClass: AdminUserMutationService,
    },
    {
      provide: 'ADMIN_EXPORT_SERVICE',
      useClass: AdminExportService,
    },
    {
      provide: 'ADMIN_NOTIFICATION_SERVICE',
      useClass: AdminNotificationService,
    },
  ],
})
export class AdminModule {}
