# GitHub Actions — Secrets requis

Configurer ces secrets dans :
**GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

## CI/CD — Render Deploy Hooks

| Secret | Valeur | Où trouver |
|--------|--------|-----------|
| `RENDER_DEPLOY_HOOK_BACKEND` | URL webhook de déploiement Render | Render Dashboard → fisca-backend → Settings → Deploy Hook → Copy |
| `RENDER_DEPLOY_HOOK_DASHBOARD` | URL webhook de déploiement Render | Render Dashboard → fisca-dashboard → Settings → Deploy Hook → Copy |

## Frontend Build

| Secret | Valeur | Notes |
|--------|--------|-------|
| `NEXT_PUBLIC_API_URL` | `https://fisca-backend.onrender.com` | URL de production du backend |

## Procédure de premier déploiement

1. Pousser le code sur `main` → Render détecte `render.yaml` et crée les services
2. Une fois le backend déployé, noter son URL (`https://fisca-backend.onrender.com`)
3. Dans Render Dashboard → fisca-dashboard → Environment → ajouter `NEXT_PUBLIC_API_URL`
4. Copier les Deploy Hook URLs des deux services dans les secrets GitHub ci-dessus
5. Les prochains pushs sur `main` déploient automatiquement via GitHub Actions

## Notes de sécurité

- `JWT_SECRET` est auto-généré par Render (`generateValue: true`) — ne jamais le définir manuellement
- Ne jamais committer de secrets dans le code source
- Rotation recommandée du `JWT_SECRET` tous les 90 jours en production
