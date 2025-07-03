# ft_transcendence

This project is about creating a website for the mighty Pong contest

Install devcontainer cli - https://github.com/devcontainers/cli:

```bash
sudo npm install -g @devcontainers/cli
```

To create devcontainer from template:

```bash
devcontainer templates apply --workspace-folder . \
    --template-id ghcr.io/devcontainers/templates/javascript-node-postgres:latest
```

## Project Setup

### Frontend Setup

```bash
# From the root directory
pnpm create vite frontend --template react-ts
cd frontend
pnpm install

# To run the development server
pnpm run dev --host 0.0.0.0

# Install Tailwind CSS
pnpm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

### Backend Setup

```bash
# Create and initialize backend
cd /app/backend
pnpm init
pnpm i fastify
pnpm i -D typescript @types/node

# Add these scripts to package.json
# "scripts": {
#     "build": "tsc -p tsconfig.json",
#     "start": "node index.js",
#     "dev": "node --watch index.js"
# }

# Initialize TypeScript
npx tsc --init

# Change target to es2017 in tsconfig.json

# Add additional dependencies
pnpm add -D nodemon
pnpm add pino --filter backend

# For JSON schema validation
pnpm i @sinclair/typebox

# Setup SQLite3
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
pnpm install

	╭ Warning ───────────────────────────────────────────────────────────────────────────────────╮
	│                                                                                            │
	│   Ignored build scripts: better-sqlite3.                                                   │
	│   Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.   │
	│                                                                                            │
	╰────────────────────────────────────────────────────────────────────────────────────────────╯

# If you see a warning about ignored build scripts, then we need to approve dependencies
# for running scripts during installation (post installation scripts).
# This security measure was added in: v10.1.0
pnpm approve-builds
# Select better-sqlite3 and approve the build

	✔ Choose which packages to build (Press <space> to select, <a> to toggle all, <i> to invert selection) · better-sqlite3
	✔ The next packages will now be built: better-sqlite3.
	Do you approve? (y/N) · true
	../node_modules/.pnpm/better-sqlite3@12.2.0/node_modules/better-sqlite3: Running install script, done in 1.8s
```
