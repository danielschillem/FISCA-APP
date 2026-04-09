.PHONY: help up down dev-db dev-backend dev-dashboard build test lint clean

# ── Aide ──────────────────────────────────────────────────────
help:
	@echo "FISCA-APP — Commandes disponibles"
	@echo ""
	@echo "  make up              Démarrer la stack complète (Docker)"
	@echo "  make down            Arrêter et supprimer les conteneurs"
	@echo "  make dev-db          Démarrer uniquement PostgreSQL"
	@echo "  make dev-backend     Lancer le backend Go (hors Docker)"
	@echo "  make dev-dashboard   Lancer le dashboard Next.js (hors Docker)"
	@echo "  make build           Builder backend + dashboard"
	@echo "  make test            Lancer tous les tests Go"
	@echo "  make lint            Vérifier backend (vet) + dashboard (tsc)"
	@echo "  make clean           Supprimer les binaires et volumes Docker"

# ── Docker ────────────────────────────────────────────────────
up:
	docker compose up --build

down:
	docker compose down

dev-db:
	docker compose up db -d

# ── Backend ───────────────────────────────────────────────────
dev-backend:
	cd backend && go run ./cmd/server/

test:
	cd backend && go test ./... -v

lint-backend:
	cd backend && go vet ./...

build-backend:
	cd backend && go build -o fisca-server ./cmd/server/

# ── Dashboard ─────────────────────────────────────────────────
dev-dashboard:
	cd dashboard && npm run dev

build-dashboard:
	cd dashboard && npm run build

lint-dashboard:
	cd dashboard && npx tsc --noEmit

# ── All ───────────────────────────────────────────────────────
build: build-backend build-dashboard

lint: lint-backend lint-dashboard

clean:
	rm -f backend/fisca-server backend/fisca-server.exe
	docker compose down -v
