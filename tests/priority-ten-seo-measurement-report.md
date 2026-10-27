# SEO-08 / SEO-02 / SEO-06 / CRO-11 — mesure réelle, 27 octobre 2026

## Conclusion et périmètre

**Diagnostic actualisé, pas d’effet SEO/CRO démontré.** Le déploiement déjà publié est `dpl_4vUcX42ywKTh4VTn4dbm34zX6NLQ`, SHA `0abc3ab8c237de665858f27ddd77d99214a9bc72`, READY/PROMOTED selon la vérification du parent. La publication remonte approximativement au 26 octobre : il manque le recul nécessaire, indépendamment des autres lacunes de données ci-dessous. Les données GSC finales collectées s’arrêtent au **24 octobre**, donc **avant** cette publication. Elles ne peuvent absolument pas mesurer son effet.

Ce sous-agent n’a modifié ni pages, ni copy, ni instrumentation, ni base métier. Aucun commit/push, changement Trello, contact client, paiement ou activation d’API payante. La lecture SQL est passée dans une transaction `READ ONLY` avec timeout ; seules métadonnées et comptes de noms de clés JSON ont été exportés, jamais valeurs de commandes, identités, images ou messages clients. Les événements PostHog restent agrégés côté fournisseur ; aucun export d’acteurs/sessions identifiables.

Rapports antérieurs relus : `tests/gift-pilots-report.md`, `tests/closure-followup-report.md`, `tests/next-ten-cards-delivery-report.md` et les payloads historiques. Les quatre tickets et leurs critères sont rapprochés du snapshot exact du parent `cache/priority-ten/trello-before.json`, sans nouvelle requête ni écriture Trello. Les mentions historiques « non publié » de ces rapports ne décrivent **plus** la production actuelle. SEO-07 est déjà corrigé et vérifié par le parent ; aucune nouvelle action domaine/redirection proposée ici.

**Preuves machine :** `/home/hermes/.hermes/profiles/cartoonova/cache/priority-ten/seo-measurement/summary.json`. Les autres JSON du même dossier contiennent requêtes, statuts et résultats agrégés ; chemins privés de preuve, pas pièces jointes publiques.

## SEO-08 — données GSC, indexation et vitesse

### Collecte fraîche GSC réussie

Compte de service et propriété exclusivement `*_CARTOONOVA`, scope `webmasters.readonly`. **48/48 requêtes analytiques HTTP 200**, type `web`, `dataState:final`, fenêtres inclusives de durée exacte, pagination par lots de 25000 jusqu’au dernier lot. Les totaux ci-dessous viennent des requêtes sans dimension, **pas** de la somme des lignes de requêtes anonymisées ou pages.

| Fenêtre | Clics | Impressions | CTR | Position moyenne | Lignes pages | Lignes requêtes |
|---|---:|---:|---:|---:|---:|---:|
| 2026-09-27 → 2026-10-24, 28 jours | 100 | 1888 | 5,30 % | 8,34 | 257 | 114 |
| 2026-07-27 → 2026-10-24, 90 jours | 181 | 2903 | 6,23 % | 9,39 | 361 | 156 |

Ces deux fenêtres se recouvrent : elles ne forment pas un avant/après. Les précédents 98/1846 et 178/2830 concernaient des fenêtres finissant le 23 octobre, avec un autre début. Les nouveaux totaux ne sont pas une progression attribuable au déploiement.

Top pages **par impressions, 28 jours** : `/es/retrato-tim-burton-personalizado` 193 impressions / 0 clic ; `/fr/portrait-playmobil-personnalise` 140 / 10 ; `/en/custom-playmobil-portrait` 90 / 9 ; `/it/simpson` 90 / 2 ; `/nl/gepersonaliseerd-tim-burton-portret` 85 / 0. Top requêtes : `cartoonova` 57 / 38 ; `retrato tim burton` 46 / 0 ; `playmobil personnalisé photo` 45 / 4 ; `tim burton portret` 28 / 0 ; `playmobil personalizzati` 17 / 1. Classements et listes 90 jours dans `summary.json` et `gsc.json`. Ni cinq pages ni les requêtes visibles ne constituent toute la demande.

### Indexation : dix URL exactes, pas couverture globale

**10 inspections HTTP 200**, dont les six pilotes anniversaire et les quatre articles : **9 verdicts PASS** « Envoyée et indexée ». L’article `idees-de-cadeaux-d-anniversaire-pour-femme-et-homme` reste **NEUTRAL, « Google ne reconnaît pas cette URL »**, sans date de crawl renseignée. Les neuf PASS ont un canonical Google identique au canonical déclaré. Leurs dates de crawl connues sont toutes antérieures à la publication récente : pas de preuve de prise en compte des nouveaux textes.

