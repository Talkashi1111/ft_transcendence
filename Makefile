up:        ## start dev stack
	docker compose -f docker-compose.dev.yml up --no-start
	docker compose -f docker-compose.dev.yml start
	docker compose -f docker-compose.dev.yml exec --user node app bash

exec:      ## execute command in app container
	docker compose -f docker-compose.dev.yml exec --user node app bash

halt:      ## stop dev stack
	docker compose -f docker-compose.dev.yml stop

rebuild:   ## rebuild dev stack
	docker compose -f docker-compose.dev.yml up -d --force-recreate --no-deps --build app

destroy:    ## destroy dev stack
	docker compose -f docker-compose.dev.yml down --rmi local -v --remove-orphans

prune:	 ## prune unused docker resources
	docker image prune -f
	docker container prune -f
	docker images | grep ft_transcendence | awk '{print $$3}' | xargs -r docker rmi -f
	docker volume prune -f
	docker builder prune -f

install:   ## install all dependencies
	pnpm install

check-deps: ## check if dependencies are installed
	@if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then \
		echo "Dependencies missing, installing..."; \
		$(MAKE) install; \
	fi

dev: check-deps ## run both frontend and backend in development mode
	pnpm run dev

frontend: check-deps ## run only frontend
	pnpm --filter frontend run dev

backend: check-deps ## run only backend
	pnpm --filter backend run dev

test: check-deps ## run Vitest + backend unit tests
	pnpm -r exec vitest run --coverage

lint: check-deps ## run linting on all packages
	pnpm -r exec eslint .

build: check-deps ## build all packages
	pnpm run build

release:   ## build & push prod image
	docker compose -f docker-compose.prod.yml build
	docker compose -f docker-compose.prod.yml push

PHONY: up halt rebuild destroy test lint release prune install check-deps dev frontend backend build
