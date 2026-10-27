# CRO-10 / CODE-14 — consentement, confidentialité et CSP (local)

## Suivi nettoyage après revue (sources stabilisées)

Les compteurs du lot initial ci-dessous restent historiques. La campagne actuelle couvre **22/22 tests** pricing/privacy/cleanup, sans échec ni skip ; `npm run lint` global et `git diff --check` : code 0. Preuves/empreintes actuelles : `tests/priority-ten-cleanup-report.json` et `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/pricing-privacy-cleanup/`.

- `CSP-TEST-CLEANUP-01` corrigé : lancement Chromium à l'intérieur du `try` après écoute HTTP, navigateur optionnel, `server.close` dans son propre `finally`. Vrai échec Playwright sur exécutable absent et rejet injecté de `browser.close` : les deux listeners réels sont fermés. Les deux tests échouaient avant correction (listener encore actif).
- `BUILD-TEST-CLEANUP-02` corrigé : parent asynchrone à SIGTERM coopératif et fallback PG limité au runtime neuf possédé ; handlers Python explicites, pas de supposition que SIGTERM exécute automatiquement `finally`. Timeout réel avec Python gelé, puis SIGKILL : parent arrête effectivement PostgreSQL (`status=3`, reconnexion loopback refusée). Timeout coopératif également prouvé et chemins étrangers/symlinks rejetés. Détails dans `tests/priority-ten-pricing-build-report.md`.
- Aucun build global, fournisseur réel, production, commit/push ni Trello. Bytecode Telegram préexistant préservé. Les limites métier/CSP ci-dessous restent inchangées.

## Résultat

- **CRO-10 : politique existante vérifiée, sans changement produit.** PostHog démarre par défaut en l'absence de choix enregistré, sans bandeau automatique. Les refus historiques et les retraits `pending` restent bloquants ; les lectures Storage impossibles/valeurs invalides restent fail-closed. Le pixel publicitaire ChatGPT reste un no-op même après accord explicite.
- **Dix langues cohérentes** (`fr/en/de/es/it/nl/pl/sv/da/pt`) : chaque notice annonce démarrage par défaut, refus conservés, refus bloquant PostHog, absence de bandeau et pixel ChatGPT désactivé. Chaque catalogue légal réutilise exactement la notice partagée dans les conditions et la confidentialité ; les préférences utilisent ce même objet. Aucun texte public n'a nécessité de correction.
- **CODE-14 : contrôles locaux fermés, acceptation paiement/portefeuilles toujours non prouvée.** CSP déjà bloquante, pas Report-Only. Une incohérence opérationnelle a été corrigée : le handler `/api/csp` et son alerte annonçaient encore « rien n'est bloqué ». L'alerte dit désormais « violations signalées » et décrit la politique bloquante sans prétendre vérifier un parcours métier. Aucun envoi Discord réel : frontière remplacée dans les tests.

## Modifications

- `app/api/csp/route.ts` : commentaire, titre et pied de page de l'alerte corrigés ; ni élargissement CSP ni changement de consentement.
- `tests/privacy-route-logs.test.mjs` : régression sur le libellé opérationnel (échec RED observé avant correction), protections de données privées conservées.
- `tests/priority-ten-privacy-csp.test.mjs` : contrat commun des dix catalogues légaux, vraie configuration Next, en-têtes de production/développement et enforcement Chromium local.
- `tests/priority-ten-privacy-csp-report.json` : compteurs TAP, commandes, chemins des journaux/captures synthétiques, notices, en-têtes, violations observées et SHA-256 des sources pertinentes.

## Vérifications exécutées

Environnement minimal sans secrets fournisseurs : `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" PRIVACY_CAPTURE_DIR="$TMPDIR/priority-ten-privacy-csp" node --import tsx --test tests/<fichier>` ; chaque fichier exécuté séparément avec timeout borné. Ce n'est pas la suite globale du dépôt.

