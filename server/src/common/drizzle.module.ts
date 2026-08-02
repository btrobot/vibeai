import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

export const DRIZZLE = 'DRIZZLE';

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
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}