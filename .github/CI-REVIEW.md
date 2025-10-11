# CI/CD Pipeline Review

## Overview

This document reviews the CI/CD pipeline configuration including Dockerfile stages, Makefile targets, and GitHub Actions workflow.

## Dockerfile Stages

### 1. Builder Stage (CI/CD)

**Purpose:** Build applications and run tests in CI/CD

```dockerfile
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS builder
```

**Key Features:**

- ✅ Enables pnpm via corepack
- ✅ Installs all dependencies (dev + prod) with `--frozen-lockfile`
- ✅ Copies all source code
- ✅ Runs `pnpm run build` to compile TypeScript and build Vite app
- **Used in:** GitHub Actions CI pipeline
- **Size:** Large (~1GB+) - contains all dev dependencies

### 2. Development Stage (DevContainer)

**Purpose:** Local development environment

```dockerfile
FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm AS development
```

**Key Features:**

- ✅ Installs SQLite and build tools for native modules
- ✅ Creates `/app/data` directory for database
- ✅ Exposes ports 5173 (frontend) and 3000 (backend)
- ✅ Sets `NODE_ENV=development`
- ✅ Uses `sleep infinity` as default command (overridden by devcontainer.json)
- **Used in:** VS Code DevContainer
- **Size:** Large (~1GB+) - full dev environment

### 3. Production Stage (Deployment)

**Purpose:** Optimized runtime for production deployment

```dockerfile
FROM node:22-bookworm-slim AS production
```

**Key Features:**

- ✅ Uses slim base image for smaller size
- ✅ Installs only build essentials for native modules (better-sqlite3)
- ✅ Enables pnpm via corepack
- ✅ Installs only production dependencies (`--prod --frozen-lockfile`)
- ✅ Copies built artifacts from builder stage
- ✅ Copies backend source files (needed for ES module imports)
- ✅ Exposes only port 3000 (backend API)
- ✅ Sets `NODE_ENV=production`
- ✅ Runs backend server: `pnpm --filter backend run start`
- **Used in:** Production deployments
- **Size:** Small (~300-400MB) - production dependencies only

## Makefile Targets

### Docker Commands (Run on HOST)

- `make up` - Start dev stack and enter container
- `make exec` - Execute bash in running container
- `make halt` - Stop dev stack
- `make rebuild` - Force rebuild dev container
- `make destroy` - Remove all containers and volumes
- `make prune` - Clean up unused Docker resources
- `make release` - Build and push production image

### Development Commands (Run INSIDE devcontainer)

- `make install` - Install all dependencies
- `make check-deps` - Check and auto-install dependencies
- `make dev` - Run both frontend and backend
- `make frontend` - Run only frontend dev server
- `make backend` - Run only backend dev server
- `make test` - Run tests with coverage (fails if < 60%)
- `make lint` - Run ESLint on all packages
- `make build` - Build all packages for production

## GitHub Actions CI Workflow

### Trigger Events

- Pull requests to `main` branch
- Direct pushes to `main` branch

### Pipeline Steps

#### 1. Setup

- ✅ Checkout code
- ✅ Setup Docker Buildx for efficient multi-stage builds
- ✅ Enable GitHub Actions cache for Docker layers

#### 2. Build Builder Stage

- ✅ Builds `builder` target from Dockerfile
- ✅ Uses GitHub Actions cache to speed up builds
- ✅ Loads image into Docker for use in subsequent steps

#### 3. Lint Check (`make lint`)

```bash
docker run --rm ft_transcendence:builder pnpm -r exec eslint .
```

- ✅ Runs ESLint on all packages (root, frontend, backend)
- ✅ Fails CI if any linting errors found
- ✅ Checks both TypeScript and configuration files

#### 4. Test with Coverage (`make test`)

```bash
docker run --rm ft_transcendence:builder sh -c "
  pnpm --filter backend run test --coverage || exit 1 &&
  pnpm --filter frontend run test --coverage || exit 1
"
```

