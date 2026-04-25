# FISCA-APP

Plateforme de gestion fiscale SaaS pour entreprises au **Burkina Faso** — calcul IUTS, TVA, TPA, cotisations sociales (CNSS/CARFO), IS, IRF, IRCM, CME, Patente, conformément au CGI 2025 et à la Loi de Finances.

| Composant | Technologie | Port |
|-----------|------------|------|
| Backend API | Go 1.24 + Chi v5 + pgx/v5 | `8080` |
| Frontend | React 19 + Vite 8 + TypeScript | `5173` (dev) / `80` (prod) |
| Base de données | Neon PostgreSQL (production) | `5432` |

---

## URLs de pré-production (DigitalOcean)

| Service | URL | Statut |
|---------|-----|--------|
| Frontend | http://<DO_PREPROD_HOST> | À configurer |
| Backend API | http://<DO_PREPROD_HOST>/api | À configurer |
| Health check | http://<DO_PREPROD_HOST>/api/health | `{"db":"ok","status":"ok"}` |

---

## Architecture de déploiement

```
GitHub (danielschillem/FISCA-APP) — branche main
         │
         │ git push → déclenche GitHub Actions
         ▼
┌─────────────────────────────────────────────────────────┐
│             GitHub Actions CI/CD                        │
│   .github/workflows/docker-publish.yml                  │
│                                                         │
│   1. Build backend  (linux/amd64, multi-stage Go)       │
│   2. Build frontend (linux/amd64, VITE_API_URL baked)   │
│   3. Push images GHCR publiques                           │
│   4. SSH deploy sur droplet DigitalOcean                 │
└─────────────────────────────────────────────────────────┘
         │ docker pull :latest
         ▼
┌──────────────────────────────────────────────────────────────┐
│                 DIGITALOCEAN DROPLET (preprod)              │
│                                                              │
│  ┌──────────────────────────┐   ┌───────────────────────┐    │
│  │     fisca-backend        │   │    fisca-frontend     │    │
│  │  image: schillem7/...    │   │  image: schillem7/... │    │
│  │  port: 8080              │   │  port: 80             │    │
│  │  /api/health ✅           │   │  HTTP 200 ✅           │    │
│  └────────────┬─────────────┘   └───────────────────────┘    │
└───────────────┼──────────────────────────────────────────────┘
                │ DATABASE_URL (Neon / PostgreSQL managé)
                ▼
┌──────────────────────────────────────────────────┐
│           PostgreSQL managé (Neon ou DO)         │
└──────────────────────────────────────────────────┘
```

### Images Docker (ghcr.io — publiques)

| Image | Base | Taille approx. |
|-------|------|----------------|
| `ghcr.io/danielschillem/fisca-app-backend:latest` | golang:1.24-alpine → alpine:3.20 | ~15 MB |
| `ghcr.io/danielschillem/fisca-app-frontend:latest` | node:20-alpine → nginx:alpine | ~25 MB |

---

## Structure du projet

```
fisca-app/
├── .github/
│   └── workflows/
│       └── docker-publish.yml   # CI/CD : build/push images + deploy DigitalOcean
├── backend/                     # API Go
│   ├── cmd/server/main.go       # Point d'entrée, migrations auto, health check
│   ├── internal/
│   │   ├── api/
│   │   │   ├── router.go        # Routes + CORS
│   │   │   └── handlers/        # auth, companies, employees, declarations,
│   │   │                        # bulletins, tva, retenues, cnss, irf, ircm,
│   │   │                        # is, cme, patente, bilan, assistant, admin
│   │   ├── calc/                # Moteur fiscal (IUTS, CGI2025, tests)
│   │   ├── db/                  # Pool pgx + migrations SQL idempotentes
│   │   ├── mailer/              # Envoi d'emails SMTP
│   │   └── models/              # Types Go partagés
│   └── Dockerfile               # Multi-stage, binaire statique, user nobody
├── frontend/                    # SPA React
│   ├── src/
│   │   ├── pages/               # 25+ pages fiscales
│   │   ├── components/          # Sidebar, Topbar, NotifPanel
│   │   ├── lib/                 # api.ts, store.ts, fiscalCalc, pdfDGI, pdfBulletin
│   │   └── types/               # Types TypeScript
│   ├── Dockerfile               # Multi-stage node → nginx
│   └── nginx.conf
├── docker-compose.yml           # Stack locale (backend + frontend + postgres)
└── infra/digitalocean/          # Compose pré-prod DigitalOcean
```

---

## Développement local

### Prérequis

