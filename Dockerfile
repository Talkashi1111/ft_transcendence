# Builder stage (for CI/CD)
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all dependencies (including dev dependencies for building)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build applications
RUN pnpm run build

# Development stage (for devcontainer)
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS development

# Install SQLite for database
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends build-essential python3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set NODE_ENV to development
ENV NODE_ENV=development

# Expose ports for both frontend and backend
EXPOSE 5173 3000

# Default command (will be overridden by devcontainer)
CMD ["sleep", "infinity"]

# Production stage (for deployment)
FROM node:22-bookworm-slim AS production

# Install SQLite and build dependencies for native modules
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends build-essential python3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable pnpm for production
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built applications (you'd build these in CI/CD)
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "backend", "run", "start"]
