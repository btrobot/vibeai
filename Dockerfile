# ===== Stage 1: Dependencies =====
FROM node:24-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Frontend dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prefer-offline

# Backend dependencies
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile --prefer-offline

# ===== Stage 2: Build =====
FROM node:24-alpine AS build
WORKDIR /app

COPY --from=deps /app /app
COPY . .

# Build frontend
RUN pnpm vite build

# Build backend
RUN cd server && npx tsc

# ===== Stage 3: Production =====
FROM node:24-alpine AS production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate && \
    pnpm add -g serve

# Copy production dependencies only (ignore scripts to avoid husky in prepare)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prefer-offline --prod --ignore-scripts

COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile --prefer-offline --prod --ignore-scripts

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist

# Copy startup scripts
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh

# Environment defaults
ENV NODE_ENV=production
ENV BACKEND_PORT=3001
ENV DEPLOY_RUN_PORT=5000

EXPOSE 5000

CMD ["bash", "./scripts/start.sh"]