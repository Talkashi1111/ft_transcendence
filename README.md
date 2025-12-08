# ft_transcendence

This project is about creating a website for the mighty Pong contest.

---

## 🚀 Quick Start

### Development (Inside Devcontainer)

```bash
# Run both frontend + backend
pnpm run dev
# or
make dev
```

| Service           | URL                        | Description                  |
| ----------------- | -------------------------- | ---------------------------- |
| **Frontend**      | http://localhost:5173      | Vite dev server              |
| **Backend API**   | http://localhost:3000      | Fastify REST API             |
| **Swagger Docs**  | http://localhost:3000/docs | Interactive API explorer     |
| **Prisma Studio** | http://localhost:5555      | Database GUI (`make studio`) |

### Starting Prisma Studio

```bash
# From project root
make studio

# Or from backend directory
cd /app/backend && npx prisma studio --port 5555
```

### Production (From Host Machine)

```bash
# 1. Exit devcontainer first
exit

# 2. Deploy production (uses pre-built image from GitHub)
docker compose -f docker-compose.prod.yml up -d

# Or rebuild locally if you made changes
docker compose -f docker-compose.prod.yml up --build
```

**Access:** http://localhost:8080

> **Note:**
>
> - Production uses pre-built images from GitHub Actions CI
> - To use latest image, update the tag in `docker-compose.prod.yml`
> - Or uncomment the `build` section to build locally

---

## 📋 Project Structure

```
ft_transcendence/
├── frontend/          # TypeScript + Vite + Tailwind CSS (vanilla, no frameworks)
├── backend/           # Fastify + Prisma + SQLite + JWT auth
├── blockchain/        # Hardhat + Solidity + Avalanche
├── data/              # SQLite database (persistent volume)
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── Dockerfile
```

---

## 🛠️ Common Commands

### Development

```bash
make dev            # Run both frontend + backend
make format         # Format all files with Prettier
make lint           # Lint all
make test           # Test all (frontend + backend + blockchain)
make build          # Build frontend + backend
make all            # Format, lint, test, and build

# Run separately
make frontend       # Frontend only
make backend        # Backend only
```

### Database (Prisma)

```bash
# Prisma Studio (can run from root!)
make studio                    # Database GUI at http://localhost:5555

# Database seeding
make seed                      # Add demo data to dev database
make seed-reset                # Clear and reseed database

# Migrations
make migrate                   # Run pending migrations
make migrate-reset             # Reset database and rerun all migrations

# Other Prisma commands (must run from /app/backend)
cd /app/backend
npx prisma migrate dev         # Create new migration
npx prisma generate            # Regenerate Prisma Client
```

### Blockchain

```bash
pnpm run blockchain:compile        # Compile smart contracts
pnpm run blockchain:test           # Run blockchain tests
pnpm run blockchain:node           # Start local Hardhat node
pnpm run blockchain:deploy:local   # Deploy to local node
pnpm run blockchain:deploy:fuji    # Deploy to Avalanche Fuji testnet

# Or use make commands
make blockchain-compile
make blockchain-test
make blockchain-node
make blockchain-deploy-local
make blockchain-deploy-fuji
```

### Production

```bash
# Start
docker compose -f docker-compose.prod.yml up -d --build

# Logs
docker compose -f docker-compose.prod.yml logs -f

# Stop
docker compose -f docker-compose.prod.yml down

# Rebuild from scratch
docker compose -f docker-compose.prod.yml down --volumes
docker compose -f docker-compose.prod.yml up --build --force-recreate
```

---

## 🏗️ Initial Project Setup

<details>
<summary>Click to expand setup instructions (already done!)</summary>

### DevContainer Setup

Install devcontainer CLI:

```bash
sudo npm install -g @devcontainers/cli
```

Create devcontainer:

```bash
devcontainer templates apply --workspace-folder . \
    --template-id ghcr.io/devcontainers/templates/javascript-node-postgres:latest
```

### Frontend Setup

```bash
# Create Vite project with vanilla TypeScript
pnpm create vite frontend --template vanilla-ts
cd frontend
pnpm install

# Install Tailwind CSS
pnpm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

### Backend Setup

```bash
# Initialize backend
cd /app/backend
pnpm init
pnpm i fastify
pnpm i -D typescript @types/node

# Initialize TypeScript
npx tsc --init
# (Set target to es2017 in tsconfig.json)

# Add dependencies
pnpm add -D nodemon
pnpm i @sinclair/typebox

# Setup SQLite3
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

### Blockchain Setup

