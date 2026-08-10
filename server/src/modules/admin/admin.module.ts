import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminOrderController } from './admin-order.controller';
import { AdminAuditController } from './admin-audit.controller';
import {
  AdminUserQueryService,
  AdminUserMutationService,
  AdminExportService,
  AdminNotificationService,
  AdminOrderService,
  AdminAuditService,
} from './services';
import { DrizzleModule } from '../../common/drizzle.module';
import { OrderModule } from '../order/order.module';
import { AuditInterceptor } from '../../common/audit.interceptor';

@Module({
  imports: [DrizzleModule, OrderModule],
  controllers: [AdminController, AdminOrderController, AdminAuditController],
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
    AdminOrderService,
    AdminAuditService,
    AuditInterceptor,
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
    AdminOrderService,
    AdminAuditService,
    AuditInterceptor,
  ],
})
export class AdminModule {}
