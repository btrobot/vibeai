#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-5000}"

cd "${COZE_WORKSPACE_PATH}"

# Database URL: prefer explicit DATABASE_URL, fall back to PGDATABASE_URL (sandbox Supabase)
if [ -z "${DATABASE_URL:-}" ] && [ -n "${PGDATABASE_URL:-}" ]; then
  export DATABASE_URL="${PGDATABASE_URL}"
  echo "Using PGDATABASE_URL as DATABASE_URL"
fi

# JWT secret: use a fixed default if not set (in production, set via env var)
if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET="vibeai-production-jwt-secret-change-me"
  echo "Using default JWT_SECRET (set JWT_SECRET env var for production)"
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