# Dix cartes suivantes — local, non publié

## Livrables et statut

Correctifs et preuves préparés pour relecture après la revue indépendante `next-ten-review.json` (verdict initial : changes_requested). R1/R2/R3 corrigés localement ; aucune nouvelle approbation indépendante présumée. Aucun commit, push, changement Trello, paiement, envoi client, migration de production ou activation de service payant. Les cartes ne doivent pas être clôturées sur la seule base du lot local.

Résultats finaux : `tests/next-ten-cards-verification.json`. GSC réel : `tests/ten-cards-field-report.json`. Commentaires proposés au parent (non envoyés) : `tests/next-ten-cards-trello-payloads.json`.

| Carte | Réalisation locale | Limite restante |
|---|---|---|
| FLOW-02 | Politique commune paiement/portrait/destinataire, validation physique liée à la version et au destinataire, date cadeau, extras après livraison. Recontrôle sur ligne verrouillée avant effet ; planification explicite sous verrou ; annulation de commande absente refusée. Aucun override admin implicite. | Revue produit/publication nécessaires. Un dépôt peut être conservé sans programmer le tirage non validé : ce n'est pas une livraison. |
| FLOW-04 | Langue canonique ; bons internes `avis:`/`parrainage:` sans récupération Stripe ; langue de récompense persistée dans `promo_codes.gift_lang`. | Migration `20261026_gift_language.sql` avant publication autorisée. Pas de backfill historique deviné. |
| SEO-08 | GSC lecture seule 28/90 jours, sitemaps, top requêtes/pages, inspection de sept URL. | PSI public 429 (quota quotidien) ; autre accès CrUX 403 (identité API requise). LCP/INP/CLS p75 non obtenus. Pas d'export exhaustif GSC Page Indexing. |
| CRO-11 | Guide FR/EN pour qui/date/univers ; trois styles, total numérique explicite 1/2/4 personnes depuis la grille devise, bon cadeau et catalogue complet ; exposition/choix/clic instrumentés. | Aucun gain commercial mesuré. Attribution/cohortes et analyse achat payé/marge/session après publication autorisée. |
| SEO-06 | Quatre URL FR : requête/intention/titre/description/introduction/maillage distincts dans `lib/articleIntents.ts`. Lookup partagé limité aux clés propres. Aucune fusion sans preuve. | Corps markdown d’origine inchangés ; mapping/introduction ne prouvent pas la disparition d’un chevauchement. Revue des vrais corps et approbation éditoriale ; suivi GSC 28–90 jours après publication. |
| SEO-05 | Pas de lastmod statique inventé ; updatedAt des articles conservé. Test de fonction et deux lectures HTTP locales. | Pas de changement éditorial en production. |
| OPS-03 | Build minimal synthétique, cache filesystem Turbopack build désactivé, sortie isolée ; scan exact des valeurs privées synthétiques avec gzip/Brotli ; garde Git suivie/stagée ; exclusions caches/preuves. Test négatif masqué. | Signature regex != preuve d'absence de tout secret inconnu. Scan exact limité aux valeurs injectées. Aucun cache préexistant purgé, aucune clé réelle tournée. |
| CODE-14 | CSP enforcement, origines existantes conservées, attributs script interdits ; navigateur bloque script étranger/onclick ; probes Stripe/PostHog autorisées et simulées localement. | unsafe-inline des balises script demeure explicite. Aucune CSP nonce stricte affirmée ; aucune transaction PSP/3DS/portefeuille réelle validée. |
| FLOW-10 | Déjà corrigé dans la base précédente ; nouveau transport capturé PNG/JPEG/WebP avec extension/MIME/octet cohérents et décodage Sharp. | Aucun email tiers ; aucune amélioration de délivrabilité client affirmée. |
| SEO-07 | Repli applicatif apex combine protocole/hôte/chemin, conserve query et 307 à la racine ; tests de cibles/statuts et dix locales accessibles sans cookie. | Vercel peut rediriger avant le code. Aucun réglage domaine modifié ; réduction des sauts de production à valider séparément après autorisation/publication. |

