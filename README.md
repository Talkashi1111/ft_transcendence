# ft_transcendence

This project is about creating a website for the mighty Pong contest.

---

## 🚀 Quick Start

### Development (Inside Devcontainer)

```bash
# Run both frontend + backend
pnpm run dev
```

- **Frontend:** http://localhost:5173 (hot reload)
- **Backend:** http://localhost:3000 (auto-restart)

### Production (From Host Machine)

```bash
# 1. Exit devcontainer first
exit

# 2. Deploy production
docker compose -f docker-compose.prod.yml up --build
```

**Access:** http://localhost:8080

> **Note:** You cannot run production and devcontainer simultaneously - they share the same Docker daemon. Exit devcontainer first.

---

## 📋 Project Structure

```
ft_transcendence/
├── frontend/          # React + Vite + Tailwind CSS
├── backend/           # Fastify + TypeScript + SQLite
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── Dockerfile
```

---

## 🛠️ Common Commands

### Development

```bash
pnpm run dev        # Run both frontend + backend
pnpm run build      # Build both
pnpm run test       # Test both
pnpm run lint       # Lint both

# Run separately
make frontend       # Frontend only
make backend        # Backend only
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
# Create Vite project
pnpm create vite frontend --template react-ts
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

# Approve build scripts (if needed)
pnpm approve-builds
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
└── /*     → React static files
    ↓
SQLite Database (persistent volume)
```

> **Port Mapping:** Production uses port 8080 on your host to avoid conflicts with devcontainer

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

## 🌍 Cloud Deployment

Your project is ready for:

- **Render.com** - Connect GitHub, auto-deploy
- **Railway.app** - Import repo, instant deploy
- **Fly.io** - `fly launch && fly deploy`
- **Any Docker platform** - VPS, AWS, DigitalOcean, etc.

---

## 📚 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Backend:** Fastify, TypeScript, Typebox (validation)
- **Database:** SQLite (better-sqlite3)
- **Dev Environment:** DevContainer (Node.js 22)
- **Deployment:** Docker, Docker Compose

---

## 🤝 Contributing

1. Make changes in devcontainer
2. Test with `pnpm run dev`
3. Build with `pnpm run build`
4. Test production with `docker compose -f docker-compose.prod.yml up --build`
5. Commit and push

---

**Need help?** Check the `Makefile` for available commands!