- Go 1.24+
- Node.js 20+
- Docker Desktop (pour la stack complète)

### Avec Docker (recommandé)

```bash
git clone https://github.com/danielschillem/FISCA-APP.git
cd FISCA-APP

# 1) Créer l'environnement local (ne pas committer .env)
cp .env.example .env

# Stack complète (backend + frontend + postgres locale)
docker compose up --build

# Frontend → http://localhost:5173
# API      → http://localhost:8080/api/health
```

### Séparation local / production (important)

- Le fichier `docker-compose.yml` est orienté **dev local** par défaut (`db` Docker local).
- La pré-prod/prod n'utilise pas ce `docker-compose.yml` dev: un compose dédié est utilisé sur le droplet DO.
- Ne mettez jamais d'identifiants prod dans `.env`, `.env.example` ou `docker-compose.yml`.
- Pour forcer une DB distante ponctuellement en local, exportez seulement `DATABASE_URL` dans votre shell avant `docker compose up`.

### Backend seul

```bash
# Copier les variables d'environnement
cp .env.example backend/.env
# Éditer backend/.env avec vos valeurs

cd backend
go run ./cmd/server/

# Tests
go test ./...
```

### Frontend seul

```bash
cd frontend
npm install

# Créer frontend/.env.local
echo "VITE_API_URL=http://localhost:8080/api" > .env.local

npm run dev
# → http://localhost:5173
```

---

## Variables d'environnement

### Backend

| Variable | Description | Production |
|----------|-------------|------------|
| `DATABASE_URL` | URL connexion PostgreSQL (sslmode=require en prod) | Neon connection string |
| `JWT_SECRET` | Clé de signature JWT (min. 32 chars) | Secret DO/GitHub |
| `ADMIN_SECRET` | Clé création compte super_admin | Secret DO/GitHub |
| `ALLOWED_ORIGIN` | CORS — origines autorisées (virgule-séparé) | `https://<frontend-domain>` |
| `MISTRAL_API_KEY` | Clé API Mistral AI (assistant fiscal) | `1jDYA7ooo...` |
| `PORT` | Port d'écoute | `8080` |
| `SMTP_HOST` | Serveur SMTP pour emails | — |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Identifiant SMTP | — |
| `SMTP_PASS` | Mot de passe SMTP | — |

### Frontend

| Variable | Description | Production |
|----------|-------------|------------|
| `VITE_API_URL` | URL base de l'API backend | optionnel (sinon `/api` via reverse-proxy) |

---

## Comptes administrateurs (production)

| Email | Rôle | Plan |
|-------|------|------|
| `admin@fisca.app` | `user` (admin) | enterprise |
| `super-admin@fisca.app` | `super_admin` | enterprise |

> Mot de passe par défaut défini lors de la configuration initiale.
> À changer via `PUT /api/auth/change-password` après la première connexion.

---

## Schéma base de données (tables principales)

```
users ──────────────────────────────────────────────────────┐
  id, email, password_hash, plan, role, user_type,          │
  is_active, org_id, org_role, created_at                   │
                                                            │
organizations ────────────────────────────────────── (FK ←─┘
  id, nom, owner_id, plan, created_at

companies ─────────────────────────────── user_id → users
  id, nom, ifu, rc, secteur, adresse, tel,
  forme_juridique, regime, centre_impots,
  ville, quartier, bp, fax, is_active

  └─── employees        (company_id → companies, CASCADE)
  └─── declarations     (IUTS mensuel)
  └─── bulletins        (bulletins de paie)
  └─── tva_declarations + tva_lignes
  └─── retenues_source  (RAS)
  └─── cnss_patronal
  └─── irf_declarations (IRF annuel)
  └─── ircm_declarations
  └─── is_declarations  (IS annuel)
  └─── cme_declarations
  └─── patente_declarations
  └─── exercices_fiscaux
  └─── simulations

refresh_tokens        → users
password_reset_tokens → users
workflow_etapes       → declarations + users
```

---

## CI/CD — Flux de déploiement (DigitalOcean)

```
git push origin main
    │
    ├─ [GitHub Actions]
    │   ├─ docker buildx build --platform linux/amd64 ./backend
    │   │    └─ CGO_ENABLED=0, GOOS=linux, -ldflags="-s -w"
    │   ├─ docker buildx build --platform linux/amd64 ./frontend
    │   ├─ docker push ghcr.io/danielschillem/fisca-app-backend:latest
    │   ├─ docker push ghcr.io/danielschillem/fisca-app-frontend:latest
    │   │
    │   └─ SSH sur droplet DO :
    │       docker compose pull && docker compose up -d
    │
    └─ [DigitalOcean droplet] redémarrage des conteneurs
```

