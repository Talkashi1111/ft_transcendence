# Development Workflow (DevContainer Philosophy)

## Overview

This project follows the **DevContainer philosophy**: all development tools and dependencies are contained within the DevContainer. The host machine only needs Docker and VS Code.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HOST MACHINE                          │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐    │
│  │   Docker   │  │   VS Code    │  │     Git     │    │
│  └────────────┘  └──────────────┘  └─────────────┘    │
│         │                │                  │           │
│         └────────────────┴──────────────────┘           │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   DEVCONTAINER                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ All Development Tools:                            │  │
│  │  • Node.js, pnpm                                  │  │
│  │  • TypeScript, ESLint, Vitest                     │  │
│  │  • Build tools, dependencies                      │  │
│  │  • Everything needed for development              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Quality Gates

We use **CI/CD** as the primary quality gate, not pre-commit hooks.

### Why No Pre-Commit Hooks?

❌ **Against DevContainer Philosophy:**

- Would require installing Node.js, pnpm, ESLint on host
- Defeats the purpose of containerization
- Inconsistent environments between developers

✅ **Better Approach:**

- Run checks inside DevContainer before committing
- Let CI catch any issues automatically
- Clean separation: Host = Git, Container = Dev Tools

## Recommended Workflow

### 1. Create Feature Branch

```bash
# ALWAYS create a feature branch (never work on main directly!)
git checkout -b feature/add-user-endpoint
```

### 2. Inside DevContainer (Development)

```bash
# Make your changes
vim backend/src/index.ts

# Before committing, run all checks:
make all     # Runs format + lint + test-all + build

# Or run checks individually if needed:
make format    # Format code with Prettier
make lint      # Check for linting errors
make test      # Run fast unit tests only
make test-all  # Run ALL tests (including integration)
make build     # Verify builds succeed

# All checks pass? Ready to commit!
```

### 3. On Host Machine (Git Operations)

```bash
# Commit your changes (from host terminal)
git add .
git commit -m "feat: add new endpoint"

# Push to your feature branch
git push origin feature/add-user-endpoint
```

### 4. Create Pull Request

- Go to GitHub and open a PR from your feature branch to `main`
- Add description and link any related issues
- Request review from team members

### 5. CI/CD Automatically Runs

```
Push to GitHub → CI runs on PR → Lint + Test + Build
                       ↓
                 All pass? ✅
                       ↓
              Review approved? ✅
                       ↓
                 Merge to main!
```

## Make Commands (Inside DevContainer)

| Command         | Description                                   | When to Use        |
| --------------- | --------------------------------------------- | ------------------ |
| `make all`      | Run format + lint + test-all + build          | Before committing  |
| `make format`   | Format all files with Prettier                | Before committing  |
| `make lint`     | Run ESLint on all packages                    | Before committing  |
| `make test`     | Run fast unit tests (excludes integration)    | Quick feedback     |
| `make test-all` | Run ALL tests including WebSocket integration | Before committing  |
| `make build`    | Build TypeScript + Vite                       | Before committing  |
| `make dev`      | Run dev servers (frontend + backend)          | During development |
| `make frontend` | Run only frontend dev server                  | Frontend work      |
| `make backend`  | Run only backend dev server                   | Backend work       |

## Pre-Commit Checklist

Instead of automated hooks, use this manual checklist:

```bash
# Run before every commit (recommended)
make all

# Or run checks individually
make lint && make test && make build
```

Or create a convenience script in package.json:

```json
{
  "scripts": {
    "precommit": "pnpm run lint && pnpm run test && pnpm run build"
  }
}
```

Then run:

```bash
pnpm run precommit
```

## CI/CD Protection

The CI pipeline will **automatically** check everything:

✅ **On Pull Requests:**

- Linting (all files)
- Tests (60% line coverage required)
- Build verification
- Blocks merge if any fail

✅ **On Merge to Main:**

- All above checks
- Multi-arch Docker image build (AMD64 + ARM64)
- Push to GitHub Container Registry

**You cannot bypass CI** - It's the ultimate quality gate.

## Host Machine Requirements

### Minimal Setup (Recommended)

```bash
# Only these are needed on host:
✅ Docker Desktop (or Docker Engine)
✅ VS Code
✅ Git

# NOT needed on host:
❌ Node.js
❌ pnpm
❌ ESLint
❌ Any dev dependencies
```

