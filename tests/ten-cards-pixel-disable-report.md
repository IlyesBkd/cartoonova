# Désactivation du pixel publicitaire ChatGPT — seconde passe P1

## Résultat

**Attribution publicitaire ChatGPT côté navigateur désactivée**, y compris après accord explicite. `chargerPixelChatgpt` et `mesurerPixelChatgpt` sont des exports compatibles sans effet : aucun script, initialisation, global, file ni transport pixel. Aucun faux arrêt fournisseur. L’identifiant et `enCentimes` restent compatibles avec les appelants existants ; le backend de conversions n’a pas été modifié.

PostHog reste soumis à accord explicite, avec événements commerciaux utiles, filtrage des données privées, replay désactivé et garde batch/retry inchangés. Les notices `COOKIE_CONSENT` des dix langues distinguent désormais PostHog après accord et pixel ChatGPT désactivé/non chargé, même après accord. Les pages légales et le bandeau réutilisent ces notices.

## TDD et cas adversariaux

- Nouveau test Chromium, vrais modules applicatifs compilés en mémoire : pending → accepter → denied → accepter, appels de tous les événements et données privées synthétiques. **RED observé avant correction : 7 requêtes après granted au lieu de 0.** Après correction : zéro chargement/transport, aucune propriété `window.oaiq`, aucune balise pixel, aucun rechargement au retrait lorsque PostHog n’est pas initialisé.
- Le SDK synthétique adversarial capture son propre transport fetch et émet toutes les 25 ms indépendamment de `window.oaiq`. Un contrôle positif le charge uniquement dans le test : remplacer le global ne fait pas disparaître ses envois. Cela vérifie que le détecteur ne reproduit pas l’ancien faux positif.
- Refus sans navigation pixel, puis rechargement manuel retardé de 500 ms : aucun transport pixel. Deux vrais dialogues `beforeunload` annulés, puis navigation acceptée : refus effectif conservé.
- **Second RED observé après désactivation du pixel : 1 dialogue au lieu de 2** au deuxième essai de navigation. Le verrou permanent concernait encore les préférences et le rechargement PostHog ; il n’a donc pas été laissé en place. Il déduplique maintenant seulement les appels synchrones, puis se libère au prochain tour de boucle si le document reste vivant.
- Les tests pixel préexistants sont adaptés à l’absence de fournisseur, pas à un prétendu arrêt : refus, quota Storage, retrait interonglets, absence de file init et absence d’initialisation tardive restent vérifiés. Les tests réels PostHog batch/retry, opt-out interonglets et privacy sont conservés et passent.
- Un global fournisseur préexistant n’est ni invoqué ni remplacé par les exports compatibles. Cela ne constitue pas un arrêt d’un SDK déjà actif dans un ancien document.

## Vérifications finales

Processus sans secrets : `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR"`. Tous les tests utilisent `--import ./scripts/test-network.mjs` : garde Node et proxy Chromium fermé, interceptions globales des requêtes, aucun fournisseur externe réel contacté. Restriction coopérative, pas sandbox noyau.

```sh
node --import ./scripts/test-network.mjs --test \
  tests/ten-cards-pixel-disable.test.mjs \
  tests/ten-cards-consent-adversarial.test.mjs \
  tests/ten-cards-consent.test.mjs \
  tests/ten-cards-consent-ui.test.mjs \
  tests/ten-cards-copy.test.mjs
# 18 tests, 18 pass, 0 fail/cancelled/skipped/todo

node --import ./scripts/test-network.mjs --import tsx --test \
  tests/privacy.test.mjs tests/privacy-browser.test.mjs tests/privacy-route-logs.test.mjs
# 15 tests, 15 pass, 0 fail/cancelled/skipped/todo
```

**Total agrégé par script depuis les TAP : 33 tests, 33 réussis**, aucun échec/skip/todo/annulation.

ESLint ciblé `--max-warnings=0` sur les fichiers produit et tests modifiés : exit 0, zéro avertissement. TypeScript ciblé avec les trois fichiers produit, analytics et les composants PostHogProvider/CookiePreferences ainsi que leurs dépendances : exit 0, sans émission ni incrémental. Config : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/pixel-disable-tsconfig.json`. Le premier essai de cette config scratch ne résolvait pas `@types/node` depuis son emplacement extérieur ; `typeRoots` explicite vers les types installés du dépôt corrige le harnais, sans changement de configuration projet.

Journaux finaux : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/pixel-disable-evidence/{consent-copy.tap,privacy.tap,lint.txt,typecheck.txt}`.

## Fichiers de cette intervention

- `lib/pixelChatgpt.ts` : désactivation complète et réversible via exports compatibles sans effet.
- `lib/consentementMesure.ts` : verrou de reload non permanent après annulation.
- `lib/i18n/cookieConsent.ts` : notices fr/en/de/es/it/nl/pl/sv/da/pt.
- `tests/ten-cards-pixel-disable.test.mjs` : nouveau test TDD et contrôles adversariaux.
- `tests/ten-cards-consent{,-ui,-adversarial}.test.mjs` : attentes pixel désactivé, garanties PostHog conservées.
- `tests/ten-cards-copy.test.mjs` : assertions des dix notices et rendu légal existant.
- Le présent rapport. Skill de tests privacy du profil actif corrigé pour ne plus recommander le reload comme arrêt immédiat du pixel autonome.

## Limites explicites

Pas de comportement fournisseur validé : le résultat prouvé est l’absence du SDK publicitaire dans les nouveaux documents exécutant ce code, pas une API d’arrêt ChatGPT. Réactivation uniquement après vérification d’un mécanisme de retrait effectif et de ses transports. Aucun arrêt rétroactif d’un ancien document déjà chargé ni effacement de données historiques n’est affirmé. Backend de conversions hors périmètre, inchangé. Tests ciblés uniquement, pas validation globale de l’arbre partagé ni d’un déploiement Next. Aucun build applicatif, commit, push, production, email ou facturation effectué.