## Terrain réel — 2026-10-26, sc-domain:cartoonova.com

- 28 jours, 2026-09-26 → 2026-10-23 : 98 clics, 1 846 impressions.
- 90 jours, 2026-07-26 → 2026-10-23 : 178 clics, 2 830 impressions.
- Sitemap actuel www : 999 URL web soumises, zéro erreur/avertissement déclarés, téléchargé le 2026-10-26. Le champ historique `indexed: 0` de l'API sitemap n'est pas une mesure de couverture réelle : l'inspection confirme des URL indexées.
- Inspection : six URL « Envoyée et indexée ». L'article `idees-de-cadeaux-d-anniversaire-pour-femme-et-homme` est « Détectée, actuellement non indexée ». Aucun motif supplémentaire inventé.
- Anciens sitemaps avec erreurs historiques observés, aucune suppression/soumission exécutée.
- Requête principale 28 jours : cartoonova (37 clics/57 impressions). Exemples de pages : /en (19 clics), /fr (13), /fr/portrait-playmobil-personnalise (11). Détails API dans le JSON terrain.
- Aucune baisse SEO/cannibalisation/défaillance CWV inférée. Pas de p75 mobile remplacé par un chiffre laboratoire. PSI quota dépassé et CrUX sans identité API refusé : blocages externes réels, aucune API payante activée.

## Mesure CRO (pas de gain présumé)

Événements sans texte libre ni identité client : `gift_guide_viewed` (guided-v1), `gift_guide_choice`, `gift_guide_recommendation_clicked`. Après R1, ce dernier part uniquement de l’activation du lien disponible (clic/Entrée), jamais du span désactivé pendant chargement/erreur. Sources métier existantes : purchase_completed serveur, payment_error, payment_form_error, payment_refunded. Un clic ne compte pas comme achat payé. Les choix 1/2/4 personnes affichent des exemples de prix ; ils ne sont pas transmis au configurateur et ne préconfigurent pas un panier.

Avant analyse, approuver attribution persistante et cohorte témoin FR/EN, durée et taille ; ne pas présenter une comparaison brute avant/après comme A/B. Principal : achats réellement payés/sessions exposées. Second : marge nette/session avec coûts réels, remboursements et devises normalisées ; quantifier les coûts manquants sans inventer la marge. Garde-fous : erreurs paiement/formulaire, remboursements et abandons. Le lot fournit une entrée instrumentée, pas un résultat commercial.

## Reproduction et sûreté

- Tests : `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm test`, runner existant et PostgreSQL 18 jetable ; aucune base prod chargée.
- Lint/build/HTTP/navigateur : `python3 scripts/verify-ten-cards-local.py`. Refuse toute entrée `.env*` à la racine avant services/build, sans lire ni imprimer son contenu. Réutilise le snapshot privé de schéma du banc antérieur : ce prérequis extérieur empêche une reproduction depuis un clone seul. Ne charge pas les secrets Hermes. Clés synthétiques, PostgreSQL temporaire sur port libre, sortie `.next-ten-local` séparée de `.next`. Le tsconfig modifié automatiquement par Next est restauré. `.next-*` exclu du lint et Git.
- `npm run check:artifacts` : contenu courant suivi ; `npm run check:artifacts:staged` : blobs exacts stagés, refus des chemins interdits/erreurs de lecture/signatures, aucune valeur imprimée. Distinct du scan exact décompressé du build.
- Preuves privées antérieures conservées : `/home/hermes/.hermes/profiles/cartoonova/cache/next-ten-local/`. Les relances post-revue créent un dossier unique `cache/next-ten-review-*` (chemin exact dans le JSON de vérification), sans écraser ces preuves.
- Préexistants `cache/` et `tests/ten-cards-delivery-evidence/` préservés et non ajoutés. Rapports du lot antérieur non écrasés.
- Catalogues/cadeaux des dix locales : 200 sous CSP sans cookie. Guide volontairement FR/EN seulement.
- Décision cookies antérieure préservée : aucun bandeau automatique ; PostHog par défaut pour nouveaux visiteurs ; refus/retraits antérieurs respectés ; pixel ChatGPT désactivé. Le banc navigateur intercepte aussi /ingest et les origines tierces.

