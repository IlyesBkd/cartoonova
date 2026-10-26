# E2E-02 · CRO-10 · SEO-03 · SEO-04 — preuves locales

## Résultat et périmètre

Cartes exactes relues depuis `cache/ten-cards-local/trello-before.json` du profil Cartoonova. Modifications locales, sans commit/push/publication, sans accès à une base ni à un fournisseur externe. Les requêtes Chromium sont interceptées ; commandes exécutées sous `env -i` avec PATH/HOME/TMPDIR uniquement. Aucun email réel ni paiement.

- **E2E-02** : la vraie page de suivi réutilise `product.fullbodyLabel`, `product.portraitBust`, les libellés des quatre supports du configurateur et `formatPrice(total, currency, langue)`. Les anciens libellés de support déjà localisés restent affichables. Matrice rendue React : dix langues × quatre supports × deux montants (19.98 et 5.00), GBP pour EN, EUR pour les autres. Ce n'est pas une nouvelle transaction Stripe.
- **CRO-10** : opt-in navigateur désormais obligatoire, indépendamment de l'ancien drapeau. Aucun import du SDK analytique ni chargement du pixel avant acceptation explicite ; refus sans collecte « cookieless ». Une navigation ne change pas le choix. Notice partagée bannière/mentions/confidentialité dans dix langues, description de PostHog et du pixel ChatGPT au lieu de Google Analytics. Bouton de préférences réinitialisant le choix puis rechargeant pour décharger le code déjà actif. Contrôles supplémentaires contre initialisation analytique asynchrone après retrait et événements automatiques après refus.
- **SEO-03** : clé dédiée `tj.catalogueMetaTitle` dans dix catalogues, titre explicite sur le portrait cartoon personnalisé. Slogan conservé visuellement. Test de `generateMetadata` avec vrai next-intl, résolution du titre et génération des balises par les modules Next installés, puis lecture de `document.title` et unicité de `head title` en Chromium.
- **SEO-04** : source unique `CATALOGUE_EN_LIGNE.length`, observée à **35**. Paramètre ICU `count` pour H1 catalogue, CTA accueil/produit, clé de navigation et description métadonnée/JSON-LD bon cadeau. Le vrai composant Catalogue rend ses 35 entrées et son titre dans les dix langues ; la page bon cadeau rend ses métadonnées et son contenu JSON-LD depuis le même nombre. Test des traductions avec un deuxième nombre pour détecter les constantes cachées. Les nombres d'adresse/identité dans les légales et les commentaires internes historiques n'ont pas été remplacés.

## RED → GREEN

Tests comportementaux ajoutés avant les correctifs de chaque tranche : suivi brut, titre collections non descriptif, promesses figées à 36, politique de navigation implicite et déclenchement analytique sans drapeau. Les premiers passages ont échoué, puis sont devenus verts après implémentation. Les premières tentatives ont également révélé des erreurs de harnais corrigées (clés de support, environnement `process` navigateur, doublure de composant CJS) ; elles ne sont pas présentées comme des RED métier.

RED supplémentaire reproduit et conservé : refus non respecté par `before_send` pour un événement automatique `$pageleave`. Autre RED observé : retrait immédiat après acceptation laissant initialiser le SDK en cours d'import. Les deux comportements sont désormais couverts et verts. Journal RED conservé : `cache/ten-cards-local/copy-consent-red.log` (profil Cartoonova).

## Exécutions finales

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test \
  tests/ten-cards-copy.test.mjs \
  tests/ten-cards-consent.test.mjs \
  tests/ten-cards-consent-ui.test.mjs
# 7 tests, 7 pass, 0 fail, aucun skip

env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --import tsx --test \
  tests/privacy.test.mjs tests/privacy-browser.test.mjs
# 7 tests, 7 pass, 0 fail, aucun skip
```

Journaux complets : `cache/ten-cards-local/copy-green.log` et `privacy-green.log` du profil. Les tests de consentement utilisent les vrais wrappers et la vraie bannière React en Chromium ; frontière SDK instrumentée et requêtes pixel interceptées. Le test de confidentialité existant utilise ensuite le **vrai SDK PostHog installé**, avec choix explicite et transport intercepté : événements commerciaux utiles conservés, données privées synthétiques absentes, replay toujours désactivé.

Vérification de non-régression additionnelle : `tests/delivery-copy.test.mjs` + `tests/photo-privacy-copy.test.mjs` donnent **11 pass / 1 fail**. L'échec restant interdit tout checkbox dans le formulaire de photos ; le lot parallèle FLOW-08 vient d'ajouter une case de remplacement de sélection, sans rapport avec un consentement promotionnel. Les clauses confidentialité photo et délais rendues passent. Le parent doit restreindre cette assertion à la notice `data-photo-privacy` sans supprimer le contrôle de remplacement.

## Intégration et limites à ne pas masquer

1. **FicheProduit.tsx appartient à un autre agent** : son appel `t("stylesTous")` doit recevoir `{ count: CATALOGUE_EN_LIGNE.length }` et l'import catalogue si nécessaire. Proposition transmise via `cache/ten-cards-local/product-style-count.patch-proposal.md`. Sans ce raccordement, ICU manque de paramètre sur la fiche produit : SEO-04 n'est pas intégralement validé sur l'arbre réuni.
2. La garde `PENDING` de la page suivi est conservée conformément à l'instruction d'intégration. Le helper `canDepositPhotos` de `lib/clientOrderPolicy.ts` est maintenant disponible ; le parent doit aligner l'affichage du dépôt avec cette règle FLOW-05, sans en recréer une autre.
3. Pas de build global, démarrage Next compilé ni validation HTTP des routes complètes dans ce sous-lot. La preuve de titre passe par les fonctions Next installées et le navigateur, pas par un serveur Next compilé. Le parent possède le harnais compiled fixtures.
4. Lint ciblé tenté, mais commande bloquée par le garde d'exécution avant lancement (budget de lecture du script épuisé). Ce n'est pas une validation lint. Typecheck global et revue finale à l'intégration.
5. **Aucune validation juridique ni conclusion de conformité RGPD**. Les anciennes clauses d'identité commerciale/médiateur/transferts ne sont pas prouvées par ces tests et restent à vérifier sur justificatifs ; les autres paragraphes légaux non concernés sont conservés. Le choix n'efface pas rétroactivement les données déjà collectées ni les cookies tiers historiques. Le traitement transactionnel/analytique côté serveur n'est pas un audit global de consentement.
6. Aucun gain CTR/classement démontré. Suivi GSC à position comparable après publication éventuelle, non réalisée ici.

## Fichiers de ce lot

`messages/{fr,en,de,es,it,nl,pl,sv,da,pt}.json` ; `app/(hors-langue)/suivi/[token]/page.tsx` ; `app/[locale]/{collections,bon-cadeau}/page.tsx` ; `components/pages/{Accueil,Catalogue}.tsx` ; `components/{PageLegale,BandeauConsentement,CookiePreferences}.tsx` ; `lib/{analytics,pixelChatgpt,consentementMesure}.ts` ; `lib/i18n/cookieConsent.ts` ; `lib/legal/{fr,en,de,es,it,nl,pl,sv,da,pt}.ts` ; `tests/ten-cards-{copy,consent,consent-ui}.test.mjs` ; adaptation des imports/opt-in du harnais `tests/privacy-browser.test.mjs` ; présent rapport.
