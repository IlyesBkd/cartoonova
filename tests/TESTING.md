# Tests reproductibles (CODE-13)

## Commande et prerequis

```sh
npm ci --no-audit --no-fund
npx --no-install playwright install --with-deps chromium
npm test
```

Linux/POSIX, utilisateur non-root, Node 24 en CI (validation locale aussi sous Node 22), PostgreSQL **18** dans `/usr/lib/postgresql/18/bin`. Le workflow `verification.yml` installe PG18 depuis le depot PGDG sur Ubuntu 24.04. Les fixtures existantes imposent ce chemin (certaines ignorent `TEST_PG_BIN`). Aucun serveur PostgreSQL partage n'est utilise : chaque suite concernée initialise son cluster `trust` jetable, utilisateur fictif, port loopback aleatoire different de 5432, puis l'arrete. Ne pas lancer sur une machine multi-utilisateur non fiable : `trust` reste une authentification de test.

`TMPDIR` doit exister, etre accessible en ecriture et rester court : socket PostgreSQL Unix <=107 octets, y compris les noms generes par les fixtures. Le runner alloue un sous-repertoire exclusif de deux caracteres pour les fixtures. Sur Hermes, conserver le scratch configure, ne pas utiliser un autre profil. `PLAYWRIGHT_BROWSERS_PATH` permet de reutiliser le cache Chromium installe.

## Inventaire et execution

- Inventaire dynamique **tous** les fichiers directement sous `tests/*.test.mjs`, trie, ecrit dans `manifest.json`. Les helpers `.mjs` et les tests du projet distinct `portable-content-publisher` ne font pas partie de ce contrat.
- Partition disjointe a quatre combinaisons : navigateur (`browser` dans le nom) / non navigateur, et privacy / non privacy. Seuls `privacy*.test.mjs` recoivent `--import tsx`. Notamment `delivery-promise.test.mjs` doit rester sans ce preload (contexte next-intl CommonJS/ESM).
- Un processus Node par fichier, execution sequentielle (`--test-concurrency=1`), sans application Next deployee. Les nouveaux tests resend-webhook, photo-validation et gift-balance-copy sont inclus automatiquement, sans liste manuelle a synchroniser.
- L'inventaire est relu a la fin : ajout/suppression pendant l'execution fait echouer le bilan. Ne pas lancer la campagne pendant que d'autres agents ecrivent les tests.
- 180 secondes et 8 Mio stdout/stderr combines maximum par fichier, plafond global 20 minutes (hors preparation CI). SIGTERM puis SIGKILL du groupe enfant apres une seconde; verification/arret des clusters `<runtime>/pg` restants dans la racine exclusive. Aucun arret d'un cluster preexistant ou distant. Un SIGKILL de tout le runner/machine ne garantit pas son nettoyage; le runner CI entier est jetable.
- Les erreurs ne coupent pas les fichiers suivants. Bilan JSON : fichiers attendus/executés, code/signal/timeout/debordement, compteurs TAP `tests/pass/fail/cancelled/skipped/todo`, somme programmee. Code non-zero si echec, annulation, **skip**, todo, absence/incoherence des compteurs, sortie anormale, nettoyage echoue ou inventaire incomplet. Aucun `|| true`, retry masquant un echec ou `continue-on-error`.

## Isolation et limites de securite

`npm test` entre dans `env -i`, puis chaque enfant utilise encore `/usr/bin/env -i`. Seuls PATH, HOME temporaire, TMPDIR, locale/UTC, chemin PG et cache navigateur sont reconstruits. Les cles fournisseur, DATABASE_URL, NODE_OPTIONS, fichiers `.env` via preload et variables npm ne sont pas transmis; aucune configuration dotenv n'est chargee par le runner. Un Node/npm deja lance avec un NODE_OPTIONS hostile ne peut pas etre assaini retroactivement : utiliser aussi un environnement propre pour demarrer npm sur un poste non fiable.

`scripts/test-network.mjs` bloque les sockets Node hors localhost/127.0.0.1/::1 et UDP; les MockAgent/fetch mocks des suites restent utilisables. Chromium utilise un proxy loopback volontairement ferme; une requete non interceptee ne rejoint donc pas un fournisseur. Le test du runner verifie un vrai Chromium : route synthétique reussie, navigation fournisseur rejetee par le proxy. Ce n'est **pas** un sandbox pour du code malveillant : processus arbitraires, addons natifs, transports non audites et contournement volontaire ne sont pas contenus au niveau noyau. Les connexions loopback sont autorisees pour PG; ne pas placer de tunnel fournisseur sur ces ports.

Les suites navigateur existantes ont ete inspectees : chat/SEO refusent les destinations inconnues; navbar/privacy interceptent globalement; gift/product-prices n'interceptent que leurs origines `.invalid`. Le proxy ferme couvre leurs requetes manquees sans modifier les tests existants. Le SDK PostHog/Resend reel peut etre exerce avec identifiants **synthetiques** et transports interceptés. Aucun achat, envoi, fournisseur live, secret production ni base production n'est necessaire. Cette couverture ne prouve pas les configurations live, transports historiques ni toutes les branches de l'application.

## Logs et CI

Le runner affiche le chemin `${TMPDIR}/tap-XXXXXX` : manifeste, un TAP borne par fichier et `summary.json` agrege. Le HOME temporaire est vide; les fixtures sont nettoyees. Conserver les logs synthetiques utiles puis supprimer le repertoire d'artefacts local si necessaire. En CI seuls les trois types de rapports sont conserves, sept jours, meme sur echec.

`verification.yml` configure localement le job tests, puis types (`next typegen`, `tsc`) et lint. Pas de build exigeant des secrets dans ce workflow, pas de tunnel, secret GitHub ou depense fournisseur. Les installations npm/apt/Playwright demandent le reseau de distribution de dependances : l'absence de reseau **fournisseur pendant les tests** ne signifie pas installation hors ligne. Aucun workflow distant n'est declenche par l'edition locale.

**Ce controle ne bloque pas Vercel**, qui deploie les pushes en parallele. Le rendre obligatoire avant fusion/deploiement demande une configuration distante de protection de branche/Vercel distincte, non realisee ici.

## Tests du runner

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --import ./scripts/test-network.mjs --test tests/test-runner.test.mjs
```

Couvre partition, compteurs TAP malformes/non verts, environnement propre, sortie non-zero, timeout, plafond de logs, refus reseau Node, vrai navigateur mocks/proxy, et CLI reel sur fichiers synthetiques pass/skip/fail. Ces fixtures miniatures verifient l'orchestration; elles ne remplacent pas les suites metier de `npm test`.