| Fichier | Tests réussis |
|---|---:|
| priority-ten-privacy-csp.test.mjs | 3 |
| ten-cards-consent.test.mjs | 1 |
| ten-cards-consent-ui.test.mjs | 1 |
| ten-cards-consent-adversarial.test.mjs | 9 |
| ten-cards-pixel-disable.test.mjs | 2 |
| privacy.test.mjs | 6 |
| privacy-browser.test.mjs | 1 |
| privacy-route-logs.test.mjs | 8 |
| email-outbox-provider.test.mjs | 2 |
| **Total ciblé, fichiers disjoints** | **33** |

**33 réussites, 0 échec, 0 skip/todo/annulation.** ESLint ciblé sur les trois fichiers modifiés/créés de code et `git diff --check` réussis. Build et lint globaux réservés au parent d'intégration ; aucun build global revendiqué ici. Journaux TAP et transports décodés synthétiques : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/priority-ten-privacy-csp/`.

### Frontières réellement exercées

- Vrai SDK PostHog installé : événements commerciaux positifs, retrait dans deux vrais onglets d'un même contexte, ancien accord lisible malgré `Storage.setItem` en échec, suppression/retrait `pending`, files batch et retry déjà remplies supprimées avant shutdown/rechargement.
- Pixel publicitaire : absence de download/global/init/file/transport après accord ; contrôle positif sur timer autonome, rechargement lent et navigation annulée.
- Suites de confidentialité existantes : vrais transports SDK PostHog/Resend interceptés, champs privés synthétiques absents, événements métier utiles conservés, replay désactivé. Logs routes/cron : expressions AST et handlers ciblés, pas toutes les branches de toutes les routes exécutées.
- CSP : en-têtes extraits de **la vraie `next.config.ts` installée**, servis par un HTTP loopback possédé par le test. Chromium bloque script étranger, handler inline, `eval`, connexion étrangère, iframe étrangère, base externe, objet et formulaire externe avant transport. Script same-origin et probes script/frame Stripe autorisés, requête same-origin `/ingest/probe` autorisée. Les ressources Stripe sont des fixtures interceptées, **pas le SDK ni un paiement réel**.
- CSP structurelle : `object-src 'none'`, `script-src-attr 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action` limité, `nosniff`, `DENY`, HSTS, Permissions-Policy ; `unsafe-eval` présent seulement en développement. `frame-ancestors` et HSTS sont ici contrôlés par leur configuration, pas par une matrice navigateur HTTPS/embedding complète.

## Limites / critères restant ouverts

1. **Scripts inline autorisés** (`unsafe-inline`) et WebAssembly permis (`wasm-unsafe-eval`) : protection non équivalente à une CSP stricte à nonce. Le test observe explicitement l'exécution d'un script inline autorisé. Les nonces demandent un arbitrage rendu dynamique/cache ; aucune migration de rendu ni nonce fictif ajouté. CSP actuelle conservée, dont domaines publicitaires autorisés, sans confondre permission de domaine et chargement effectif du pixel désactivé.
2. **Aucun paiement Stripe, 3DS ou portefeuille Apple/Google Pay réalisé** ; aucun compte ou portefeuille inventé. Probes d'origines autorisées ne valent pas acceptation du paiement. Ce critère de CODE-14 reste ouvert pour une session spécifiquement autorisée et équipée.
3. Aucun accès/modification de données production, aucun message tiers, aucun service payant, aucun nouveau paiement test/live. Configuration/HTTP déployés et données historiques PostHog/replay non vérifiés ; pas de validation juridique revendiquée.
4. Aucun rendu public modifié : pas de nouvelles captures desktop/mobile nécessaires ; les nouvelles preuves sont techniques. Le handler d'alerte modifié n'a pas été envoyé à Discord.
5. Aucun commit, push, déploiement ni écriture Trello. Travaux concurrents pricing/build/SEO préservés ; `scripts/__pycache__/` existant laissé intact.

## Piège de harnais rencontré

`page.evaluate` (DevTools) peut contourner le contrôle CSP de `eval`, y compris quand le script de test est créé par cette voie. La preuve finale exécute donc `eval` depuis un fichier JavaScript réellement récupéré sur une origine autorisée ; son blocage est observé par une violation `script-src`. Le skill `cartoonova-privacy-transport-testing` a été enrichi avec cette règle ; les probes Stripe restent explicitement séparées du vrai parcours fournisseur.