## Suivi de la revue indépendante

- **R1** : événement de recommandation déplacé du parent vers le seul lien disponible. `tests/gift-guide-browser.test.mjs` monte les vrais composants et pilote Chromium en FR/EN : chargement, HTTP 503, reprise, clic désactivé, clavier et Entrée, payloads exacts, exemple deux personnes et option bon urgent. Aucun SDK analytique ni fournisseur réel dans ce test.
- **R2** : `getFrenchArticleIntent` partagé par transformation et page, garde `Object.hasOwn`. Régressions `constructor`, `toString`, `__proto__`, `hasOwnProperty` et slug inconnu : objet original préservé et aucune intention renvoyée. Le rendu de l’aside utilise ce même lookup ; ce test ne prouve pas l’adéquation éditoriale des corps.
- **R3** : refus métier sous verrou SQL : déjà livré → 409, commande disparue → 404. `tests/scheduling-sql.test.mjs` utilise le helper et la route effectifs avec PostgreSQL jetable et première lecture périmée ; aucun email/effet de livraison. Test permanent de véritable attente `FOR UPDATE`, paiement devenu absent sous verrou refusé, date cadeau trop tôt refusée puis date acceptée relue en SQL.
- **Langues** : régression SQL `tests/email-outbox.test.mjs` sur dix langues × clés `avis:`/`parrainage:` : création → `gift_lang` → `lireBon` → rendu page, reprise idempotente ; `NULL` historique → anglais et achat `pi_` valide avec récupération Stripe simulée. Aucun backfill historique.
- **Isolation** : refus fail-closed de tout `.env*` racine, testé avec cinq noms ; logs sans contenu. Les fichiers `.env*` sont refusés, pas ignorés ni effacés.
- **Navigateur compilé final** : scénario EN au clavier, prix USD indisponible HTTP 503 puis reprise, absence de lien actif pendant l’échec, prix de couple, bon urgent ; FR et probes CSP conservés. Les assertions d’événements sont dans le test Chromium des composants, pas dans le navigateur compilé. Pas d’audit a11y exhaustif.

Suite intégrale finale : **465 tests réussis, 53 fichiers, 0 échec/skip**, code de sortie 0 et inventaire stable (preuves `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/tap-m9aA6F/` ; journal `cache/scratch/next-ten-review-full-suite.log`).

Preuves post-revue build/HTTP/navigateur : `/home/hermes/.hermes/profiles/cartoonova/cache/next-ten-review-pj5higo1/` (`build-verification.json`, `browser.json`, logs et trois captures). Lint : 0 erreur, 28 avertissements hors des fichiers modifiés. Build isolé, TypeScript et 20 HTTP collections/cadeau sur dix langues : succès ; SDK Stripe/3DS/wallets réels non testés. Les scans exacts de deux secrets synthétiques ne prouvent pas l’absence de toute donnée sensible. `tests/next-ten-cards-verification.json` contient l’exécution intégrale finale et le manifeste actualisé ; l’ancien rapport de vérification est conservé avec ces preuves privées. Aucun résultat terrain n’a été actualisé ou inventé.

## Portes avant publication — non effectuées

1. Revue indépendante du diff et mapping éditorial ; commit local après validation.
2. Autorisation séparée de migration gift_lang, à appliquer avant le code ; colonne nullable peut rester lors d'un rollback applicatif.
3. Stripe test/3DS/portefeuilles et analytics en staging autorisé avec CSP enforcement. Aucun paiement réel dans ce lot.
4. Revue séparée de la configuration Vercel ; ne pas exécuter `vercel-redirection-apex.mjs` (mutateur) ici.
5. Accès/export CrUX approprié et export GSC Page Indexing si couverture exhaustive attendue.
6. Publication uniquement sur instruction ; vérifier alors l'état distant et ne pas confondre local et production dans Trello.
