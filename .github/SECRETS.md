# GitHub Actions — Secrets requis

Configurer ces secrets dans :
**GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

## CI/CD — DigitalOcean preprod deploy

| Secret | Valeur | Où trouver |
|--------|--------|-----------|
| `DO_PREPROD_HOST` | IP publique du droplet pré-prod | DigitalOcean → Droplets |
| `DO_PREPROD_USER` | Utilisateur SSH (`root` recommandé en pré-prod) | Configuration droplet |
| `DO_PREPROD_SSH_KEY` | Clé privée SSH (format OpenSSH) | Clé locale utilisée pour le droplet |

## Procédure de premier déploiement

1. Créer le dossier `/opt/fisca` sur le droplet
2. Déposer un fichier `/opt/fisca/.env` avec les variables backend (DATABASE_URL, JWT_SECRET, etc.)
3. Ajouter les secrets GitHub ci-dessus
4. Push sur `main` → workflow `docker-publish.yml` build/push puis SSH deploy

## Notes de sécurité

- `JWT_SECRET` doit faire au moins 32 caractères
- Ne jamais committer de secrets dans le code source
- Rotation recommandée du `JWT_SECRET` tous les 90 jours en production
