import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from './drizzle.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';

@Injectable()
export class DrizzleService {
  constructor(
    @Inject(DRIZZLE) public readonly db: PostgresJsDatabase<typeof schema>,
  ) {}
}