Lecture HTTP publique indépendante : **12/12 statuts 200 et 12/12 canonicals autoréférents**, pour ces dix URL et les deux index cadeaux FR/EN. Les quatre H1 éditoriaux distincts et le guide sur les deux index sont déjà présents publiquement (`public-http.json`). Cela ne prouve ni nouveau crawl ni nouvelle position Google.

Sitemap `https://www.cartoonova.com/sitemap.xml` soumis et téléchargé le **27 octobre**, **1000 URL web et 2200 images soumises**, zéro erreur/avertissement. Trois anciennes entrées apex conservent une erreur chacune : `/pages/html-sitemap.xml`, `/pages/html-sitemap`, HTTP `/sitemap_index.xml` (aussi deux avertissements). Aucun retrait distant effectué. **Le champ historique `indexed:0` de cette API ne mesure pas le nombre de pages indexées.** L’export agrégé du rapport GSC « Pages » reste indisponible par ce chemin API ; dix inspections ne le remplacent pas.

### Vitesse publique : blocage confirmé, alternative RUM réelle

- PageSpeed Insights API gratuite : **429**, quota ; aucune clé payante ajoutée.
- API CrUX publique sans clé : **403**, appelant non enregistré.
- Tentative indépendante dans l’UI publique PSI pour `https://www.cartoonova.com/fr`, mobile : **« Unable to resolve »** après analyse (`pagespeed-browser.json`). Les GET directs du site réussissent ; ce message ne démontre donc pas une panne du site.
- **Aucun p75 CrUX/Google obtenu**, ni note Lighthouse inventée ou substituée au terrain.

L’accès PostHog Cartoonova fonctionne réellement (projet 145750, clé personnelle Cartoonova dédiée ; présence de l’hôte Cartoonova vérifiée par agrégation). Ses événements `$web_vitals` donnent une **RUM propriétaire existante**, autre source que CrUX. Les noms des propriétés ont été découverts sans lire leurs valeurs individuelles. Requêtes mobiles sur 28 jours glissants, hôte www exact ; exclusion des user-agents nommés HeadlessChrome/Lighthouse/PTST et de routes privées sélectionnées ; identifiant pageview exigé ; maximum de chaque métrique par pageview avant le p75 :

| Métrique RUM PostHog | Pageviews avec cette métrique | p75 |
|---|---:|---:|
| LCP | 134 | 2365 ms |
| INP | 49 | 160 ms |
| CLS | 18 | 0,0010471 |

**Ce n’est pas un verdict CWV Google**, ni un gain après publication. Les métriques ont des populations différentes, particulièrement petites pour CLS ; la détection robots et l’historique de collecte ne garantissent pas une population entièrement organique/consentie. La période glissante contient majoritairement l’ancienne version. Ni représentativité, ni consentement historique de chaque visite, ni comparaison avant/après ne sont établis. Les données ne justifient donc pas de qualifier tous les templates de rapides ou de clore le critère CrUX/couverture globale. SQL et résultats séparés : `analytics-p75-{LCP,INP,CLS}.json`.

## SEO-02 — six pilotes publiés, cas clients toujours non autorisés

Les six URL anniversaire d’origine sont conservées. La baseline historique `cache/four-cards-local/gsc-gift-baseline.json` et le rapport pilote donnent Rick et Morty : 14 impressions / 0 clic sur 2026-07-25 → 2026-10-22. La fenêtre fraîche de 90 jours, décalée, donne encore **14 / 0**, position 3,142857 ; sur 28 jours **11 / 0**, position 3,090909. Les cinq autres URL obtiennent des totaux filtrés à zéro sur ces deux fenêtres ; aucune ligne de requête détaillée. **Cela ne veut pas dire non-indexées** : les six inspections ont justement PASS. Les faibles signaux disponibles ne permettent ni classement de gagnants ni décision d’extension.

Les rapports et le code légal distinguent réalisation, commande et autorisation promotionnelle séparée. Le schéma public de la vraie base a été relu : aucune table/colonne dédiée identifiée à cette autorisation ; inventaire des clés présentes dans `orders.options` et `orders.origine` sans clé de publication/consentement trouvée. La table `reviews` contient avis/vérification/modération, **pas une preuve d’autorisation de réutilisation des photos ou du portrait**. Les documents de preuves disponibles ne fournissent pas de dossier séparé liant réalisation, occasion anniversaire, brief et autorisation explicite révocable.

**Aucun cas client autorisé n’a donc été identifié dans ce périmètre vérifié.** Cela ne prétend pas qu’un accord ne pourrait exister dans une archive externe non examinée. Aucune commande ou photo n’a été extraite pour fabriquer un cas ; aucun témoignage/histoire/occasion inventé ; aucune nouvelle publication. Les suggestions de composition et les visuels du catalogue restent des suggestions/références, pas des cas originaux prouvés.

**Reste :** dossier séparé de consentement vérifiable et six cas effectivement autorisés si ce critère est maintenu ; premier bilan sur au moins 28 jours complets post-publication, prolongé si volumes insuffisants, avec fenêtres égales, appareils/pays/type de recherche comparables. Pas d’extension sur ce seul état initial.

## SEO-06 — rôles éditoriaux distincts, aucun signal de cannibalisation mesurable

Les quatre rôles documentés dans `lib/articleIntents.ts` / `lib/articleBodies.ts` restent : budget/délai ; goûts du destinataire ; comparaison support/qualité photo ; brief de portrait à partir d’un souvenir. Le suivi précédent avait déjà relu et différencié les vrais corps, pas seulement les métadonnées. Les H1 correspondants sont maintenant visibles en HTTP public. Aucune réécriture supplémentaire, fusion ni redirection ajoutée.

Sur **90 jours finissant le 24 octobre** : guide anniversaire général **1 impression / 0 clic** ; comparatif photo **2 / 1** ; deux autres totaux filtrés **0 / 0**. **Zéro ligne de requête détaillée pour chacune des quatre URL**, sur 28 comme sur 90 jours. L’absence de détail requête ne signifie donc pas zéro exposition. Ces volumes et ce calendrier ne démontrent ni cannibalisation, ni disparition d’un chevauchement, ni effet éditorial. L’article femme/homme reste inconnu de Google à l’inspection.

**Reste :** approbation métier du mapping si non consignée ailleurs, observation post-publication 28–90 jours, indexation/crawl frais et données requête→page suffisantes. Ne pas fusionner une paire faute de données. Aucune conclusion statistique sur ce petit échantillon.

## CRO-11 — vrais accès analytics, mais pas de cohorte commerciale exploitable

### Ce qui existe réellement

- Le guide est déjà servi sur `/fr/cadeau` et `/en/cadeau`, confirmé par GET public.
- `GiftGuide.tsx` appelle `gift_guide_viewed` avec `variant:guided-v1`, `gift_guide_choice` et `gift_guide_recommendation_clicked`. L’exposition part au montage, **pas** à une visibilité dans le viewport démontrée. Aucun mécanisme d’assignation témoin/cohorte persistante n’y est identifié.
- Le calculateur offline `lib/giftGuideMeasurement.ts` et sa vraie CLI `scripts/measure-gift-guide.mjs` existent. Il exige un export déjà joint, consenti, avec `sessionId`/`cohort` et commandes payées par `orderId`/`sessionId`, revenu net après taxes/remboursements et coûts variables réels. Il ne faut pas remplacer ces identifiants par email/IP/proximité temporelle ou clic CTA.
- Ses **7/7 tests passent**, vraie CLI incluse : déduplication, refus/orphelins, cohortes sans achat, absence de devise fabriquée, montants multidevises séparés et coût inconnu.

### Données réelles obtenues, sans identités

- Lecture PostHog sur 90 jours : **aucun des trois événements guide**, confirmé avec **et sans filtre d’hôte**. Ce n’est donc pas simplement un hostname manquant.
- Derniers 28 jours : **une seule pageview observée des deux index FR/EN**, `/en/cadeau` le **24 octobre**, antérieure à la publication récente ; aucune sur ces routes après publication dans les résultats collectés. Le manque d’exposition observée empêche de déduire une panne de collecte de l’absence d’événement guide.
- Le projet reçoit pourtant de vrais événements récents : 115 `$pageview` et 106 `$web_vitals` sur sept jours pour les hôtes Cartoonova, entre autres ; pas une absence globale d’accès ou un projet vide.
- Les agrégats des événements métier sur 28 jours donnent **10 `purchase_completed` et 1 `payment_error`**, chacun **sans `$session_id` ni `cohort`**. Aucun événement retourné `payment_refunded` ou `payment_form_error` par cette requête. Ce sont des comptes d’événements, **pas dix ventes live auditées**, ni une preuve d’absence de remboursement ou d’erreur réelle.
- Les événements récents interrogés ne portent pas de `cohort`. Schéma SQL réel sans liaison explicite session/cohorte/consentement à la commande ; inventaire des clés JSON enregistrées sans telle liaison. Une colonne `orders.cout` existe, mais son existence ne prouve ni exhaustivité ni réconciliation des coûts/taxes/remboursements.

