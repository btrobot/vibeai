import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../common/drizzle.constants';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import { count, eq, sql } from 'drizzle-orm';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getStats() {
    const [userCount] = await this.db
      .select({ value: count() })
      .from(schema.users);

    const [activeUserCount] = await this.db
      .select({ value: count() })
      .from(schema.users)
      .where(
        sql`${schema.users.updatedAt} > NOW() - INTERVAL '30 days'`,
      );

    const [projectCount] = await this.db
      .select({ value: count() })
      .from(schema.projects);

    const [taskCount] = await this.db
      .select({ value: count() })
      .from(schema.tasks);

    const [failedTaskCount] = await this.db
      .select({ value: count() })
      .from(schema.tasks)
      .where(eq(schema.tasks.status, 'failed'));

    const [storageResult] = await this.db
      .select({ value: sql<number>`COALESCE(SUM(${schema.files.size}), 0)` })
      .from(schema.files);

    return {
      totalUsers: userCount?.value ?? 0,
      activeUsers: activeUserCount?.value ?? 0,
      totalProjects: projectCount?.value ?? 0,
      totalTasks: taskCount?.value ?? 0,
      failedTasks: failedTaskCount?.value ?? 0,
      totalStorage: Number(storageResult?.value ?? 0),
    };
  }
}