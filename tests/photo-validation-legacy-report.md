# CODE11 — correction de conservation des photos legacy

## Résultat

Les deux routes authentifiées `orders/photos` et `orders/confirm-poster` conservent les URL historiques timestamp + nom original avec `+`, virgule, apostrophe, espaces/accents encodés, uniquement lorsqu'elles figurent exactement dans le champ de photos correspondant de la commande authentifiée. Les URL restituées et persistées ne sont ni réécrites ni réencodées.

Le parseur reçoit facultativement la liste persistée, uniquement après lecture/authentification de la commande. Son appel sans cette liste reste strict : aucune exception checkout, aucun changement du helper de propriété, session ou policy. Le contrôle de propriété et de namespace après parsing reste exécuté.

## Preuves TDD exécutées

Environnement vierge `env -i`, identifiants synthétiques, PostgreSQL 18 jetable, réseau fournisseur bloqué par `scripts/test-network.mjs` et mocks de frontière.

1. Tests de ponctuation des deux routes ajoutés avant production : **2 échecs attendus**, HTTP `400 !== 200`, erreur `Chemin de photo interdit.`. Trace : `$TMPDIR/code11-legacy-red.tap`.
2. Exception limitée à la liste persistée et authentification avant parsing : mêmes tests **2/2 verts**. Trace : `$TMPDIR/code11-legacy-green.tap`.
3. Tests de chemins/origines ambigus ajoutés : **2 échecs attendus**, `200 !== 400` pour le suffixe `?` vide. Le parseur WHATWG conserve ce suffixe dans `href`, mais expose une chaîne `search` vide. Trace : `$TMPDIR/code11-legacy-ambiguous-red.tap`.
4. Refus explicite de tout délimiteur brut `?`/`#`, même vide : campagne finale **21/21 verts** (15 tests routes + 6 tests parseur), zéro skip/annulation. Trace : `$TMPDIR/code11-legacy-final.tap`.
5. Campagne élargie réelle : **74 tests, 74 réussis, 0 échec/skipped/cancelled**, trace `$TMPDIR/code11-legacy-regressions.tap`.

Commande élargie depuis le dépôt :

```sh
exec 9< "$TMPDIR"
env -i PATH="$PATH" HOME="$HOME" TMPDIR="/proc/$$/fd/9" \
  node --import ./scripts/test-network.mjs --test \
  tests/upload.test.mjs tests/upload-quota.test.mjs \
  tests/order-create.test.mjs tests/photo-validation.test.mjs \
  tests/photo-validation-routes.test.mjs tests/delivery-copy.test.mjs \
  tests/promo-reservations.test.mjs
```

L'alias `/proc/<shell>/fd/9` désigne le scratch existant et garde les sockets des autres fixtures sous la limite Unix de 107 octets ; garder le shell parent ouvert pendant les tests. La fixture photo utilise uniquement TCP loopback et désactive son socket Unix (`-k ''`). Aucun fichier temporaire dans `/tmp`.

ESLint ciblé sur les trois fichiers production et deux tests : exit 0. `git diff --check` : exit 0.

## Couverture et revue logique de l'implémenteur

- Preuve SQL de conservation exacte et déduplication sur les deux routes, dont historique des retouches. La fixture utilise une note spécifique pour déclencher une vraie nouvelle réponse, plutôt qu'un no-op idempotent d'un test précédent.
- Pour chaque ponctuation : autre commande, URL non attachée et variante entourée d'espaces refusées ; tables `orders` et `retouches` et compteurs d'effets relus inchangés après les refus.
- Même déjà attachées : HTTP, autre store, query/fragment vides ou non, traversée normalisée, séparateurs encodés, double encodage, NUL et délimiteurs encodés refusés.
- Jeton forgé et commande inexistante refusés avant parsing, y compris pour une URL malformée. La liste d'exception provient exclusivement de SQL, jamais du corps client.
- Aucun élargissement global de la regex : la branche historique exige timestamp, fichier image autorisé, correspondance littérale de l'entrée et appartenance à la liste persistée. Les vérifications HTTPS/origine/configuration/canonicalité restent communes aux deux branches.
- Checkout et create appellent toujours le parseur sans liste d'exception ; la campagne élargie vérifie encore refus intersession, réservations, quotas et absence d'adoption legacy.
- Pas de nouveau SQL dans le correctif, ni nouveau transport fournisseur, secret, journal de photo, effet avant validation ou changement du contrôle de concurrence poster.

Cette revue est une auto-revue explicite, pas une approbation indépendante. La revue indépendante propre reste à lancer par le parent. Aucun build, commit, push ni déploiement effectué.

## Fichiers de cette intervention

- `lib/orderPhotos.ts`
- `app/api/orders/photos/route.ts`
- `app/api/orders/confirm-poster/route.ts`
- `tests/photo-validation.test.mjs`
- `tests/photo-validation-routes.test.mjs`
- Présent rapport.

Les autres modifications préexistantes du worktree ont été préservées.
