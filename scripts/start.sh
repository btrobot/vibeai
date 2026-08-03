#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-5000}"

cd "${COZE_WORKSPACE_PATH}"

echo "Starting NestJS backend on port ${BACKEND_PORT}..."
cd server && node dist/main.js &
BACKEND_PID=$!
cd "${COZE_WORKSPACE_PATH}"

# Wait for backend to be ready
echo "Waiting for backend on port ${BACKEND_PORT}..."
for ((i=1; i<=30; i++)); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:${BACKEND_PORT}/api/health" 2>/dev/null | grep -q 200; then
    echo "Backend is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Backend failed to start within 30s"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Graceful shutdown
cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "Starting static file server on port ${DEPLOY_RUN_PORT}..."
npx serve -l "${DEPLOY_RUN_PORT}" -s dist &
FRONTEND_PID=$!

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID