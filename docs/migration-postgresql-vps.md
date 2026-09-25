# Migration PostgreSQL de Cartoonova vers le VPS

## État

Le serveur PostgreSQL 18 du VPS est installé et écoute uniquement sur `127.0.0.1:5432`. L'export Neon a été restauré et vérifié : **21 tables et 2 537 lignes**. Cette copie correspond à l'instant de l'export ; Neon reste la base active jusqu'au basculement de Vercel.

Le forfait Launch a rétabli l'accès nécessaire à l'export. Après le basculement complet, l'application et les workflows n'utiliseront plus Neon ; il faudra conserver Neon le temps de vérifier le site, puis le résilier.

Le code garde Vercel pour le site. Vercel ouvre un tunnel SSH épinglé directement depuis le runtime Node ; les tâches GitHub Actions ouvrent un tunnel local vers le même PostgreSQL. Aucun port PostgreSQL n'est publié sur Internet et aucun forfait d'IP statique Vercel n'est requis. Les modifications de code sont préparées sur la branche `codex/migrate-cartoonova-postgres` ; les variables Vercel et GitHub et le déploiement restent à effectuer.

## Identifiants préparés sur le VPS

Les valeurs privées ont été générées et enregistrées hors du dépôt, avec des permissions restrictives :

- URL PostgreSQL cible : `/home/ubuntu/.config/cartoonova/database-url`
- Clé privée SSH Vercel : `/home/ubuntu/.ssh/cartoonova-vercel-tunnel`
- Clé privée SSH GitHub Actions : `/home/ubuntu/.ssh/cartoonova-github-actions-tunnel`

Ne pas ajouter ces fichiers au dépôt ni les coller dans un ticket ou une conversation. Les deux clés publiques sont déjà installées sur le compte SSH `cartoonova-tunnel`. Ce compte ne peut ouvrir qu'un tunnel vers `127.0.0.1:5432`.

## Réglages Vercel

Dans les variables d'environnement **Production** du projet Vercel, remplacer `DATABASE_URL` par le contenu du fichier cible ci-dessus et ajouter :

| Variable | Valeur |
| --- | --- |
| `DATABASE_SSH_HOST` | `vps-59cd971b.vps.ovh.net` |
| `DATABASE_SSH_PORT` | `22` |
| `DATABASE_SSH_USER` | `cartoonova-tunnel` |
| `DATABASE_SSH_PRIVATE_KEY` | Contenu de `cartoonova-vercel-tunnel` |
| `DATABASE_SSH_HOST_KEY_SHA256` | `86f7f29b10cc2e6401b58c542b48e508bd60d5080a64cea10eb41b1394206d60` |

La clé doit être copiée dans son format OpenSSH complet, avec ses lignes `BEGIN` et `END`.

## Réglages GitHub Actions

Dans **Settings → Secrets and variables → Actions** du dépôt, mettre à jour/créer :

**Secrets**

- `VPS_DATABASE_URL` : URL PostgreSQL cible. Le nouveau nom laisse tourner les anciens workflows encore sur Neon jusqu'à la fusion de la branche de migration.
- `VPS_SSH_PRIVATE_KEY` : contenu de `cartoonova-github-actions-tunnel`.

**Variables**

- `VPS_SSH_HOST` : `vps-59cd971b.vps.ovh.net`
- `VPS_SSH_PORT` : `22`
- `VPS_SSH_USER` : `cartoonova-tunnel`
- `VPS_SSH_HOST_PUBLIC_KEY` : `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIF8zNZ6sO+G/QPBYufy9kS2xYDpqBXzB8IRo2Sjvi/AS` (clé publique vérifiée par rapport à l'empreinte épinglée ci-dessus).

Le fichier `.github/actions/vps-db-tunnel/action.yml` installe la clé épinglée dans `known_hosts`, puis ouvre le tunnel local pour les workflows qui écrivent ou lisent PostgreSQL.

## Export et basculement

1. Juste avant le basculement, suspendre brièvement les workflows qui écrivent en base et refaire un dump final pour inclure les changements intervenus depuis la copie vérifiée. Restaurer ce dump dans `cartoonova` et comparer les tables et leurs nombres de lignes.
2. Mettre à jour les variables de production Vercel et les secrets/variables GitHub listés ci-dessus.
3. Déployer le code de la branche de migration et vérifier l'admin, le paiement, la lecture des articles et le dernier passage de chaque workflow.
4. Garder Neon accessible pendant la période de retour arrière. Le résilier seulement après validation du VPS.
