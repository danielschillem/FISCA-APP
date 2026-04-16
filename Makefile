.PHONY: help up down dev-db dev-backend dev-frontend build test lint lint-backend lint-frontend clean logs ps

# ── Aide ──────────────────────────────────────────────────────
help:
	@echo "FISCA-APP — Commandes disponibles"
	@echo ""
	@echo "  Développement local (sans Docker)"
	@echo "  make dev-db            Démarrer uniquement PostgreSQL"
	@echo "  make dev-backend       Lancer le backend Go"
	@echo "  make dev-frontend      Lancer le frontend Vite (port 5173)"
	@echo ""
	@echo "  Docker"
	@echo "  make up                Démarrer la stack complète (rebuild)"
	@echo "  make up-fast           Démarrer sans rebuild"
	@echo "  make down              Arrêter les conteneurs"
	@echo "  make logs              Afficher les logs (follow)"
	@echo "  make ps                État des conteneurs"
	@echo ""
	@echo "  Tests"
	@echo "  make test              Tests unitaires Go (race detector)"
	@echo "  make test-cover        Tests Go avec rapport de couverture"
	@echo "  make test-frontend     Tests unitaires Vitest (fiscalCalc.ts)"
	@echo "  make test-all          CI : Go + Vitest + lint + type-check"
	@echo ""
	@echo "  Build & qualité"
	@echo "  make build             Builder backend + frontend"
	@echo "  make lint              Linter backend + frontend"
	@echo "  make clean             Supprimer binaires et volumes Docker"

# ── Docker ────────────────────────────────────────────────────
up:
	docker compose up --build

up-fast:
	docker compose up

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

dev-db:
	docker compose up db -d

# ── Backend ───────────────────────────────────────────────────
dev-backend:
	cd backend && go run ./cmd/server/

test:
	cd backend && go test ./... -v -race -count=1

test-cover:
	cd backend && go test ./... -coverprofile=coverage.out -covermode=atomic && go tool cover -func=coverage.out

lint-backend:
	cd backend && go vet ./...

build-backend:
	cd backend && go build -o fisca-server ./cmd/server/

# ── Frontend React + Vite (port 5173) ────────────────────────
dev-frontend:
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

lint-frontend:
	cd frontend && npx tsc --noEmit

test-frontend:
	cd frontend && npm test

# ── All tests (CI) ───────────────────────────────────────────
test-all: test test-frontend lint-backend lint-frontend
	@echo "✅ All tests and type-checks passed"

# ── All ───────────────────────────────────────────────────────
build: build-backend build-frontend

lint: lint-backend lint-frontend

clean:
	rm -f backend/fisca-server backend/fisca-server.exe
	docker compose down -v

