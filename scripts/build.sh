#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing frontend dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only || pnpm install

echo "Installing server dependencies..."
cd server && pnpm install --prefer-offline --reporter=append-only || pnpm install
cd "${COZE_WORKSPACE_PATH}"

echo "Building frontend with Vite..."
pnpm vite build

echo "Building NestJS backend..."
cd server && pnpm build
cd "${COZE_WORKSPACE_PATH}"

echo "Build completed successfully!"