```bash
# Create blockchain workspace
mkdir -p /app/blockchain
cd /app/blockchain

# Initialize package.json
pnpm init

# Initialize Hardhat project (choose "Create a TypeScript project with Viem")
pnpm dlx hardhat --init

# Add blockchain to workspace
# Edit /app/pnpm-workspace.yaml and add:
#   - 'blockchain'

# Add blockchain scripts to root package.json
# Add to "scripts" section:
#   "blockchain:compile": "pnpm --filter blockchain run compile"
#   "blockchain:test": "pnpm --filter blockchain run test"
#   "blockchain:deploy:local": "pnpm --filter blockchain run deploy:local"
#   "blockchain:deploy:fuji": "pnpm --filter blockchain run deploy:fuji"
#   "blockchain:node": "pnpm --filter blockchain run node"

# Install Viem in backend for contract interaction
cd /app/backend
pnpm add viem@^2.38.4
```

</details>

---

## 🏭 Architecture

### Development Mode

```
Frontend :5173 (Vite)  ←→  Backend :3000 (Fastify)
```

### Production Mode

```
Port :8080 (host) → :3000 (container)
    ↓
Backend (Fastify)
├── /api/* → API endpoints
└── /*     → Frontend static files (TypeScript + Tailwind)
    ↓
SQLite Database (persistent volume)
```

> **Port Mapping:** Production uses port 8080 on your host to avoid conflicts with devcontainer

---

## ⛓️ Blockchain Integration

This project includes smart contract functionality for storing tournament scores on the Avalanche blockchain.

### Architecture

```
Backend (Fastify)
    ↓
Viem (Contract Interaction)
    ↓
Smart Contract (TournamentScores.sol)
    ↓
Avalanche Fuji Testnet (EVM-compatible)
```

### Working with Smart Contracts

Smart contracts are compiled separately from the main build process. Only compile when you modify Solidity code.

```bash
# Compile contracts (run only when contracts change)
pnpm run blockchain:compile
# or
make blockchain-compile

# Run tests
pnpm run blockchain:test
# or
make blockchain-test

# Start local Hardhat node (for testing)
pnpm run blockchain:node
# or
make blockchain-node

# Deploy to local node (in another terminal)
pnpm run blockchain:deploy:local
# or
make blockchain-deploy-local

# Deploy to Avalanche Fuji testnet
pnpm run blockchain:deploy:fuji
# or
make blockchain-deploy-fuji
```

> **Note:** Smart contract compilation is **not** included in `pnpm run build` to avoid slowing down normal development. Compiled artifacts are committed to git.

### Configuration

1. Configure environment variables for blockchain and backend:

   ```bash
   # Backend (includes server + blockchain config)
   cp backend/.env.example backend/.env

   # Blockchain (for deployment only)
   cp blockchain/.env.example blockchain/.env

   # Edit both files with your wallet private key:
   PRIVATE_KEY=your_wallet_private_key_here
   FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
   ```

2. Get testnet AVAX from the [Avalanche Fuji Faucet](https://build.avax.network/console/primary-network/faucet)

3. After deploying the contract, update `CONTRACT_ADDRESS` in `backend/.env`

### Project Structure

```
blockchain/
├── contracts/          # Solidity smart contracts
│   └── TournamentScores.sol
├── ignition/          # Deployment modules
│   └── modules/
├── test/              # Contract tests
├── hardhat.config.ts  # Hardhat configuration
└── package.json       # Scripts and dependencies
```

For more details, see [blockchain/README.md](blockchain/README.md)

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
lsof -i :8080

# Or change port in docker-compose.prod.yml
ports:
  - "9090:3000"  # Change 8080 to any free port
```

### Build Fails

```bash
# Clean and rebuild
docker compose -f docker-compose.prod.yml down --volumes
docker compose -f docker-compose.prod.yml up --build --force-recreate
```

### Database Issues

Database is automatically persisted in Docker volume `sqlite-data`.

---

## 📚 Tech Stack

| Layer          | Technology                                                 |
| -------------- | ---------------------------------------------------------- |
| **Frontend**   | TypeScript (vanilla), Vite, Tailwind CSS                   |
| **Backend**    | Fastify, @fastify/cookie, @fastify/jwt, Prisma ORM, Argon2 |
| **Auth**       | httpOnly cookies, JWT (24h), Google OAuth 2.0              |
| **Database**   | SQLite                                                     |
| **Blockchain** | Hardhat 3.0.9, Solidity 0.8.28, Viem, Avalanche Fuji       |
| **Dev Env**    | DevContainer (Node.js 22), Prettier, ESLint                |
| **Deploy**     | Docker, Docker Compose                                     |

---

## 🤝 Contributing

1. Make changes in devcontainer
2. Test with `pnpm run dev`
3. Build with `pnpm run build`
4. Test production with `docker compose -f docker-compose.prod.yml up --build`
5. Commit and push

---

**Need help?** Check the `Makefile` for available commands!
