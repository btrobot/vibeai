#!/bin/bash
set -Eeuo pipefail

# ── Configuration ──
FRONTEND_PORT="${DEPLOY_RUN_PORT:-5000}"
BACKEND_PORT=3001
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

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
# 3. Construct from individual PG* env vars
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
  fi
fi

# JWT secret fallback
if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET="vibeai-dev-jwt-secret"
fi

# ── HMR client port for Vite (nginx proxy passthrough) ──
if [ -n "${HMR_CLIENT_PORT:-}" ]; then
  export HMR_CLIENT_PORT
  echo "[hmr] HMR clientPort = ${HMR_CLIENT_PORT}"
fi

# ── Install dependencies ──
echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline 2>/dev/null || pnpm install
(cd server && pnpm install --prefer-offline 2>/dev/null || pnpm install)

# ── Build NestJS backend ──
echo "Building NestJS backend..."
(cd server && pnpm build > /tmp/nestjs-build.log 2>&1)

# ── Cleanup handler ──
NEST_PID=""
VITE_WRAPPER_PID=""

cleanup() {
  echo ""
  echo "[dev] Shutting down..."
  # Kill Vite wrapper first (it will cleanly stop Vite)
  [ -n "${VITE_WRAPPER_PID}" ] && kill "${VITE_WRAPPER_PID}" 2>/dev/null && echo "[dev] Stopped Vite (PID ${VITE_WRAPPER_PID})"
  [ -n "${NEST_PID}" ] && kill "${NEST_PID}" 2>/dev/null && echo "[dev] Stopped NestJS (PID ${NEST_PID})"
  wait 2>/dev/null
  echo "[dev] All processes stopped."
  exit 0
}
trap cleanup SIGTERM SIGINT EXIT

# ── Start NestJS backend ──
echo "Starting NestJS backend on port ${BACKEND_PORT}..."
export DATABASE_URL="${PGDATABASE_URL:-${DATABASE_URL:-}}"
(cd server && PORT=${BACKEND_PORT} node dist/main.js) &
NEST_PID=$!

# ── Wait for backend health ──
echo "Waiting for backend to be ready..."
BACKEND_READY=false
for i in $(seq 1 20); do
  if curl -s --max-time 1 -o /dev/null -w '%{http_code}' "http://localhost:${BACKEND_PORT}/api/health" 2>/dev/null | grep -q 200; then
    BACKEND_READY=true
    break
  fi
  if ! kill -0 "${NEST_PID}" 2>/dev/null; then
    echo "[dev] ERROR: Backend process exited unexpectedly. Check /tmp/nestjs.log"
    cat /tmp/nestjs.log 2>/dev/null | tail -20
    exit 1
  fi
  sleep 1
done

if [ "${BACKEND_READY}" = false ]; then
  echo "[dev] WARNING: Backend did not respond within 20s, starting frontend anyway..."
else
  echo "[dev] Backend ready."
fi

# ── Vite auto-restart wrapper ──
# Root cause: pnpm install deletes + recreates .pnpm virtual store.
# Vite holds file descriptors to old inodes → crash on next HMR.
# This wrapper restarts Vite whenever it crashes (non-zero exit).
# It exits cleanly (exit 0) when killed by cleanup().
_vite_runner() {
  local port="$1"
  while true; do
    pnpm vite --port "${port}" --host 0.0.0.0
    VITE_EXIT=$?
    if [ "${VITE_EXIT}" -eq 0 ]; then
      # Clean exit (SIGTERM from cleanup) → stop
      exit 0
    fi
    echo "[dev] Vite exited with code ${VITE_EXIT}, restarting in 1s..."
    sleep 1
  done
}

# ── Start Vite frontend via wrapper ──
echo "Starting Vite frontend on port ${FRONTEND_PORT}..."
echo "[dev] Frontend: http://localhost:${FRONTEND_PORT}"
echo "[dev] Backend:  http://localhost:${BACKEND_PORT}"
echo "[dev] Press Ctrl+C to stop all services."
echo ""

_vite_runner "${FRONTEND_PORT}" &
VITE_WRAPPER_PID=$!

# ── Keep script alive, wait for any child to exit ──
wait
