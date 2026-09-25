# Migration PostgreSQL de Cartoonova vers le VPS

## État

Migration terminée le 25 septembre 2026. Le site reste hébergé sur Vercel ; toutes ses connexions PostgreSQL passent par un tunnel SSH épinglé vers PostgreSQL 18 sur le VPS. PostgreSQL écoute uniquement sur `127.0.0.1:5432` et aucun port de base n'est publié sur Internet.

Le dump final Neon a été restauré avant le basculement. La comparaison avant et après déploiement a confirmé **21 tables et 2 537 lignes**, avec les nombres de lignes identiques par table.

Le déploiement de production `e8bbb56` répond sur `https://www.cartoonova.com` : `/api/prices` renvoie HTTP 200 et l'API de prix réservée à l'admin `/api/prices/all` renvoie HTTP 200 après authentification.

Les cinq workflows GitHub Actions utilisent maintenant `VPS_DATABASE_URL` et l'action `.github/actions/vps-db-tunnel`. Le secret GitHub `DATABASE_URL` et les variables Vercel générées par Neon ont été supprimés. Le site et les workflows ne se connectent donc plus à Neon.

Le projet Neon Launch reste disponible comme copie de retour arrière ; il n'est plus utilisé par l'application. Le conserver brièvement, puis résilier le forfait quand le retour arrière n'est plus nécessaire.

## Identifiants conservés sur le VPS

Les valeurs privées sont hors du dépôt, avec des permissions restrictives :

- URL PostgreSQL cible : `/home/ubuntu/.config/cartoonova/database-url`
- Clé privée SSH Vercel : `/home/ubuntu/.ssh/cartoonova-vercel-tunnel`
- Clé privée SSH GitHub Actions : `/home/ubuntu/.ssh/cartoonova-github-actions-tunnel`

Ne pas ajouter ces fichiers au dépôt ni les coller dans un ticket ou une conversation. Les clés publiques sont installées sur le compte SSH `cartoonova-tunnel`. Ce compte ne peut ouvrir qu'un tunnel vers `127.0.0.1:5432`.

## Réglages Vercel

`DATABASE_URL` et les cinq variables `DATABASE_SSH_*` sont configurées pour Production, Preview et Development :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | URL du fichier `/home/ubuntu/.config/cartoonova/database-url` |
| `DATABASE_SSH_HOST` | `vps-59cd971b.vps.ovh.net` |
| `DATABASE_SSH_PORT` | `22` |
| `DATABASE_SSH_USER` | `cartoonova-tunnel` |
| `DATABASE_SSH_PRIVATE_KEY` | Clé privée `cartoonova-vercel-tunnel` |
| `DATABASE_SSH_HOST_KEY_SHA256` | `86f7f29b10cc2e6401b58c542b48e508bd60d5080a64cea10eb41b1394206d60` |

La clé privée SSH est conservée au format OpenSSH complet dans une variable sensible.

## Réglages GitHub Actions

Les secrets et variables suivants sont configurés dans **Settings → Secrets and variables → Actions** du dépôt.

**Secrets**

- `VPS_DATABASE_URL` : URL PostgreSQL cible, accessible via le tunnel local du runner.
- `VPS_SSH_PRIVATE_KEY` : clé `cartoonova-github-actions-tunnel`.

**Variables**

- `VPS_SSH_HOST` : `vps-59cd971b.vps.ovh.net`
- `VPS_SSH_PORT` : `22`
- `VPS_SSH_USER` : `cartoonova-tunnel`
- `VPS_SSH_HOST_PUBLIC_KEY` : `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF8zNZ6sO+G/QPBYufy9kS2xYDpqBXzB8IRo2Sjvi/AS`

L'action `.github/actions/vps-db-tunnel/action.yml` épingle la clé hôte, puis ouvre le tunnel local utilisé par les workflows.

## Retour arrière

Ne résilier Neon qu'après la période souhaitée de vérification. Les anciens déploiements Vercel et les identifiants Neon restent le chemin de retour si nécessaire. Les nouveaux déploiements et les workflows actifs doivent rester configurés sur le VPS.
