#!/usr/bin/env bash
#
# Sauvegarde nocturne de la base de production (P0-4).
#
# Jusqu'ici, les seules copies de la base etaient faites a la main, sur le
# meme disque qu'elle : une panne disque effacait commandes, clients et bons
# cadeaux. Ce script :
#   1. fait un `pg_dump` compresse (format custom, restaurable par pg_restore) ;
#   2. garde les 14 derniers dans $DOSSIER ;
#   3. copie le fichier du jour hors du VPS si `SAUVEGARDE_DISTANTE` est
#      renseignee (cible rclone, par exemple `b2:cartoonova-sauvegardes`).
#      Sans elle, la sauvegarde reste locale et le dit : c'est mieux que rien,
#      pas suffisant.
#
# Lancement : `vps/executer.sh sauvegarde` (voir vps/crontab).
# Restauration : pg_restore --clean --if-exists -d "$DATABASE_URL" <fichier>
#
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL manquante}"
DOSSIER="${SAUVEGARDE_DOSSIER:-/home/ubuntu/sauvegardes-base}"
GARDER=14

mkdir -p "$DOSSIER"
FICHIER="$DOSSIER/cartoonova-$(date -u +%Y%m%d-%H%M).dump"

pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$FICHIER.partiel"
# Un dump interrompu ne doit jamais passer pour une sauvegarde valide.
mv "$FICHIER.partiel" "$FICHIER"
# Verification minimale : pg_restore sait en lire la table des matieres.
pg_restore --list "$FICHIER" > /dev/null
echo "  sauvegarde : $FICHIER ($(du -h "$FICHIER" | cut -f1))"

# Rotation : on garde les $GARDER plus recents.
ls -1t "$DOSSIER"/cartoonova-*.dump 2>/dev/null | tail -n +$((GARDER + 1)) | xargs -r rm -f

if [ -n "${SAUVEGARDE_DISTANTE:-}" ]; then
  rclone copy "$FICHIER" "$SAUVEGARDE_DISTANTE" --quiet
  echo "  copie distante : $SAUVEGARDE_DISTANTE"
else
  echo "  ! SAUVEGARDE_DISTANTE absente : copie locale seulement, sur le disque de la base"
fi
