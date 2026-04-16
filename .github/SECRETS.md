# GitHub Actions — Secrets requis

Configurer ces secrets dans :
**GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

## CI/CD — Render Deploy Hooks

| Secret | Valeur | Où trouver |
|--------|--------|-----------|
| `RENDER_DEPLOY_HOOK_BACKEND` | URL webhook de déploiement Render | Render Dashboard → fisca-backend → Settings → Deploy Hook → Copy |

## Procédure de premier déploiement

1. Pousser le code sur `main` → Render détecte `render.yaml` et crée le service backend
2. Une fois le backend déployé, noter son URL (`https://fisca-backend.onrender.com`)
3. Copier le Deploy Hook URL du backend dans les secrets GitHub ci-dessus
4. Le frontend Vite est servi via Docker nginx sur Render ou un VPS

## Notes de sécurité

- `JWT_SECRET` est auto-généré par Render (`generateValue: true`) — ne jamais le définir manuellement
- Ne jamais committer de secrets dans le code source
- Rotation recommandée du `JWT_SECRET` tous les 90 jours en production
