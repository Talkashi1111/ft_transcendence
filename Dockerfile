# Stage 1: Build and dependencies
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS builder

# Install SQLite and other required packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends sqlite3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

# [Optional] Uncomment if you want to install more global node modules
# RUN su node -c "npm install -g <your-package-list-here>"

WORKDIR /app

# # Copy package.json files first for better caching
# COPY package*.json ./

# # Install all dependencies (including devDependencies for building)
# RUN npm ci

# # Copy source code
# COPY . .

# # Build the application
# RUN npm run build

ENV NODE_ENV=builder

# Stage 2: Development (optional, for local development with hot-reloading)
FROM builder AS development

# In development, we'll use all dependencies
WORKDIR /app

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set NODE_ENV to development
ENV NODE_ENV=development

# Default port exposure
EXPOSE 3000

# Command to run the application in development mode
CMD ["npm", "run", "dev"]

# Stage 3: Production runtime
FROM node:22-bookworm-slim AS production

# Install SQLite in production image
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends sqlite3 libsqlite3-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Copy package.json files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from the builder stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/public /app/public

# Default port exposure
EXPOSE 3000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Command to run the application (adjust based on your project's start command)
CMD ["npm", "run", "start"]
