# E2E-03 / OPS-03 — correctifs et preuves locales

## Suivi de revue — deux P2 corrigés (preuves actuelles)

Les exécutions et compteurs plus bas décrivent le lot initial. Sources du harnais stabilisées après correction de `CSP-TEST-CLEANUP-01` et `BUILD-TEST-CLEANUP-02` ; la revue indépendante initiale n'est pas réécrite en validation globale.

- CSP : durée de vie entière du listener protégée dès son écoute ; lancement navigateur dans le `try`, navigateur optionnel, fermeture HTTP dans un `finally` indépendant de `browser.close`. Deux régressions observées rouges puis vertes : vrai lancement Playwright sur exécutable absent, puis fermeture navigateur rejetée ; listener réel fermé dans les deux cas.
- Build/fixture : remplacement du `spawnSync` Python à timeout destructif par le parent asynchrone `tests/helpers/owned-build-harness.mjs`. Le budget reste 60 s ; SIGTERM coopératif, délai de grâce puis SIGKILL si nécessaire. Python installe explicitement les handlers SIGINT/SIGTERM et vérifie l'arrêt PG dans son `finally`, y compris après interruption du démarrage.
- Le parent vérifie et arrête indépendamment **uniquement** le `<runtime>/pg` neuf dont il possède le jeton : TMPDIR, chemin/UID/mode 0700, absence de symlinks et chemin du postmaster contrôlés. `--runtime-dir`/`--owner-token` Python refusent les répertoires non possédés/non vides ; aucune URL DB héritée. Sockets Unix désactivés pour cette fixture TCP loopback afin d'éviter la limite de longueur.
- Timeout réel 3 s sur cluster jetable prêt : chemin coopératif → Python code 143, `pg_ctl status=3`, parent sans arrêt supplémentaire. Chemin forcé : Python gelé par SIGSTOP, expiration réelle, SIGKILL après 200 ms, **aucun finally Python possible**, arrêt PG par le parent, `pg_ctl status=3` et reconnexion loopback refusée (`ECONNREFUSED`). Échec rouge préalable : postmaster toujours actif (`status=0`), ensuite arrêté par le garde de test.
- Fixture normale : 15 migrations appliquées et 15 rejouées, PG arrêté. `--fixture-hold` réservé à `--fixture-only`, aucun lint/build/Next dans ces probes. Répertoire non possédé et redirection par symlink rejetés ; sentinelle étrangère intacte.
- Campagne finale en environnement minimal : **22/22 tests**, zéro échec/skip/todo/annulation ; **`npm run lint` global code 0**, `git diff --check` code 0. Aucun build global, aucune production/Trello/commit/push. `scripts/__pycache__` préexistant préservé.
- Preuves et empreintes des sources actuelles : `tests/priority-ten-cleanup-report.json` ; TAP/lint/diff : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/pricing-privacy-cleanup/check-{0,1,2}.log`.

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --import tsx --test tests/build-reproducibility.test.mjs tests/priority-ten-privacy-csp.test.mjs tests/pricing-fallback.test.mjs tests/privacy-route-logs.test.mjs
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm run lint
```

Vérification : 27 octobre 2026 UTC. Aucune écriture Trello/production, aucun commit/push, aucun paiement réel. Build global et intégration réservés au parent.

## E2E-03 — replis tarifaires

- Lecture seule de la configuration publique `/api/prices?currency=…` pour EUR, USD, GBP, CAD, AUD, PLN, SEK, DKK, CHF. Le constat final est conservé dans le cache du profil, pas dans une base de production.
- Le repli EUR annonçait `base=4.99` et `extraPerson=4.99`, contre `5` dans la configuration publique. Alignement de ces deux champs ; aucune modification des tarifs actifs en base ni des routes de facturation.
- PLN/SEK/DKK/CHF dérivent désormais du repli EUR par `convertPrice`, comme la lecture normale de la grille EUR ; plus de copie manuelle des montants arrondis. Les grilles commerciales USD/GBP/CAD/AUD restent explicites et inchangées.
- Parité finale vérifiée : les 14 champs sont identiques à la configuration publique dans chacune des neuf devises.
- Nouveau test : référence EUR explicite, conversion des quatre devises, neuf devises passant successivement par grille présente → grille vide → grille restaurée dans le module DB simulé. Comparaison du calcul de devis complet, pas seulement du prix de base.
- Le repli ne transforme pas une panne froide en autorisation de paiement : la route de prix conserve son comportement fail-closed déjà testé (503 sans cache, valeur connue avec cache). Le test du scénario de commande utilise les vraies fonctions de devis, une base PostgreSQL locale et une frontière Stripe simulée.
- Deux tests historiques dépendaient des 4,99 : adaptation annoncée des seules assertions de `order-create.test.mjs` (500 centimes) et du montant initial cadeau dans `promo-reservations.test.mjs` (10,01) pour préserver le contrôle d'un reliquat exact de 6,01 après réservation de 5 avec minimum encaissable de 1. Aucune logique applicative cadeaux/paiement modifiée.

