# ft_transcendence

This project is about creating a website for the mighty Pong contest.

---

## 🚀 Quick Start

### First Time Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ft_transcendence
   ```

2. **Configure environment variables**

   ```bash
   # Copy example env file
   cp backend/.env.example backend/.env

   # Edit backend/.env and configure:
   # - JWT_SECRET (change in production!)
   # - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (for OAuth)
   # - PRIVATE_KEY (for blockchain, optional)
   # - Other settings as needed
   ```

3. **Open in VS Code with DevContainer**

   ```bash
   # Open VS Code
   code .

   # VS Code will prompt: "Reopen in Container" - click it
   # Or use Command Palette: "Dev Containers: Reopen in Container"
   ```

4. **DevContainer will automatically:**
   - Install all dependencies (`pnpm install`)
   - Generate Prisma client
   - Initialize database (migrations + seed) if not exists
   - This takes 2-3 minutes on first run

5. **Start development servers**
   ```bash
   make dev
   # or
   pnpm run dev
   ```

### Development (Inside Devcontainer)

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

# 2. Deploy production with HTTPS (uses Caddy reverse proxy)
docker compose -f docker-compose.prod.yml up -d

# Or rebuild locally if you made changes
docker compose -f docker-compose.prod.yml up --build
```

**Access:** https://localhost (HTTPS on port 443)

> **Note:**
>
> - Production uses HTTPS with Caddy reverse proxy
> - Browser will show certificate warning (self-signed) - click "Advanced" → "Proceed"
> - HTTP automatically redirects to HTTPS
> - Uses pre-built images from GitHub Actions CI
> - To use latest image, update the tag in `docker-compose.prod.yml`
> - Or uncomment the `build` section to build locally

---

## 🔐 HTTPS Setup (Production & Defense)

Production requires HTTPS for all connections. The project uses **Caddy** as a reverse proxy with automatic TLS.

### Quick Start (localhost only)

```bash
# Add to /etc/hosts (one-time setup)
echo "127.0.0.1 mooo.com" | sudo tee -a /etc/hosts

# Create .env.prod with JWT secret
cp .env.prod.example .env.prod
# Edit .env.prod and set JWT_SECRET (generate with: openssl rand -hex 32)

# Start production stack
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Access at https://mooo.com
# Accept the self-signed certificate warning in your browser
```

### Local Network Defense (School/Hotspot)

For defense presentations where others need to access your site via `mooo.com`:

1. **Find your server's IP address:**

   ```bash
   # macOS
   ipconfig getifaddr en0

   # Linux
   hostname -I | awk '{print $1}'

   # Windows
   ipconfig  # Look for IPv4 Address
   ```

2. **On the SERVER machine, add to `/etc/hosts`:**

   ```bash
   echo "127.0.0.1 mooo.com" | sudo tee -a /etc/hosts
   ```

3. **On EACH CLIENT machine, add to `/etc/hosts`:**

   ```bash
   # Replace 192.168.1.100 with the server's actual IP
   echo "192.168.1.100 mooo.com" | sudo tee -a /etc/hosts
   ```

   - **macOS/Linux:** `/etc/hosts`
   - **Windows:** `C:\Windows\System32\drivers\etc\hosts` (run notepad as Admin)

4. **Setup Google OAuth (one-time):**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Add `https://mooo.com` to Authorized JavaScript origins
   - Add `https://mooo.com/api/oauth/google/callback` to Authorized redirect URIs

5. **Start production on the server:**

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

6. **Access from any device:**
   - Open `https://mooo.com` in browser
   - Accept the self-signed certificate warning
   - OAuth login works from any device!

### Architecture

```
Internet/Local Network
         │
         ▼
    ┌─────────┐
    │  Caddy  │ :443 (HTTPS) / :80 (HTTP→HTTPS redirect)
    │  Proxy  │ TLS termination, routing
    └────┬────┘
         │ Internal network (HTTP)
         ▼
    ┌─────────┐
    │ Backend │ :3000 (internal only)
    │ Fastify │ API + Static files
    └─────────┘
         │
         ▼
    ┌─────────┐
    │ SQLite  │ /app/data/database.db
    └─────────┘
```

### Swagger UI Access

Swagger UI (`/docs`) is accessible in production from:

- localhost (127.0.0.1)
- Private networks (192.168.x.x, 10.x.x.x, 172.16-31.x.x)

Access from other IPs is blocked for security.

### Troubleshooting HTTPS

**Certificate warning in browser:**

- This is expected with self-signed certificates
- Click "Advanced" → "Proceed to [site]" (Chrome)
- Or "Accept the Risk and Continue" (Firefox)

