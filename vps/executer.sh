#!/usr/bin/env bash
#
# Lanceur unique des taches automatiques, sur le VPS.
#
# ── Pourquoi un lanceur plutot que dix lignes de crontab ─────────────────
#
# Chaque tache a besoin des memes quatre choses : ses variables
# d'environnement, un verrou pour ne pas se chevaucher avec elle-meme, un
# journal horodate, et un code de sortie qui dise la verite. Repeter ca dix
# fois dans une crontab garantit que les dix versions divergeront.
#
# ── Ce qui remplace quoi ─────────────────────────────────────────────────
#
# Les trois crons Vercel et les cinq workflows GitHub viennent ici. Deux
# raisons concretes, mesurees et non theoriques :
#
#   1. GitHub deprogramme les taches planifiees de plusieurs heures. Une
#      redaction annoncee a 02h10 est partie a 14h17, et la sonde qui la suit a
#      16h32 pour un horaire annonce a 04h05. L'ordre n'existait que dans les
#      commentaires, d'ou le chainage `workflow_run:`. Sur une machine a soi,
#      l'ordre s'ecrit simplement en mettant les commandes a la suite.
#
#   2. Le systeme de fichiers d'un runner est jetable. `.state` ne survivait
#      que par le cache Actions, et un cache manquant remettait silencieusement
#      le budget IA du moteur a zero.
#
# ── Usage ────────────────────────────────────────────────────────────────
#
#   ./vps/executer.sh nuit       # la chaine nocturne complete
#   ./vps/executer.sh blog       # un passage du moteur de blog
#   ./vps/executer.sh veille     # le controle des taches
#   ./vps/executer.sh <nom>      # une tache isolee, pour un rattrapage
#
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOURNAUX="$RACINE/vps/journaux"
VERROUS="$RACINE/vps/verrous"
mkdir -p "$JOURNAUX" "$VERROUS"

TACHE="${1:-}"
if [ -z "$TACHE" ]; then
  echo "usage: $0 <tache>" >&2
  exit 64
fi

# Les secrets vivent dans un fichier a part, hors depot. `set -a` exporte tout
# ce qui y est declare sans avoir a lister les variables une par une.
if [ -f "$RACINE/.env.vps" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$RACINE/.env.vps"
  set +a
fi

horodate() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Appelle une route cron du site. Celles-ci restent servies par Vercel — elles
# ont besoin du contexte de l'application — mais c'est desormais cette machine
# qui decide quand elles tournent.
appeler_route() {
  local chemin="$1"
  local url="${SITE_URL:-https://www.cartoonova.com}${chemin}"
  local code
  # --max-time couvre `maxDuration = 60` cote Vercel, avec de la marge.
  code=$(curl -sS -o /tmp/reponse-cron.$$ -w "%{http_code}" --max-time 120 \
    -H "Authorization: Bearer ${CRON_SECRET:?CRON_SECRET manquante}" "$url" || echo "000")
  echo "  reponse $code : $(head -c 400 /tmp/reponse-cron.$$ 2>/dev/null || true)"
  rm -f /tmp/reponse-cron.$$
  # 000 = curl n'a pas abouti ; tout ce qui n'est pas 2xx est un echec.
  case "$code" in
    2??) return 0 ;;
    *) return 1 ;;
  esac
}

# Lance une commande et note son passage dans `ge_job_runs`, sous le nom que
# la veille attend (`lib/tachesAttendues.ts`). Sans cette ligne, la veille ne
# verrait rien tourner : aucune tache n'ecrit elle-meme dans le journal. La
# note ne fait jamais echouer la tache ; seul compte le code de la commande.
suivre() {
  local nom="$1"; shift
  local debut code=0
  # Pas `%3N` : le `date` d'Ubuntu recent (uutils) ignore la largeur et
  # renvoie les nanosecondes entieres.
  debut=$(( $(date +%s%N) / 1000000 ))
  "$@" || code=$?
  (cd "$RACINE" && node scripts/noter-passage.mjs "$nom" "$code" "$debut") || true
  return "$code"
}

