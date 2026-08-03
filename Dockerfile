# ===== Build Arguments =====
# Default: international (npmjs.org)
# China: docker build --build-arg NODE_IMAGE=node:24-alpine --build-arg NPM_REGISTRY=https://registry.npmmirror.com ...
ARG NODE_IMAGE=node:24-alpine
ARG NPM_REGISTRY=https://registry.npmjs.org
ARG PNPM_VERSION=9.0.0

# ===== Stage 1: Dependencies =====
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

ARG NPM_REGISTRY
ARG PNPM_VERSION

RUN npm install -g pnpm@${PNPM_VERSION}

# Configure registry
RUN pnpm config set registry ${NPM_REGISTRY}

# Frontend dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Backend dependencies
COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile --ignore-scripts

# ===== Stage 2: Build =====
FROM ${NODE_IMAGE} AS build
WORKDIR /app

ARG NPM_REGISTRY
ARG PNPM_VERSION

# pnpm is not inherited from deps stage (global install)
RUN npm install -g pnpm@${PNPM_VERSION}
RUN pnpm config set registry ${NPM_REGISTRY}

COPY --from=deps /app /app
COPY . .

# Build frontend
RUN pnpm vite build

# Build backend
RUN cd server && npx tsc

# ===== Stage 3: Production =====
FROM ${NODE_IMAGE} AS production
WORKDIR /app

ARG NPM_REGISTRY
ARG PNPM_VERSION

RUN apk add --no-cache bash curl && npm install -g pnpm@${PNPM_VERSION} serve
RUN pnpm config set registry ${NPM_REGISTRY}

# Copy production dependencies only (ignore scripts to avoid husky in prepare)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY server/package.json server/pnpm-lock.yaml ./server/
RUN cd server && pnpm install --frozen-lockfile --prod --ignore-scripts

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