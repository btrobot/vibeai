#!/bin/bash
set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-${PORT}}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only 2>/dev/null || pnpm install
cd server && pnpm install --prefer-offline --reporter=append-only 2>/dev/null || pnpm install
cd "${COZE_WORKSPACE_PATH}"

echo "Starting NestJS backend on port 3001..."
cd server && (nohup pnpm dev > /app/work/logs/bypass/vibeai/backend.log 2>&1 &)
cd "${COZE_WORKSPACE_PATH}"

sleep 2

echo "Starting Vite frontend on port ${DEPLOY_RUN_PORT}..."
PORT=${DEPLOY_RUN_PORT} pnpm vite --port ${DEPLOY_RUN_PORT}