# Quick CI/CD Reference

## Summary of Changes

### ✅ Updated Files

1. **`.github/workflows/ci.yml`**
   - Separated backend and frontend test runs
   - Added explicit coverage threshold enforcement (60%)
   - Better error messages showing which package failed
   - Verifies all Makefile targets work

2. **`Dockerfile`**
   - Added `corepack enable` to builder stage
   - Copy backend/src to production (needed for ES module imports)
   - All three stages properly configured

3. **`backend/vitest.config.ts`**
   - Set all coverage thresholds to 60%
   - Ensures consistent enforcement

4. **`frontend/vitest.config.ts`**
   - Set all coverage thresholds to 60%
   - Ensures consistent enforcement

## CI Pipeline Flow

```
Pull Request or Push to main
          ↓
    Build builder image
          ↓
    Run make lint → Fail if linting errors
          ↓
    Run make test → Fail if coverage < 60% (backend OR frontend)
          ↓
    Run make build → Fail if build errors
          ↓
    Build production image → Fail if image build fails
          ↓
         ✅ SUCCESS - Ready to merge/deploy
```

## Coverage Requirements

**Both backend AND frontend must have:**
- ✅ Statements: ≥ 60%
- ✅ Branches: ≥ 60%
- ✅ Functions: ≥ 60%
- ✅ Lines: ≥ 60%

**If ANY metric is below 60% in EITHER package → CI FAILS**

## Testing Locally Before Push

```bash
# Inside devcontainer:
make lint    # Check for linting errors
make test    # Run tests with coverage (must be ≥ 60%)
make build   # Verify builds succeed
```

## Docker Stages Summary

| Stage | Purpose | Size | When Used |
|-------|---------|------|-----------|
| **builder** | Build & test | ~1GB+ | CI/CD pipeline |
| **development** | Local dev | ~1GB+ | DevContainer |
| **production** | Runtime | ~300MB | Deployment |

## Makefile Commands

### Host Machine (Docker operations)
```bash
make up        # Start and enter dev container
make halt      # Stop containers
make rebuild   # Force rebuild
make destroy   # Remove everything
make release   # Build production image
```

### Inside DevContainer (Development)
```bash
make dev       # Run frontend + backend
make frontend  # Run only frontend
make backend   # Run only backend
make test      # Run tests with coverage
make lint      # Run linting
make build     # Build for production
```

## What Happens in CI

1. **Checkout** - Gets your code
2. **Build** - Creates builder Docker image with all dependencies
3. **Lint** - Runs ESLint on all packages
   - Fails if: Any linting errors
4. **Test** - Runs Vitest with coverage for backend, then frontend
   - Fails if: Coverage < 60% in ANY metric in EITHER package
   - Fails if: Any test fails
5. **Build** - Compiles TypeScript and builds frontend
   - Fails if: TypeScript errors or build failures
6. **Production Image** - Creates optimized deployment image
   - Fails if: Docker build errors

## Key Benefits

✅ **Quality Gates** - Can't merge without passing tests and coverage
✅ **Fast Feedback** - Know immediately if something breaks
✅ **Consistent** - Same checks locally and in CI
✅ **Cacheable** - Fast builds using GitHub Actions cache
✅ **Comprehensive** - Checks linting, tests, coverage, and builds
✅ **Clear Failures** - Easy to see what went wrong and where

## Example CI Failure Messages

**Linting failure:**
```
❌ Error: eslint found 5 errors in backend/src/index.ts
```

**Coverage failure:**
```
❌ Error: Coverage for statements (58.5%) does not meet threshold (60%)
  File       | Statements | Branches | Functions | Lines
  backend    | 58.5%      | 65%      | 70%       | 58%
```

**Test failure:**
```
❌ FAIL backend/test/index.test.ts
  ✓ should create user (5ms)
  ✗ should validate schema (3ms)
    Expected: 400
    Received: 200
```

## Documentation

See `.github/CI-REVIEW.md` for detailed documentation of the entire CI/CD pipeline architecture.