executer() {
  case "$1" in
    # ── Chaine nocturne ──────────────────────────────────────────────────
    #
    # L'ordre compte et il est reel ici, pas seulement documente : la redaction
    # ecrit les fiches, la sonde d'indexation mesure ce que Google en fait, la
    # sonde de citation mesure ce que les assistants en font. Chaque etape lit
    # ce que la precedente a produit.
    #
    # Une etape qui echoue n'arrete pas les suivantes : ce sont des mesures
    # independantes, et perdre la sonde de vitesse parce que Merchant Center
    # repond mal serait absurde. Le code de sortie retient qu'il y a eu un
    # echec, et la veille du lendemain le rapporte.
    nuit)
      local echecs=0
      for etape in fiches indexation marchand vitesse citations; do
        echo "── $(horodate) · $etape"
        executer "$etape" || { echo "  ! $etape a echoue"; echecs=$((echecs + 1)); }
      done
      return "$echecs"
      ;;

    fiches)     cd "$RACINE" && suivre contenu-fiches npx tsx scripts/genere-contenu-fiches.mts ;;
    indexation) cd "$RACINE" && suivre sonde-indexation npx tsx scripts/sonde-indexation.mts ;;
    marchand)   cd "$RACINE" && suivre sonde-marchand npx tsx scripts/sonde-marchand.mts ;;
    vitesse)    cd "$RACINE" && suivre sonde-vitesse npx tsx scripts/sonde-vitesse.mts ;;
    citations)  cd "$RACINE" && suivre sonde-citations node scripts/sonde-citations.mjs ;;
    entonnoir)  cd "$RACINE" && suivre sonde-entonnoir npx tsx scripts/sonde-entonnoir.mts ;;
    # La veille se journalise elle-meme (`avecJournal`).
    veille)     cd "$RACINE" && npx tsx scripts/veille-taches.mts ;;

    # ── Moteur de blog ───────────────────────────────────────────────────
    #
    # La file de sujets est recalculee avant chaque passage plutot que
    # versionnee : la fraicheur depend du calendrier, et la Saint-Valentin ne
    # vaut rien en juin.
    #
    # Chaque commande est notee a part : savoir laquelle a cesse de
    # fonctionner est la question utile. Un echec n'arrete pas les suivantes,
    # comme avant ; le code de sortie compte les echecs.
    blog)
      local echecs=0
      cd "$RACINE" && node scripts/genere-sujets.mjs || echecs=$((echecs + 1))
      cd "$RACINE/portable-content-publisher"
      for commande in topics:discover batch translate publish; do
        suivre "moteur-contenu:$commande" node --import tsx src/app/cli.ts "$commande" \
          || echecs=$((echecs + 1))
      done
      return "$echecs"
      ;;
    blog-seo)
      cd "$RACINE/portable-content-publisher" && node --import tsx src/app/cli.ts seo:analyze
      ;;

    # ── Routes servies par l'application ─────────────────────────────────
    cron-seo)       suivre cron-seo appeler_route "/api/cron/seo" ;;
    cron-lifecycle) suivre cron-lifecycle appeler_route "/api/cron/lifecycle-emails" ;;
    cron-support)   suivre cron-support appeler_route "/api/cron/sync-support-inbox" ;;
    # Retouches sans reponse depuis 24 h : alerte Discord, lecture seule.
    cron-retouches) suivre cron-retouches appeler_route "/api/cron/retouches" ;;

    *)
      echo "tache inconnue : $1" >&2
      return 64
      ;;
  esac
}

JOURNAL="$JOURNAUX/$TACHE.log"

# `flock -n` : si le passage precedent tourne encore, on renonce au lieu
# d'empiler. Deux redactions simultanees se disputeraient les memes fiches, et
# deux moteurs de blog les memes verrous d'etat.
exec 9>"$VERROUS/$TACHE.lock"
if ! flock -n 9; then
  echo "$(horodate) [$TACHE] deja en cours, passage ignore" | tee -a "$JOURNAL"
  exit 0
fi

{
  echo "════ $(horodate) · debut $TACHE"
  debut=$(date +%s)
  code=0
  executer "$TACHE" || code=$?
  echo "════ $(horodate) · fin $TACHE en $(( $(date +%s) - debut ))s, code $code"
  exit "$code"
} 2>&1 | tee -a "$JOURNAL"

# Sans cette ligne, le code de sortie serait celui de `tee`, toujours 0 — et la
# crontab enverrait un mail de succes pour une tache qui a echoue.
exit "${PIPESTATUS[0]}"
