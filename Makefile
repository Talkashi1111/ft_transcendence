up:        ## start dev stack
	docker compose -f docker-compose.dev.yml up --no-start
	docker compose -f docker-compose.dev.yml start
	docker compose -f docker-compose.dev.yml exec app bash

halt:      ## stop dev stack
	docker compose -f docker-compose.dev.yml stop

rebuild:   ## rebuild dev stack
	docker compose -f docker-compose.dev.yml up -d --force-recreate --no-deps --build app

destroy:    ## destroy dev stack
	docker compose -f docker-compose.dev.yml down --rmi local -v --remove-orphans

test:      ## run Vitest + backend unit tests
	pnpm -r exec vitest run --coverage

lint:
	pnpm -r exec eslint .

release:   ## build & push prod image
	docker compose -f docker-compose.prod.yml build
	docker compose -f docker-compose.prod.yml push

PHONY: up halt rebuild destroy test lint release
