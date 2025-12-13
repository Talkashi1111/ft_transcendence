# Quick Pre-Commit Checklist

## 1. Create a Feature Branch

**Always work on a feature branch, never directly on `main`:**

```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

## 2. Run All Checks

Before committing your changes, run this command **inside the DevContainer**:

```bash
# Run all checks (format + lint + test + build)
make all
```

Or run checks individually:

```bash
make format  # Format all files with Prettier (fast, ~1-2s)
make lint    # Check linting (fast, ~1-3s)
make test    # Run tests with coverage (moderate, ~5-15s)
make build   # Verify builds (moderate, ~10-30s)
```

## 3. Commit and Push

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat: add user authentication endpoint"

# Push to your feature branch
git push origin feature/your-feature-name
```

## 4. Create Pull Request

- Go to GitHub and create a PR from your feature branch to `main`
- CI will automatically run all checks
- Request review from team members
- Merge only after CI passes and approval

## Why No Automated Pre-Commit Hooks?

This project follows the **DevContainer philosophy**:

- ✅ All dev tools live **inside** the container
- ✅ Host machine stays **clean** (only Git + Docker + VS Code)
- ✅ **CI/CD** is the authoritative quality gate

Installing pre-commit hooks would require:

- ❌ Installing Node.js, pnpm, ESLint on your host
- ❌ Duplicating the development environment
- ❌ Breaking the DevContainer isolation

## CI Will Catch Everything

Don't worry! The CI pipeline automatically checks:

- ✅ Linting (all files)
- ✅ Tests (60% line coverage)
- ✅ Builds
- ✅ Multi-arch Docker images

**Merge is blocked if any check fails.**

## IDE Integration

You get real-time feedback in VS Code:

- ESLint extension shows errors as you type
- Vitest extension runs tests automatically
- TypeScript shows type errors immediately

## Optional: Create a Convenience Script

Add to your workflow:

```bash
# Inside DevContainer
alias precommit="make all"
```

Then before committing:

```bash
precommit
```

## Full Documentation

See `.github/DEVCONTAINER-WORKFLOW.md` for complete details on the development workflow.
