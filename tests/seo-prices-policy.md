# SEO-01 — politique prix/devise et données structurées

## Contrat stable

Les pages restent statiques : elles ne lisent ni cookie ni géolocalisation serveur pour construire une offre universelle. Le `CurrencyProvider` existant reste l'unique autorité de devise : cookie valide (y compris celui posé par le proxy pays ou par un choix manuel), sinon GBP pour `en`, EUR pour les autres langues. Une première visite US reçoit donc USD si le proxy a posé ce cookie ; sans signal pays/cookie, `/en` utilise GBP, pas une détection US inventée. Ce comportement métier n'est pas modifié par SEO-01.

- **HTML avant hydratation** : les prix visibles sont masqués ; aucune offre/Product marchand n'est publié. Breadcrumb/FAQ restent rendus côté serveur. Pas de prix EUR fictif destiné aux robots, pas de traitement spécial Googlebot.
- **Après hydratation** : un seul Product marchand, dans la même devise que le DOM. Les bons utilisent `montantsBon(currency)`, exactement comme leur interface et la validation checkout : EUR 20/40/60, GBP 20/35/50, USD 20/45/65 avec la table actuelle (aucune valeur métier modifiée).
- **Portraits** : les offres décrivent les quatre supports d'un portrait cadrage standard, une personne, zéro animal et sans options payantes. Les prix viennent de la grille réellement acceptée par le configurateur, pas d'une conversion d'un prix EUR ni de nombres fixes. Le calcul utilise `computeOrderSubtotal`, comme la caisse. Une sélection personnalisée ne redéfinit pas le produit de référence : elle modifie le devis du visiteur, pas ces offres de départ par support.
- **Frais** : `Offer.price` est hors livraison ; `shippingDetails.shippingRate` utilise le vrai `computeShipping` de la même grille et la même devise. Zéro pour le fichier/bon numérique, forfait courant pour les tirages. Le total affiché après sélection du support égale prix de l'offre + frais, au centime près.
- **Changement de devise** : l'offre portrait disparaît dans le même rendu que les anciens prix, jusqu'à réception de la grille correspondante. Réponses tardives, erreur HTTP, timeout ou grille invalide ne doivent jamais publier une ancienne grille sous une nouvelle devise. Le bon change immédiatement de grille de montants avec le DOM. Le JSON-LD ne fait aucune requête de prix supplémentaire.
- **Indisponibilité serveur** : aucun `DEFAULT_PRICE_SET` n'est publié comme prix marchand. L'interface et le JSON-LD attendent la même lecture réussie. Le seed EUR approuvé et le cache `prixEnCache`/API existants sont conservés.
- **Sécurité** : script natif `application/ld+json`, avec échappement de `<` dans le sérialiseur partagé (guide Next installé `json-ld.md`). Props de l'îlot client sérialisables ; aucun accès base depuis cet îlot.

## Vérification locale et portée

Commande ciblée (sans secrets) :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/seo-prices*.test.mjs
```

Les tests rendent les vraies pages async, `CurrencyProvider`, `FicheProduit`, `BonCadeauClient` et les scripts JSON-LD : SSR React puis `hydrateRoot` dans Chromium. Ils parsèrent les scripts dans le DOM et sélectionnent chacun des quatre supports réels. Sont couverts FR/EUR, UK/GBP, US/USD, absence de cookie, montants/frais décimaux non proportionnels entre grilles, changement manuel, course réseau, échec de lecture, reprise et absence d'offre trompeuse avant hydratation.

Frontières isolées explicitement : accès base/cache remplacés par des grilles de test ; API prix interceptée localement ; adaptateurs Next/next-intl et médias remplacés ; Stripe/paiement/upload/tracking désactivés. Toute requête navigateur hors origine `seo.invalid` est bloquée. Ce n'est ni un test des tarifs en base de production ni un achat. Les tarifs de test différents par devise prouvent l'usage des grilles réelles plutôt que d'une conversion simple.

TDD observé : bon GBP RED (JSON-LD 20/40/60 contre DOM 20/35/50) puis GREEN ; portrait GBP RED (offre EUR encore présente pendant le chargement GBP) puis GREEN ; échappement JSON-LD RED puis GREEN. Les cas de matrice/régression complètent ces cycles.

## Résultats locaux

- `node --test tests/seo-prices*.test.mjs tests/prices.test.mjs tests/product-prices-browser.test.mjs tests/gift-prices-browser.test.mjs` en `env -i` : **31/31 passent**, aucun skip.
- `npm run lint` en `env -i` : code 0, 0 erreur, 28 avertissements dans les fichiers hors périmètre.
- Contrôle TypeScript complémentaire `node node_modules/typescript/bin/tsc --noEmit --incremental false` en `env -i` : code 0.
- `git diff --check` : code 0.
- Premier build avec sockets bloquées : timeout pendant compilation, non validé. Contrôle final parent sans ce blocage, avec environnement réduit, identifiants factices, PostgreSQL jetable et migrations email/upload/promo : `npm run build` code 0. Le même artefact lancé localement répond HTTP 200 sur `/fr/bon-cadeau`, `/fr/simpson`, `/en/bon-cadeau`, `/en/simpson` ; serveur et base arrêtés après contrôle. Aucun accès production.
- Bilan global final : 22 fichiers, 177 tests réussis, aucun échec ni test ignoré. Les 21 suites inchangées sont conservées du passage complet ; la suite chat a été réexécutée après correction de la course Échap (12/12). Lint final code 0, 28 avertissements hors périmètre. Déploiement et validation Rich Results externe restent non effectués.

**Limite externe** : Google Rich Results Test / Schema Validator non exécutés. Une cohérence locale n'est pas une preuve d'éligibilité Google ni d'indexation. Un robot sans rendu JavaScript ne reçoit pas d'offre ; Google doit rendre le JS et réussir la lecture de grille. La suppression volontaire d'offres SSR évite la contradiction mais peut réduire la découverte des offres par des crawlers sans JS. Une future stratégie d'URL explicites par devise + SSR cohérent serait un autre chantier. Ne pas marquer la validation Rich Results externe comme terminée avant contrôle d'une preview autorisée, puis du déploiement autorisé.
