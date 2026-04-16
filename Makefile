.PHONY: help up down dev-db dev-backend dev-frontend dev-dashboard build test test-e2e lint lint-backend lint-frontend lint-dashboard clean logs ps

# ── Aide ──────────────────────────────────────────────────────
help:
	@echo "FISCA-APP — Commandes disponibles"
	@echo ""
	@echo "  Développement local (sans Docker)"
	@echo "  make dev-db            Démarrer uniquement PostgreSQL"
	@echo "  make dev-backend       Lancer le backend Go"
	@echo "  make dev-frontend      Lancer le frontend Vite (port 5173)"
	@echo "  make dev-dashboard     Lancer le dashboard Next.js (port 3000)"
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
	@echo "  make test-e2e          Tests E2E Playwright (dashboard)"
	@echo "  make test-all          CI : Go + Vitest + lint + type-check"
	@echo ""
	@echo "  Build & qualité"
	@echo "  make build             Builder backend + frontend + dashboard"
	@echo "  make lint              Linter backend + frontend + dashboard"
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

# ── Dashboard Next.js (port 3000) ────────────────────────────
dev-dashboard:
	cd dashboard && npm run dev

build-dashboard:
	cd dashboard && npm run build

lint-dashboard:
	cd dashboard && npm run lint

type-check-dashboard:
	cd dashboard && npx tsc --noEmit

# ── Tests E2E Playwright ─────────────────────────────────────
test-e2e:
	cd dashboard && npx playwright test

test-e2e-ui:
	cd dashboard && npx playwright test --ui

# ── All tests (CI) ───────────────────────────────────────────
test-all: test test-frontend lint-backend lint-frontend type-check-dashboard
	@echo "✅ All tests and type-checks passed"

# ── All ───────────────────────────────────────────────────────
build: build-backend build-frontend build-dashboard

lint: lint-backend lint-frontend lint-dashboard

clean:
	rm -f backend/fisca-server backend/fisca-server.exe
	docker compose down -v

