#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

cd "${COZE_WORKSPACE_PATH}"

echo "Starting NestJS backend on port 3001..."
cd server && node dist/main.js &
cd "${COZE_WORKSPACE_PATH}"

echo "Starting static file server on port ${DEPLOY_RUN_PORT}..."
npx serve -l ${DEPLOY_RUN_PORT} -s dist