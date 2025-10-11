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
    Run make test → Fail if coverage < 60% lines (backend OR frontend)
          ↓
    Run make build → Fail if build errors
          ↓
    Build production image → Fail if image build fails
          ↓
         ✅ SUCCESS - Ready to merge/deploy
          ↓
    [If merged to main] → Build & Push Multi-Arch Image (AMD64 + ARM64)
          ↓
    Push to ghcr.io/owner/repo:latest, :main, :main-sha
```

## Coverage Requirements

**Both backend AND frontend must have:**

- ✅ Lines: ≥ 60%

(Statements, branches, and functions are reported but not enforced)

**If line coverage is below 60% in EITHER package → CI FAILS**

## Testing Locally Before Push

```bash
# Inside devcontainer:
make lint    # Check for linting errors
make test    # Run tests with coverage (must be ≥ 60%)
make build   # Verify builds succeed
```

## Docker Stages Summary

| Stage           | Purpose      | Size   | When Used      |
| --------------- | ------------ | ------ | -------------- |
| **builder**     | Build & test | ~1GB+  | CI/CD pipeline |
| **development** | Local dev    | ~1GB+  | DevContainer   |
| **production**  | Runtime      | ~300MB | Deployment     |

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

### CI Job (runs on all PRs and pushes)

1. **Checkout** - Gets your code
2. **Build** - Creates builder Docker image with all dependencies
3. **Lint** - Runs ESLint on all packages
   - Fails if: Any linting errors
4. **Test** - Runs Vitest with coverage for backend, then frontend
   - Fails if: Line coverage < 60% in EITHER package
   - Fails if: Any test fails
5. **Build** - Compiles TypeScript and builds frontend
   - Fails if: TypeScript errors or build failures
6. **Production Image** - Creates optimized deployment image
   - Fails if: Docker build errors

### Deploy Job (only runs on main branch after CI passes)

1. **Setup QEMU** - Enables cross-platform builds (AMD64 + ARM64)
2. **Login to Registry** - Authenticates with GitHub Container Registry
3. **Build Multi-Arch** - Builds production image for both architectures
4. **Push to Registry** - Pushes images with tags:
   - `ghcr.io/owner/repo:latest`
   - `ghcr.io/owner/repo:main`
   - `ghcr.io/owner/repo:main-<git-sha>`

## Key Benefits

✅ **Quality Gates** - Can't merge without passing tests and coverage
✅ **Fast Feedback** - Know immediately if something breaks
✅ **Consistent** - Same checks locally and in CI
✅ **Cacheable** - Fast builds using GitHub Actions cache
✅ **Comprehensive** - Checks linting, tests, coverage, and builds
✅ **Clear Failures** - Easy to see what went wrong and where
✅ **Multi-Arch** - Automatic AMD64 + ARM64 builds on main
✅ **Auto-Deploy** - Images pushed to registry on successful merge

## Example CI Failure Messages

**Linting failure:**

```
❌ Error: eslint found 5 errors in backend/src/index.ts
```

**Coverage failure:**

```
❌ Error: Coverage for lines (58.5%) does not meet threshold (60%)
  File       | Statements | Branches | Functions | Lines
  backend    | 65%        | 70%      | 55%       | 58.5%
```

**Test failure:**

```
❌ FAIL backend/test/index.test.ts
  ✓ should create user (5ms)
  ✗ should validate schema (3ms)
    Expected: 400
    Received: 200
```

## Container Registry Setup

### GitHub Container Registry (Default)

The workflow is configured to push to GitHub Container Registry (ghcr.io) by default.

**No setup required** - uses `GITHUB_TOKEN` automatically.

**Image location:**

```
ghcr.io/<owner>/<repo>:latest
ghcr.io/<owner>/<repo>:main
ghcr.io/<owner>/<repo>:main-<sha>
```

**To pull:**

```bash
docker pull ghcr.io/<owner>/<repo>:latest
```

### Alternative: Docker Hub

To use Docker Hub instead, uncomment the Docker Hub login step in `.github/workflows/ci.yml` and add secrets:

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add secrets:

   - `DOCKER_USERNAME` - Your Docker Hub username
   - `DOCKER_PASSWORD` - Your Docker Hub access token

3. Uncomment in workflow:

   ```yaml
   # - name: Log in to Docker Hub
   #   uses: docker/login-action@v3
   #   with:
   #     username: ${{ secrets.DOCKER_USERNAME }}
   #     password: ${{ secrets.DOCKER_PASSWORD }}
   ```

4. Add Docker Hub image to metadata:
   ```yaml
   images: |
     ghcr.io/${{ github.repository }}
     docker.io/${{ secrets.DOCKER_USERNAME }}/ft_transcendence
   ```

### Multi-Architecture Support

**Supported platforms:**

- `linux/amd64` - Intel/AMD x86_64 (most servers, desktops)
- `linux/arm64` - ARM64/aarch64 (Apple Silicon, AWS Graviton, Raspberry Pi 4+)

**Docker automatically pulls the right architecture** for your platform.

**Manual platform selection:**

```bash
docker pull --platform linux/amd64 ghcr.io/<owner>/<repo>:latest
docker pull --platform linux/arm64 ghcr.io/<owner>/<repo>:latest
```

## Deployment Workflow

1. **Develop** - Make changes on feature branch
2. **Test locally** - `make lint`, `make test`, `make build`
3. **Create PR** - Opens pull request to main
4. **CI runs** - All checks must pass
5. **Merge to main** - After approval
6. **Auto-deploy** - Multi-arch image built and pushed to registry
7. **Pull & run** - Deploy from registry on any platform

```bash
# On your production server (AMD64 or ARM64)
docker pull ghcr.io/<owner>/<repo>:latest
docker run -d -p 3000:3000 -v ./data:/app/data ghcr.io/<owner>/<repo>:latest
```

## Documentation

See `.github/CI-REVIEW.md` for detailed documentation of the entire CI/CD pipeline architecture.
