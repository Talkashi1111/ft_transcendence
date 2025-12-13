# Default target - show help
.DEFAULT_GOAL := help

## ============================================
## Docker targets (run on HOST machine)
## ============================================

.PHONY: up
up:        ## start dev stack
	docker compose -f docker-compose.dev.yml up --no-start
	docker compose -f docker-compose.dev.yml start
	docker compose -f docker-compose.dev.yml exec --user node app bash

.PHONY: exec
exec:      ## execute command in app container
	docker compose -f docker-compose.dev.yml exec --user node app bash

.PHONY: halt
halt:      ## stop dev stack
	docker compose -f docker-compose.dev.yml stop

.PHONY: rebuild
rebuild:   ## rebuild dev stack
	docker compose -f docker-compose.dev.yml up -d --force-recreate --no-deps --build app

.PHONY: destroy
destroy:    ## destroy dev stack
	docker compose -f docker-compose.dev.yml down --rmi local -v --remove-orphans

.PHONY: prune
prune:	 ## prune unused docker resources
	docker image prune -f
	docker container prune -f
	docker images | grep ft_transcendence | awk '{print $$2}' | xargs -r docker rmi -f
	docker volume prune -f
	docker builder prune -f
	docker network prune -f

.PHONY: release
release:   ## build & push prod image
	docker compose -f docker-compose.prod.yml build
	docker compose -f docker-compose.prod.yml push

## ============================================
## Development targets (run INSIDE devcontainer)
## ============================================

.PHONY: install
install:   ## install all dependencies
	pnpm install

.PHONY: check-deps
check-deps: ## check if dependencies are installed
	@if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then \
		echo "Dependencies missing, installing..."; \
		$(MAKE) install; \
	fi

.PHONY: dev
dev: check-deps ## run both frontend and backend in development mode
	pnpm run dev

.PHONY: frontend
frontend: check-deps ## run only frontend
	pnpm --filter frontend run dev

.PHONY: backend
backend: check-deps ## run only backend
	pnpm --filter backend run dev

.PHONY: studio
studio: check-deps ## open Prisma Studio (database GUI) at http://localhost:5555
	cd backend && npx prisma studio --port 5555

.PHONY: test
test: check-deps ## run Vitest + backend unit tests
	pnpm --filter frontend --filter backend exec vitest run --coverage
	pnpm --filter blockchain run test

.PHONY: lint
lint: check-deps ## run linting on all packages
	pnpm -r exec eslint .

.PHONY: format
format: check-deps ## format all files with prettier
	pnpm run format

.PHONY: build
build: check-deps ## build all packages
	pnpm run build

.PHONY: all
all: format lint test build ## run format, lint, test, and build
	@echo ""
	@echo "========================================"
	@echo "            ✅ ALL PASSED"
	@echo "========================================"
	@echo ""
	@echo "📊 Test Coverage Summary:"
	@echo "----------------------------------------"
	@if [ -f backend/coverage/coverage-summary.json ]; then \
		BACKEND_LINES=$$(grep -o '"total"[^}]*"lines"[^}]*"pct":[0-9.]*' backend/coverage/coverage-summary.json | head -1 | grep -o '[0-9.]*$$'); \
		echo "  Backend:    $${BACKEND_LINES}%"; \
	else \
		echo "  Backend:    N/A"; \
	fi
	@if [ -f frontend/coverage/coverage-summary.json ]; then \
		FRONTEND_LINES=$$(grep -o '"total"[^}]*"lines"[^}]*"pct":[0-9.]*' frontend/coverage/coverage-summary.json | head -1 | grep -o '[0-9.]*$$'); \
		echo "  Frontend:   $${FRONTEND_LINES}%"; \
	else \
		echo "  Frontend:   N/A"; \
	fi
	@echo "  Blockchain: ✓ (Solidity tests passed)"
	@echo "========================================"
	@echo ""

## ============================================
## Blockchain targets (run INSIDE devcontainer)
## ============================================

.PHONY: blockchain-compile
blockchain-compile: check-deps ## compile Solidity smart contracts
	pnpm --filter blockchain run compile

.PHONY: blockchain-test
blockchain-test: check-deps ## test smart contracts
	pnpm --filter blockchain run test

.PHONY: blockchain-node
blockchain-node: check-deps ## start local Hardhat node
	pnpm --filter blockchain run node

## ============================================
## Database targets (run INSIDE devcontainer)
## ============================================

.PHONY: db-init
db-init: check-deps ## initialize database (only if not exists)
	bash scripts/init-db.sh

.PHONY: seed
seed: check-deps ## seed database with demo data
	cd backend && npx prisma db seed

.PHONY: seed-reset
seed-reset: check-deps ## clean database and reseed
	cd backend && npx prisma db seed -- --clean

.PHONY: migrate
migrate: check-deps ## run database migrations
	cd backend && npx prisma migrate dev

.PHONY: migrate-reset
migrate-reset: check-deps ## reset database and run all migrations
	cd backend && npx prisma migrate reset --force

## ============================================
## Deployment targets (run INSIDE devcontainer)
## ============================================

.PHONY: blockchain-deploy-local
blockchain-deploy-local: check-deps ## deploy contracts to local Hardhat node
	pnpm --filter blockchain run deploy:local

.PHONY: blockchain-deploy-fuji
blockchain-deploy-fuji: check-deps ## deploy contracts to Avalanche Fuji testnet
	pnpm --filter blockchain run deploy:fuji

.PHONY: help
help: ## show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
