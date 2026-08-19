.PHONY: up down build logs admin migrate test restart psql backend-shell frontend-shell

up:
	docker compose up --build

up-d:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

restart:
	docker compose restart

admin:
	docker compose exec backend python -m app.scripts.create_admin

migrate:
	docker compose exec backend alembic upgrade head

migrate-down:
	docker compose exec backend alembic downgrade -1

test:
	docker compose exec backend pytest -q

psql:
	docker compose exec postgres psql -U facegate -d facegate

backend-shell:
	docker compose exec backend bash

frontend-shell:
	docker compose exec frontend sh
