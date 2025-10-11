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
	docker images | grep ft_transcendence | awk '{print $$3}' | xargs -r docker rmi -f
	docker volume prune -f
	docker builder prune -f

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

.PHONY: test
test: check-deps ## run Vitest + backend unit tests
	pnpm -r exec vitest run --coverage

.PHONY: lint
lint: check-deps ## run linting on all packages
	pnpm -r exec eslint .

.PHONY: build
build: check-deps ## build all packages
	pnpm run build

.PHONY: all
all: lint test build ## run lint, test, and build

.PHONY: help
help: ## show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
