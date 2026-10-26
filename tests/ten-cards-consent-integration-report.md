# Intégration consentement — CONSENT01 / CONSENT02 / CONSENT03

## Résultat local

Les trois P1 reproduits sont corrigés et exercés dans Chromium. Aucun mode sans consentement réintroduit. **25 tests passent** sur l'état final : 10 consentement/UI/adversariaux + 15 privacy ; zéro échec, skip, todo ou annulation. ESLint ciblé et TypeScript ciblé passent également.

Aucun build, commit, push, appel de production, email ou paiement. Les autres changements présents dans l'arbre partagé ont été préservés. Les tests privacy existants n'ont pas été modifiés par cette intervention.

## TDD : échecs observés avant chaque correction

1. **CONSENT01** : test Chromium avec `getItem` renvoyant l'ancien `granted` et tous les `setItem` lançant `QuotaExceededError`. RED réel : valeur effective `granted` au lieu de `denied` après refus. Après correction, refus immédiat puis clic sur le vrai composant CookiePreferences et vrai rechargement : état `pending`, jamais restauration de l'ancien accord.
2. **CONSENT02** : deux vraies pages d'un même contexte Chromium, vrai wrapper analytics et distribution complète du SDK PostHog installé. Avant retrait, un événement commercial avec montant est réellement capturé au transport. B écrit `pending` ; RED réel : `has_opted_out_capturing()` reste `false` dans A. Après correction : opt-out observé avant déchargement, nouvelle page A non initialisée et sans transport après retrait.
3. **CONSENT03** : vraie balise script du wrapper pixel, réponse fournisseur synthétique retenue au transport. Accord, événement en attente, refus : RED réel, la file contient encore `init`. Après correction : vidage synchrone de la file, retrait de la balise, neutralisation du stub puis vrai déchargement du document ; relâcher la réponse retenue ne produit aucun transport pixel. Même preuve avec Storage plein et avec retrait par les préférences d'un autre onglet.
4. **Complément découvert en testant l'arrêt réel** : le seul opt-out public de PostHog laisse partir les événements déjà batchés. RED réel supplémentaire : deux requêtes observées au lieu d'une après le délai de flush. Correction : suppression des files requêtes/retry du SDK installé avant son `shutdown()` (qui, sinon, les vide vers le réseau), puis rechargement maîtrisé. GREEN du test batch et d'un second test utilisant une vraie réponse synthétique 503 : file retry réellement non vide avant retrait, aucun flush de shutdown ni réessai après retrait.

Les extensions de matrice (Storage plein, timer autonome, file retry non vide) ont été ajoutées ensuite comme validations des chemins corrigés, sans modification produit supplémentaire.

## Corrections

- `lib/consentementMesure.ts` : `pending` reconnu en stockage, priorité mémoire après échec d'écriture, observateurs synchrones locaux et écoute native des événements `storage` (dont suppression/clear). Un marqueur de fragment **non accordant** (`cn-consent=denied|pending`) préserve le retrait au rechargement même lorsque toutes les écritures Storage échouent. Seul un nouvel accord explicite peut retirer ce veto local ; un fragment ne peut jamais accorder le suivi.
- `lib/analytics.ts` : retrait partagé par refus, préférences et autres onglets. Opt-out synchrone de l'instance réelle, abandon des requêtes batch/retry déjà en attente, arrêt du SDK puis déchargement. Le garde pendant l'import asynchrone et le filtre `before_send` restent actifs.
- `lib/pixelChatgpt.ts` : ancien commentaire « sans bandeau » supprimé. Retrait des deux files, balise possédée et stub. **Aucun faux arrêt fournisseur annoncé** : faute d'API d'arrêt vérifiée du pixel, le document est réellement déchargé par navigation maîtrisée. Les timers du fournisseur sont détruits avec lui.
- `components/CookiePreferences.tsx` : utilise la même navigation maîtrisée après écriture de `pending` ; ne recharge plus en pouvant restaurer silencieusement un ancien `granted` après échec Storage.
- `tests/ten-cards-consent-adversarial.test.mjs` : nouveau harnais avec vrais composants/wrappers et vrai PostHog installé, Storage défaillant, deux onglets, scripts retardés et SDK pixel synthétique autonome ; tous les transports sont interceptés.
- `tests/ten-cards-consent.test.mjs` : le test historique de retrait pendant import conserve ses assertions ; collecte des appels côté Node et attente du vrai déchargement au lieu d'attendre dans un contexte JavaScript qui vient d'être détruit.
- Le présent rapport. `tests/ten-cards-consent-ui.test.mjs` reste inchangé.