## OPS-03 — schéma reproductible sans snapshot privé

- Suppression de la dépendance du harnais à un export de schéma privé du cache.
- Nouveau `scripts/build-fixture.sql` versionnable : tables vides synthétiques minimales. Aucune donnée client, commande, cadeau ou grille tarifaire active recopiée. Usage exclusivement local via un nouveau cluster ; ce fichier n'est pas une migration de production.
- Le harnais découvre toutes les migrations `migrations/*.sql`, les applique et les rejoue dans l'ordre lexical, avec arrêt immédiat en cas d'erreur SQL.
- Nouveau mode `--fixture-only` : 15 migrations appliquées puis 15 rejouées avec succès sur PostgreSQL 18, arrêt effectif du cluster et aucun serveur Next lancé. Dernière ligne JSON testée : `fixtureOnly=true`, `migrationsReapplied=15`, `disposableDatabaseStopped=true`, `serverStopped=true`.
- Ce mode ne modifie pas `tsconfig.json`. Le mode complet conserve le contrôle anti-`.env*`, l'environnement réduit, les sorties isolées et la restauration de la configuration Next. Budget du sous-processus lint/build : 120 secondes chacun.
- Documentation Next installée lue : `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/distDir.md`.

## Exécutions finales

Toutes les commandes suivantes partent du dépôt avec `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR"` :

```sh
node --test tests/build-reproducibility.test.mjs tests/pricing-fallback.test.mjs tests/prices.test.mjs tests/order-create.test.mjs tests/promo-reservations.test.mjs tests/checkout-proof.test.mjs tests/ten-cards-editorial-ops.test.mjs
node node_modules/eslint/bin/eslint.js lib/pricingFallback.ts lib/types.ts tests/pricing-fallback.test.mjs tests/build-reproducibility.test.mjs
git diff --check
```

Résultats : **47 tests réussis, 0 échec, 0 ignoré**, ESLint ciblé code 0, diff-check code 0. Tests PostgreSQL réels ; aucun identifiant de production chargé. Un premier lancement du nouveau test OPS, avant le garde prérequis `--fixture-only`, a déclenché l'ancien mode complet et atteint sa limite de temps. Le cluster correspondant a été arrêté explicitement et la seule modification Next de `tsconfig.json` restaurée ; cette tentative n'est pas une preuve de build. Le test vérifie désormais la présence du mode avant de lancer le harnais.

Preuves du profil :

- `/home/hermes/.hermes/profiles/cartoonova/cache/priority-ten-pricing-build/results.json` : commandes, codes retour, compteurs, bilan migrations/nettoyage, parité publique, empreintes SHA-256 des sources testées.
- Même dossier : `public-prices.json`, `check-0.log`, `check-1.log`, `check-2.log`, `run-verification.py` (collecteur reproductible).

## Fichiers de ce lot

- Créés : `lib/pricingFallback.ts`, `scripts/build-fixture.sql`, `tests/pricing-fallback.test.mjs`, `tests/build-reproducibility.test.mjs`, ce rapport.
- Modifiés : `lib/types.ts` (nécessaire car la référence historique s'y trouve), `scripts/verify-ten-cards-local.py`, `tests/order-create.test.mjs`, `tests/promo-reservations.test.mjs`.
- Aucun changement aux fichiers des autres agents, à l'environnement privé, aux données actives, ni au bytecode Telegram préexistant. Méthode `--fixture-only` documentée dans le skill du profil.

## Limites / intégration parent

- **Pas de build Next complet validé dans ce lot**, pas de test navigateur complet ni nouveau scan des bundles. Le parent exécute seul le mode intégral :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" python3 scripts/verify-ten-cards-local.py
```

- La fixture est volontairement minimale ; les 15 migrations sont prouvées, pas une équivalence avec le schéma ni les données de production. Les schémas de contenu nécessaires au prerender doivent être provisionnés par le bootstrap local de l'application, comme dans le harnais précédent.
- Reproduction exige dépendances Node installées, PostgreSQL 18 local et absence de `.env*` à la racine ; la commande complète peut dépendre du réseau pour les ressources de build.
- Le jeu public correspond à l'instant de vérification ; toute future décision tarifaire métier doit actualiser référence et test. Les grilles actives demeurent prioritaires et ne sont pas remplacées par ce correctif.
