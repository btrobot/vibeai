/**
 * Standalone Migration Script
 *
 * Runs drizzle-orm migrations from the migrations folder.
 * Idempotent: tracks applied migrations in __drizzle_migrations table.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *   node dist/scripts/migrate.js
 *
 * Environment:
 *   DATABASE_URL or PGDATABASE_URL — PostgreSQL connection string
 */

import { config } from 'dotenv';
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Load .env.local > .env
config({ path: path.resolve(__dirname, '..', '.env.local'), override: false });
config({ path: path.resolve(__dirname, '..', '.env'), override: false });

async function main(): Promise<void> {
  const databaseUrl = process.env.PGDATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] ERROR: No DATABASE_URL or PGDATABASE_URL found in environment');
    process.exit(1);
  }

  const migrationsFolder = path.resolve(__dirname, '..', '..', 'drizzle');

  console.log('[migrate] Running migrations from:', migrationsFolder);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await migrate(drizzle(pool), { migrationsFolder });
    console.log('[migrate] Migrations completed successfully');
  } catch (err) {
    console.error('[migrate] FAILED:', (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
