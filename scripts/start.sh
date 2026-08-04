#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-5000}"

cd "${COZE_WORKSPACE_PATH}"

# ── Load .env.local (host deploy) > .env (local dev) ──
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . .env.local
  set +a
  echo "[env] Loaded .env.local"
fi

# ── Database URL resolution (priority order) ──
# 1. DATABASE_URL (from .env.local or env var)
# 2. PGDATABASE_URL (sandbox Supabase)
# 3. Construct from individual PG* env vars (Docker / custom deploy)
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${PGDATABASE_URL:-}" ]; then
    export DATABASE_URL="${PGDATABASE_URL}"
    echo "[db] Using PGDATABASE_URL"
  elif [ -n "${PGHOST:-}" ] && [ -n "${PGDATABASE:-}" ]; then
    PGUSER="${PGUSER:-postgres}"
    PGPASSWORD="${PGPASSWORD:-}"
    PGPORT="${PGPORT:-5432}"
    PGSSLMODE="${PGSSLMODE:-require}"
    if [ -n "${PGPASSWORD}" ]; then
      export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=${PGSSLMODE}"
    else
      export DATABASE_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=${PGSSLMODE}"
    fi
    echo "[db] Constructed DATABASE_URL from PG* vars (host=${PGHOST})"
  else
    echo "[db] WARNING: No database configuration found. API will fail on DB queries."
    echo "[db] Set DATABASE_URL, PGDATABASE_URL, or PGHOST+PGDATABASE env vars."
  fi
fi

# JWT secret: use a fixed default if not set (in production, set via env var)
if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET="vibeai-production-jwt-secret-change-me"
  echo "Using default JWT_SECRET (set JWT_SECRET env var for production)"
fi

# ── Database migrations ──
echo "[db] Running migrations..."
cd server && node dist/scripts/migrate.js
MIGRATE_EXIT=$?
cd "${COZE_WORKSPACE_PATH}"
if [ "$MIGRATE_EXIT" -ne 0 ]; then
  echo "[db] Migration failed (exit $MIGRATE_EXIT), continuing anyway..."
fi

# ── Database seeds ──
echo "[db] Running seeds..."
cd server && node dist/scripts/seed.js
SEED_EXIT=$?
cd "${COZE_WORKSPACE_PATH}"
if [ "$SEED_EXIT" -ne 0 ]; then
  echo "[db] Seed failed (exit $SEED_EXIT), continuing anyway..."
fi

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