### Blocage précis, pas taux à zéro

Il n’existe **dans les chemins exercés** ni export consenti session→cohorte→achat payé, ni groupe témoin assigné, ni rapprochement financier suffisant. La CLI n’a donc **pas été alimentée avec un faux export live ou des sessions inventées**. Aucun taux de conversion, marge/session, gain, ni intervalle causal du guide n’est calculable honnêtement. Ne pas annoncer une conversion 0 % à partir de zéro exposition attribuable.

Il faut distinguer : **(1)** absence de recul (~1 jour), **(2)** absence d’événements/expositions guide observés après publication, **(3)** instrumentation insuffisante pour attribuer achat payé/cohorte même avec davantage de visites. Attendre seul ne résout pas (3). Déblocage à approuver séparément : contrat de cohorte/témoin et consentement, identifiant de session non personnel explicitement propagé et persisté côté commande, rapprochement des achats/remboursements/coûts et gardes d’erreurs ; tests des vrais transports avec consentement. **Aucun changement de pages, de collecte ou de schéma appliqué ici.**

## Vérification ciblée et problème rencontré

Commande réellement exécutée en environnement minimal :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node --test tests/gift-guide-measurement.test.mjs tests/gift-guide-browser.test.mjs
```

Résultat enregistré dans `focused-tests.tap` : **27 tests, 26 réussis, 1 échec, aucun ignoré**. Le calculateur et sa CLI : **7/7**. La matrice navigateur présente à l’exécution couvre les dix langues desktop/mobile : **19/20**, dont les quatre FR/EN réussis. Échec **`it desktop`**, `Route is already handled!` à `tests/gift-guide-browser.test.mjs:34` : la fixture de prix tente de satisfaire une route déjà traitée. C’est un défaut/race du harnais constaté, **pas une preuve de panne italienne en production**. Fichier partagé non modifié par ce sous-agent ; problème transmis au parent pour son propriétaire. Aucun rerun opportuniste présenté comme une correction.

Les tests navigateur interceptent les frontières réseau et substituent le module analytics ; ils prouvent interactions et appels attendus, **pas ingestion PostHog live**. Les vrais accès live ont été exercés en lecture seule ci-dessus, sans envoyer de faux événement commercial au projet.

Aucun build global/lint global lancé ici : aucune source applicative modifiée et responsabilité du parent. Le `__pycache__` préexistant et les changements des autres agents ont été conservés intacts. Seul fichier du dépôt créé par ce lot : ce rapport. Les collecteurs et résultats JSON sont dans le cache du profil ; aucun secret n’y est écrit. Le skill `cartoonova-build-deploy` a reçu une leçon de mesure : alternative RUM PostHog distincte de CrUX et diagnostic exposition/cohorte avant toute conclusion sur un guide.

## Critères faits / restants

| Carte | Fait et vérifié | Non établi / reste ouvert |
|---|---|---|
| SEO-08 | GSC frais 28/90 jours, tops, sitemap ; dix inspections ; RUM mobile propriétaire réelle ; PSI/CrUX réellement essayés | p75 CrUX/Google, couverture globale « Pages », représentativité et comparaison temporelle |
| SEO-02 | Six pages existantes publiques/indexées à l’inspection ; baseline reconduite sans extension | Six cas originaux avec autorisations séparées ; effet post-publication avec recul/volume suffisants |
| SEO-06 | Quatre H1 publics cohérents avec les rôles et corps déjà différenciés ; données exactes page et requête | Un article inconnu de Google ; requêtes trop rares ; validation métier consignée et suivi 28–90 jours |
| CRO-11 | Guide déjà public ; accès analytics réel ; calculateur/CLI 7/7 ; blocage attribution et exposition identifié | Cohortes/témoin, lien consenti vers achat payé et finance, garde-fous réels, recul ; race du harnais `it desktop` |

**Aucune de ces cartes ne devient clôturable sur la seule base de ce diagnostic.** Les gains non mesurés ne sont ni nuls ni négatifs : ils sont inconnus.
