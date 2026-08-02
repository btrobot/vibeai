import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { DrizzleService } from './drizzle.service';
import { DRIZZLE } from './drizzle.constants';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibeai';
        const client = postgres(databaseUrl, { max: 10 });
        return drizzle(client, { schema });
      },
    },
    DrizzleService,
  ],
  exports: [DRIZZLE, DrizzleService],
})
export class DrizzleModule {}