- ✅ Runs backend tests first
- ✅ Runs frontend tests second
- ✅ **Coverage Thresholds:** 60% minimum for each package
  - Statements: 60%
  - Branches: 60%
  - Functions: 60%
  - Lines: 60%
- ✅ Fails CI if any package is below threshold
- ✅ Runs tests separately to show clear failure source

#### 5. Build Check (`make build`)

```bash
docker run --rm ft_transcendence:builder pnpm run build
```

- ✅ Verifies TypeScript compilation succeeds
- ✅ Verifies Vite build succeeds
- ✅ Fails CI if build errors occur

#### 6. Production Image Build

- ✅ Builds production stage
- ✅ Verifies production image can be built
- ✅ Uses cache for faster builds
- ✅ Ready for deployment

## Coverage Configuration

### Backend (`backend/vitest.config.ts`)

```typescript
thresholds: {
  statements: 60,
  branches: 60,
  functions: 60,
  lines: 60
}
```

- Excludes: node_modules, dist, build, config files, tests
- Reports: text, json, html
- Coverage provider: v8

### Frontend (`frontend/vitest.config.ts`)

```typescript
thresholds: {
  statements: 60,
  branches: 60,
  functions: 60,
  lines: 60
}
```

- Excludes: config files, node_modules, dist, main.tsx, tests
- Reports: text, html, json, json-summary
- Environment: jsdom (for React testing)
- Coverage provider: v8

## Key Improvements Made

### Dockerfile

1. ✅ Added `corepack enable` to builder stage
2. ✅ Copy backend source files to production (needed for ES modules)
3. ✅ Clear separation of concerns between stages
4. ✅ Optimized production image size

### CI Workflow

1. ✅ Separated test runs for frontend and backend
2. ✅ Clear failure messages showing which package failed
3. ✅ Enforces 60% coverage threshold per package
4. ✅ Runs all Makefile targets (lint, test, build)
5. ✅ Added verification steps with success messages

### Vitest Configuration

1. ✅ Set consistent 60% threshold for both packages
2. ✅ Proper exclusions for non-testable code
3. ✅ Multiple report formats for CI and local dev

## CI Failure Scenarios

The CI will **FAIL** if:

- ❌ Any linting errors in frontend or backend
- ❌ Backend test coverage < 60% (any metric)
- ❌ Frontend test coverage < 60% (any metric)
- ❌ Any test failures in frontend or backend
- ❌ TypeScript compilation errors
- ❌ Vite build errors
- ❌ Production Docker image fails to build

## Local Development Workflow

1. **Start dev environment:** `make up`
2. **Install dependencies:** `make install` (or automatic via `check-deps`)
3. **Run dev servers:** `make dev` (or `make frontend`/`make backend`)
4. **Before committing:**
   - Run `make lint` - Fix any linting issues
   - Run `make test` - Ensure tests pass with coverage
   - Run `make build` - Verify build succeeds

## Production Deployment

1. CI passes on `main` branch
2. Run `make release` to build and push production image
3. Deploy production image to hosting platform
4. Backend serves at port 3000
5. Frontend static files can be served via CDN or reverse proxy

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                   GitHub Actions                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  1. Build builder image                       │  │
│  │  2. Run make lint (ESLint)                    │  │
│  │  3. Run make test (Vitest + 60% coverage)     │  │
│  │  4. Run make build (TypeScript + Vite)        │  │
│  │  5. Build production image                    │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                    Dockerfile                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Builder    │  │ Development  │  │Production │ │
│  │   (CI/CD)    │  │(DevContainer)│  │  (Deploy) │ │
│  │  ~1GB+       │  │   ~1GB+      │  │  ~300MB   │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                     Makefile                         │
│  Host:        make up, halt, rebuild, destroy       │
│  Container:   make dev, test, lint, build           │
└─────────────────────────────────────────────────────┘
```

## Monitoring & Quality Gates

- ✅ Automated linting on every commit
- ✅ Automated testing with coverage gates
- ✅ Build verification before merge
- ✅ Production image validation
- ✅ Fast feedback loop (< 5 minutes typical)
- ✅ Cacheable layers for speed
- ✅ Clear error messages for debugging
