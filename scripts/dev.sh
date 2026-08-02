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

echo "Building NestJS backend..."
cd server && pnpm build > /tmp/nestjs-build.log 2>&1
cd "${COZE_WORKSPACE_PATH}"

echo "Starting NestJS backend on port 3001..."
cd server && (PORT=3001 nohup node dist/main.js > /tmp/nestjs.log 2>&1 &)
cd "${COZE_WORKSPACE_PATH}"

echo "Waiting for backend to be ready..."
for i in $(seq 1 15); do
  curl -s --max-time 1 http://localhost:3001/api/auth/login -X POST -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"test"}' > /dev/null 2>&1 && break
  sleep 1
done

echo "Starting Vite frontend on port ${DEPLOY_RUN_PORT}..."
PORT=${DEPLOY_RUN_PORT} pnpm vite --port ${DEPLOY_RUN_PORT}