### One-Time Setup

1. **Install Docker Desktop**
   - [Download for your OS](https://www.docker.com/products/docker-desktop)

2. **Install VS Code**
   - [Download](https://code.visualstudio.com/)

3. **Install Dev Containers Extension**

   ```
   code --install-extension ms-vscode-remote.remote-containers
   ```

4. **Clone and Open**

   ```bash
   git clone https://github.com/Talkashi1111/ft_transcendence.git
   cd ft_transcendence
   code .
   ```

5. **Reopen in Container**
   - VS Code will prompt: "Reopen in Container"
   - Or: Cmd/Ctrl + Shift + P → "Dev Containers: Reopen in Container"

6. **Done!** All tools are now available inside the container.

## Advantages of This Approach

### ✅ Pros

- **Clean host** - No language runtimes or build tools polluting your system
- **Consistent** - Everyone gets the exact same environment
- **Portable** - Works on Windows, Mac, Linux identically
- **Isolated** - Multiple projects don't interfere with each other
- **Documented** - Dockerfile and devcontainer.json describe the environment
- **CI/CD alignment** - Same Docker image used locally and in CI

### 🤔 Potential Concerns

**"But I want immediate feedback on errors!"**

- Run `make lint` before committing (takes 1-3 seconds)
- IDE integrations work inside DevContainer (ESLint extension)
- CI gives feedback within 5-10 minutes

**"What if I forget to run checks?"**

- CI will catch it and block the merge
- Quick feedback loop in PR review
- Can add a reminder in CONTRIBUTING.md

**"Pre-commit hooks are industry standard!"**

- True for traditional setups
- DevContainer is a different paradigm
- CI/CD is the real standard for quality gates

## IDE Integration

### ESLint in VS Code

Install the ESLint extension inside the DevContainer:

```json
// .devcontainer/devcontainer.json
{
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  }
}
```

Now you get **real-time linting** in the editor!

### Vitest Extension

For test feedback:

```json
{
  "extensions": ["vitest.explorer"]
}
```

## Alternative: Optional Pre-Commit for Power Users

If you **really** want pre-commit hooks on your host, you can set them up individually:

1. Install Node.js and pnpm on your host (outside DevContainer)
2. Run `pnpm install` on host
3. Install husky: `pnpm add -D husky lint-staged`
4. Set up hooks

**But this defeats the DevContainer purpose and is NOT recommended.**

## Comparison

| Approach         | DevContainer Philosophy | Traditional                   |
| ---------------- | ----------------------- | ----------------------------- |
| **Host Tools**   | Git + Docker only       | Git + Node + pnpm + ESLint    |
| **Pre-Commit**   | Manual (`make lint`)    | Automatic (husky)             |
| **Quality Gate** | CI/CD                   | Pre-commit + CI               |
| **Setup Time**   | 5 min (Docker pull)     | 15-30 min (install all tools) |
| **Consistency**  | ✅ Perfect              | ⚠️ Varies by dev              |
| **Portability**  | ✅ Any OS               | ⚠️ Path issues                |

## Summary

🎯 **Best Practice:**

1. Develop inside DevContainer
2. Run `make lint && make test && make build` before committing
3. Let CI/CD be the authoritative quality gate
4. Keep host machine clean

🚫 **Avoid:**

- Installing dev tools on host
- Pre-commit hooks that require host dependencies
- Mixing host and container environments

📚 **Documentation:**

- See `.github/CI-QUICK-REF.md` for CI/CD details
- See `.github/REGISTRY-SETUP.md` for deployment
- See `README.md` for getting started

## Getting Started

```bash
# 1. On host: Clone and open in VS Code
git clone https://github.com/Talkashi1111/ft_transcendence.git
code ft_transcendence

# 2. Reopen in DevContainer (VS Code prompt)

# 3. Inside DevContainer: Start development
make dev

# 4. Create a feature branch (NEVER work on main directly!)
git checkout -b feature/my-awesome-feature

# 5. Make your changes, then run all checks
make all

# 6. On host: Commit and push to your feature branch
git add .
git commit -m "feat: my awesome feature"
git push origin feature/my-awesome-feature

# 7. Create Pull Request on GitHub

# 8. CI automatically validates everything! ✅
```

That's it! Simple, clean, and follows DevContainer best practices. 🎉