## Vérifications finales et preuves

Exécution sans secrets : `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR"`.

```sh
node --test tests/ten-cards-consent-adversarial.test.mjs tests/ten-cards-consent.test.mjs tests/ten-cards-consent-ui.test.mjs
# tests 10 / pass 10 / fail 0 / skipped 0

node --import tsx --test tests/privacy.test.mjs tests/privacy-browser.test.mjs tests/privacy-route-logs.test.mjs
# tests 15 / pass 15 / fail 0 / skipped 0

node node_modules/eslint/bin/eslint.js lib/consentementMesure.ts lib/analytics.ts lib/pixelChatgpt.ts components/CookiePreferences.tsx tests/ten-cards-consent-adversarial.test.mjs tests/ten-cards-consent.test.mjs tests/ten-cards-consent-ui.test.mjs
# exit 0
```

TypeScript : `node node_modules/typescript/bin/tsc -p /home/hermes/.hermes/profiles/cartoonova/cache/scratch/consent-p1-gr3sk6o_/tsconfig.json` → exit 0. Ce tsconfig temporaire étend celui du dépôt, inclut les quatre fichiers produit du périmètre et leurs dépendances, désactive l'incrémental et n'émet rien. Ce n'est pas un typecheck global de l'arbre partagé.

Journaux TAP, lint, typecheck et agrégat JSON final :
`/home/hermes/.hermes/profiles/cartoonova/cache/scratch/consent-final-vpybx952/`.

Le lancement direct du lien `./node_modules/.bin/eslint` a d'abord été bloqué par le scanner de cycle de vie de l'outil, sans exécution. L'entrée JavaScript officielle d'ESLint a ensuite été exécutée avec succès ; aucun contournement de règle projet ni assertion supprimée.

## Limites et points de revue

- SDK pixel **synthétique** au transport, pas téléchargement du fournisseur réel. Son stub traite réellement la file `init` et ses timers émettent réellement via fetch intercepté. L'arrêt vérifié est celui du document Chromium, pas une garantie d'API privée du fournisseur.
- PostHog **réel installé**. Le nettoyage pré-shutdown dépend des formes privées `_requestQueue._queue`, `_retryQueue._queue` et `__request_queue` de cette version ; les tests batch/retry sont obligatoires à chaque mise à jour du SDK. Ne pas remplacer cela par le seul `opt_out_capturing()` ou `shutdown()` sans test de transport.
- Un déchargement détruit les scripts/timers mais ne peut rappeler des requêtes déjà transmises avant le retrait, effacer des données historiques chez un fournisseur ni prouver l'effacement de tous ses anciens cookies. Le rechargement peut abandonner un formulaire en cours : c'est le coût explicite de cet arrêt sûr sans API fournisseur vérifiée.
- Si l'écriture de localStorage échoue, le choix est protégé dans la page et lors du rechargement de son URL marquée ; la persistance sur de futures visites indépendantes et la diffusion à un autre onglet ne sont pas garanties dans ce cas. La synchronisation interonglets prouvée ici utilise de vraies écritures Storage réussies, comme la reproduction CONSENT02.
- Pas de build ni de validation HTTP d'un déploiement Next complet ; pas de contrôle production. Tests ciblés, pas toute la suite du dépôt. La revue indépendante finale reste à effectuer sur ces fichiers réunis.

Le skill du profil `cartoonova-privacy-transport-testing` a également été enrichi avec les pièges du batch PostHog, des écritures Storage défaillantes et du déchargement du pixel.