### Secrets GitHub requis

| Secret | Usage |
|--------|-------|
| `GITHUB_TOKEN` | Automatique — push vers ghcr.io |
| `DO_PREPROD_HOST` | IP ou hostname du droplet pré-prod |
| `DO_PREPROD_USER` | Utilisateur SSH (ex: root) |
| `DO_PREPROD_SSH_KEY` | Clé privée SSH du droplet |

---

## Capacité et projections de lancement

### Limites stack actuelle (free tier)

| Ressource | Limite | Impact |
|-----------|--------|--------|
| Droplet CPU | 1 vCPU partagé | ~20–50 req/s |
| Droplet RAM | 1–2 GB | Suffisant Go + nginx |
| DB connexions | MaxConns=5 | 5 requêtes DB simultanées |
| Neon compute | 0.25 vCPU, suspendu après 5 min | Cold start DB ~2s |
| Auto-restart Docker | restart unless-stopped | Reprise rapide service |

### Capacité réelle

| Métrique | Free tier actuel |
|----------|-----------------|
| Utilisateurs inscrits | Illimité (10 GB stockage) |
| Sessions actives simultanées | **10–20** confortablement |
| Requêtes API simultanées | **5–10** sans latence |
| Pics acceptables | ~30–50 (avec dégradation) |

### Projections de croissance

| Phase | Durée | Users inscrits | Simultanés | Stack recommandée | Coût/mois |
|-------|-------|----------------|------------|-------------------|-----------|
| Beta fermée | M1–M2 | 0–50 | 2–5 | Free tier actuel | **0 FCFA** |
| Lancement public | M3–M4 | 50–200 | 10–20 | DO 2GB + Neon Launch | **~12 000 FCFA** |
| Croissance | M5–M12 | 200–1 000 | 30–80 | DO 2vCPU/4GB + Neon Launch | **~35 000 FCFA** |
| Scale | M12+ | 1 000–5 000 | 100–300 | DO 4vCPU/8GB + Neon Scale | **~90 000 FCFA** |

### Upgrade prioritaire pour le lancement (M3)

```
DigitalOcean droplet : 1GB → 2GB
  ✅ Plus de marge mémoire pour backend + frontend
  ✅ Uptime stable (pas de cold start de plate-forme)
  ✅ Déploiement contrôlé par Docker Compose
  → Coût : ~7 000 à 12 000 FCFA/mois
```

### Monitoring recommandé (gratuit)

- **UptimeRobot** — ping `GET /api/health` toutes les 5 min, alerte email si down
- **Logs Docker / journalctl** — logs en temps réel
- **Neon Dashboard** — métriques DB (connexions, stockage)

---

## Calcul fiscal — Moteur

Le moteur `backend/internal/calc/` implémente :

| Impôt | Fichier | Barème |
|-------|---------|--------|
| IUTS | `iuts.go` | 9 tranches progressives 0%→30% (LF 2020) |
| TPA | `iuts.go` | 3% patronale sur brut |
| CSS CNSS | `iuts.go` | 5,5% salarié / 16% patronal, plafond 600 000 FCFA |
| CSS CARFO | `iuts.go` | 6% salarié / 13% patronal |
| FSP | `iuts.go` | 1% sur salaire net |
| IS | `cgi2025.go` | Régime réel 27,5% / MFP 0,5% CA (CGI 2025) |
| TVA | handlers | 18% taux normal |
| IRF | handlers | 15% sur loyers (abattement 30%) |
| IRCM | handlers | Créances 20%, dividendes 12,5%, obligations 6% |
| CME | handlers | Forfait selon CA et zone |
| Patente | handlers | Barème DGI (droit fixe + proportionnel) |

---

## Commandes utiles

```bash
# Vérifier que la pré-prod est live
curl http://<DO_PREPROD_HOST>/api/health

# Lancer les tests backend
cd backend && go test ./... -v

# Lancer les tests frontend
cd frontend && npm test

# Build manuel des images Docker
docker build --platform linux/amd64 -t ghcr.io/danielschillem/fisca-app-backend:latest ./backend
docker build --platform linux/amd64 -t ghcr.io/danielschillem/fisca-app-frontend:latest ./frontend

# Pousser sur GHCR (images publiques)
docker push ghcr.io/danielschillem/fisca-app-backend:latest
docker push ghcr.io/danielschillem/fisca-app-frontend:latest
```

