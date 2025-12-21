# Builder stage (for CI/CD)
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS builder

# Enable pnpm
RUN corepack enable

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY blockchain/package.json ./blockchain/

# Install all dependencies (including dev dependencies for building)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create data directory for SQLite databases (used by tests)
RUN mkdir -p /app/data

# Generate Prisma Client and build applications
# DATABASE_URL is required for prisma generate but not used at build time
RUN cd backend && DATABASE_URL="file:/app/data/database.db" npx prisma generate && cd .. && pnpm run build

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

# Enable pnpm for production
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install build dependencies, install packages, then remove build deps
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends build-essential python3 \
    && pnpm install --prod --frozen-lockfile \
    && apt-get -y remove build-essential python3 \
    && apt-get -y autoremove \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy built applications from builder stage
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Copy blockchain artifacts (contract ABI needed at runtime)
COPY --from=builder /app/blockchain/artifacts/contracts ./blockchain/artifacts/contracts

# Copy Prisma schema, migrations, and config for running migrations in production
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/prisma.config.ts ./backend/prisma.config.ts

# Copy startup script
COPY scripts/start-prod.sh /app/start-prod.sh
RUN chmod +x /app/start-prod.sh

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000
ENV NODE_ENV=production

CMD ["/app/start-prod.sh"]