**OAuth not working with HTTPS:**

- Update `OAUTH_CALLBACK_URI` in `backend/.env` to use `https://`
- Update Google Cloud Console with HTTPS redirect URIs

**Can't access from other devices:**

- Ensure firewall allows ports 443 and 80
- Verify `/etc/hosts` on client points to server IP
- Check that devices are on the same network

---

## 📋 Project Structure

```
ft_transcendence/
├── frontend/          # TypeScript + Vite + Tailwind CSS (vanilla, no frameworks)
├── backend/           # Fastify + Prisma + SQLite + JWT auth
├── blockchain/        # Hardhat + Solidity + Avalanche
├── caddy/             # Caddy reverse proxy configuration
│   ├── Caddyfile      # Routing and TLS configuration
│   └── generate-certs.sh  # Self-signed certificate generator
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

# Migrations
make migrate                   # Run pending migrations
make migrate-reset             # Reset database and rerun all migrations

# Database seeding
make seed                      # Add demo data to dev database
make seed-reset                # Clear and reseed database

# Initialize database (migrations + seed)
make db-init                   # Run migrations and seed (if DB not exists)

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

### Environment Variables Not Loading

**Problem:** Backend fails to start with "JWT_SECRET must be set" or "GOOGLE_CLIENT_ID is undefined"

**Solution:**

```bash
# 1. Verify .env file exists and is uncommented
cat backend/.env

# 2. Lines must NOT start with # (except actual comments)
# WRONG:  # JWT_SECRET="secret"
# RIGHT:  JWT_SECRET="secret"

# 3. Restart dev server
make dev
```

### Database Not Initialized

**Problem:** "Table 'User' does not exist" or similar Prisma errors

**Solution:**

```bash
# Manually initialize database
make db-init

# Or run migrations + seed separately
make migrate
make seed

# Nuclear option: reset everything
make migrate-reset
```

### OAuth Not Working

**Problem:** Google OAuth fails or redirects incorrectly

**Solution:**

```bash
# 1. Verify OAuth credentials in backend/.env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
OAUTH_CALLBACK_URI=http://localhost:5173/api/oauth/google/callback

# 2. Check Google Cloud Console settings:
#    - Authorized JavaScript origins: http://localhost:5173
#    - Authorized redirect URIs: http://localhost:5173/api/oauth/google/callback

# 3. For production, update:
#    - oauth.route.ts line 123 redirect URL to your production domain
#    - OAUTH_CALLBACK_URI in production .env
#    - Google Cloud Console with production URIs
```

### Port Already in Use

**Problem:** "Port 3000/5173/8080 already in use"

**Solution:**

```bash
# Find what's using the port
lsof -i :3000
lsof -i :5173
lsof -i :8080

# Kill the process or change port in docker-compose.yml
ports:
  - "9090:3000"  # Change 8080 to any free port
```

### Build Fails

**Problem:** Production build or TypeScript compilation errors

**Solution:**

```bash
# Clean and rebuild everything
docker compose -f docker-compose.prod.yml down --volumes
docker compose -f docker-compose.prod.yml up --build --force-recreate

# Inside devcontainer, test build
make build
```

### Database Locked or Corrupted

**Problem:** "database is locked" or other SQLite errors

**Solution:**

```bash
# 1. Stop all processes using database
pkill -f node

# 2. Check for .db-journal or .db-wal files
ls -la data/

# 3. Reset database (WARNING: deletes all data)
rm data/database.db*
make db-init

# Or use Prisma's reset
make migrate-reset
```

### DevContainer Fails to Build

**Problem:** DevContainer build errors or hangs

**Solution:**

```bash
# 1. Rebuild container from VS Code
# Command Palette: "Dev Containers: Rebuild Container"

# 2. Or from command line (exit devcontainer first)
exit
docker compose -f docker-compose.dev.yml down --volumes
docker compose -f docker-compose.dev.yml up --build

# 3. Clear Docker cache if still failing
docker system prune -a
```

### Prisma Client Not Generated

**Problem:** "Cannot find module '@prisma/client'" or similar

**Solution:**

```bash
# Regenerate Prisma client
cd backend
npx prisma generate

# Or use make command from root
make install  # Runs postinstall hook which generates Prisma client
```

### Missing Dependencies

**Problem:** "Cannot find module 'fastify'" or similar import errors

**Solution:**

```bash
# Reinstall all dependencies
pnpm install

# Or clean install
rm -rf node_modules frontend/node_modules backend/node_modules
pnpm install
```

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
