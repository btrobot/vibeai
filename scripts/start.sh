#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-5000}"

cd "${COZE_WORKSPACE_PATH}"

# Run database migrations
echo "Running database migrations..."
cd server && node -e "
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/vibeai' });
const db = drizzle(pool);
migrate(db, { migrationsFolder: './drizzle' })
  .then(() => { console.log('Migrations completed'); process.exit(0); })
  .catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
" 2>&1
cd "${COZE_WORKSPACE_PATH}"

echo "Starting NestJS (API + static files) on port ${DEPLOY_RUN_PORT}..."
export PORT="${DEPLOY_RUN_PORT}"
cd server && node dist/main.js &
NEST_PID=$!
cd "${COZE_WORKSPACE_PATH}"

# Wait for backend to be ready
echo "Waiting for server on port ${DEPLOY_RUN_PORT}..."
for ((i=1; i<=30; i++)); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:${DEPLOY_RUN_PORT}/api/health" 2>/dev/null | grep -q 200; then
    echo "Server is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Server failed to start within 30s"
    kill $NEST_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Graceful shutdown
cleanup() {
  echo "Shutting down..."
  kill $NEST_PID 2>/dev/null || true
  wait $NEST_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# Wait for the process
wait $NEST_PID