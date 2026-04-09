# FISCA-APP

Plateforme de gestion fiscale pour entreprises au **Burkina Faso** — calcul IUTS, TPA et cotisations sociales (CNSS/CARFO) conformément à la Loi de Finances 2020.

| Composant | Technologie | Port |
|-----------|------------|------|
| Backend API | Go 1.22 + Chi + PostgreSQL | `8080` |
| Dashboard | Next.js 14 + TypeScript + Tailwind | `3000` |
| Base de données | PostgreSQL 16 | `5432` |

---

## Démarrage rapide (Docker)

> Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# Cloner le repo
git clone https://github.com/<org>/fisca-app.git
cd fisca-app

# Démarrer toute la stack
docker compose up --build

# L'application est accessible sur :
#   Dashboard → http://localhost:3000
#   API       → http://localhost:8080/api/health
```

---

## Développement local

### Prérequis

- Go 1.22+
- Node.js 20+
- PostgreSQL 16 (ou `docker compose up db` pour la DB seule)

### Backend

```bash
# 1. Démarrer uniquement la base de données
docker compose up db -d

# 2. Variables d'environnement (déjà présent : backend/.env)
cd backend
cat .env
# DATABASE_URL=postgres://fisca:password@localhost:5432/fisca_dev?sslmode=disable
# JWT_SECRET=dev_secret_do_not_use_in_production
# PORT=8080

# 3. Lancer le serveur (migrations automatiques au démarrage)
go run ./cmd/server/

# 4. Tests
go test ./...
```

### Dashboard

```bash
cd dashboard

# 1. Variables d'environnement (déjà présent : dashboard/.env.local)
cat .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8080

# 2. Installer les dépendances
npm install

# 3. Lancer en développement
npm run dev
# → http://localhost:3000
```

---

## Commandes utiles

```bash
# Backend — build de production
cd backend && go build -o fisca-server ./cmd/server/

# Backend — linter
cd backend && go vet ./...

# Dashboard — build de production
cd dashboard && npm run build

# Dashboard — vérification TypeScript
cd dashboard && npx tsc --noEmit
```

---

## Structure du projet

```
fisca-app/
├── backend/              # API Go
│   ├── cmd/server/       # Point d'entrée
│   ├── internal/
│   │   ├── api/          # Routeur + handlers HTTP
│   │   ├── calc/         # Moteur fiscal IUTS/TPA (+ tests)
│   │   ├── db/           # Connexion PostgreSQL + migrations
│   │   └── models/       # Types partagés
│   └── Dockerfile
├── dashboard/            # Frontend Next.js 14
│   ├── app/              # Pages (App Router)
│   ├── components/       # Sidebar, Topbar, StatCard
│   ├── lib/              # API client, Zustand store, utils
│   └── Dockerfile
├── docker-compose.yml    # Stack complète locale
└── render.yaml           # Configuration déploiement Render
```

---

## Variables d'environnement

### Backend (`backend/.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgres://fisca:password@localhost:5432/fisca_dev?sslmode=disable` |
| `JWT_SECRET` | Clé de signature JWT (min. 32 caractères en prod) | `change_this_in_production` |
| `PORT` | Port d'écoute du serveur | `8080` |

### Dashboard (`dashboard/.env.local`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL de l'API backend | `http://localhost:8080` |

---

## Déploiement (Render)

Le fichier `render.yaml` définit trois services :
- `fisca-backend` — Web Service Docker (Go)
- `fisca-dashboard` — Web Service Docker (Next.js)
- `fisca-db` — PostgreSQL managé

```bash
# Après le premier déploiement, définir dans le dashboard Render :
# fisca-dashboard → Environment → NEXT_PUBLIC_API_URL = https://fisca-backend.onrender.com
```

---

## Calcul fiscal

Le moteur `backend/internal/calc/iuts.go` implémente :

1. **IUTS** — 9 tranches progressives (0 % → 30 %) selon le barème LF 2020
2. **CSS** — CNSS 5,5 % ou CARFO 6 % (plafonné à 600 000 FCFA)
3. **TPA** — 3 % (patronale)
4. **Abattements** — forfait 20 %, exonérations logement/transport/fonction, abattement familial (1 000 FCFA × charges, plafonné à 40 % IUTS brut)
