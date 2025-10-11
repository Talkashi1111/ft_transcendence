# Quick Pre-Commit Checklist

Before committing your changes, run these commands **inside the DevContainer**:

```bash
# Run all checks
make lint && make test && make build
```

Or individually:

```bash
make lint    # Check linting (fast, ~1-3s)
make test    # Run tests with coverage (moderate, ~5-15s)
make build   # Verify builds (moderate, ~10-30s)
```

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
alias precommit="make lint && make test && make build"
```

Then before committing:

```bash
precommit
```

## Full Documentation

See `.github/DEVCONTAINER-WORKFLOW.md` for complete details on the development workflow.
