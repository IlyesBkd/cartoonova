# Quatre cartes — réalisation locale, non publiée

Périmètre : CODE-02, EXT-UX-01, QA-03 et SEO-02. OPS-02 (restauration des données) expressément exclu, non réalisé. Base de travail : `2528120e70c8e61720211eebbc5994319c9595d6`.

## Résultats par carte

- **CODE-02** : chaque paiement portrait/bon cadeau reçoit une preuve aléatoire serveur distincte, portée par un cookie HttpOnly (Secure en production, SameSite Lax pour le retour GET banque) et vérifiée avant lecture/finalisation ou création de commande. Une empreinte et une expiration sont conservées dans les métadonnées du paiement ; le type est contrôlé. Un identifiant PaymentIntent seul ne suffit plus. Voir `tests/checkout-ownership-report.md`.
- **EXT-UX-01** : zoom en dialogue natif au-dessus du bandeau/header, fermeture par vrai clic/tap, Échap et Retour, focus rendu au déclencheur. Matrice de composants : 35 produits × 10 langues × desktop/mobile. Voir `tests/product-ui-report.md`.
- **QA-03** : support nommé dès le rendu serveur, indépendant de la disponibilité des tarifs ; nom accessible traduit mis à jour après sélection. Voir le même rapport UI.
- **SEO-02** : six pages anniversaire FR existantes enrichies de conseils photo/décor, suggestions de composition, légendes honnêtes et FAQ propres visibles/JSON-LD. Aucune nouvelle page. Baseline GSC et plan de mesure après publication conservés. **Critère de cas clients originaux d’anniversaire non réalisé** faute de preuves ; ni avis ni histoire inventés. Voir `tests/gift-pilots-report.md`.

## Vérifications d’intégration exécutées par le parent

- `npm run lint` : succès, environnement minimal sans secrets.
- `npm run build` : succès avec PostgreSQL jetable, schéma et six migrations applicables, identifiants fournisseurs synthétiques ; aucun accès aux données de production.
- Même artefact servi par `next start` : dix routes HTTP 200 (produits FR/EN, Noël, admin et six pilotes). Deux endpoints admin sans session refusés en 401.
- Chromium sur le vrai site compilé : six fiches × desktop/mobile (récapitulatif nommé, croix au-dessus des couches, clic réel sans force et focus restauré), six pilotes × desktop/mobile avec guide et canonical attendus, et confirmation PI seul sans lien signé exposé. **25 contrôles d’intégration**. Reçu : `cache/four-cards-local/compiled-browser.json` du profil Cartoonova.
- Requêtes externes et mutations métier bloquées. Premier harnais navigateur arrêté sur `Failed to load Stripe.js`, conséquence attendue du blocage réseau ; seule cette erreur précise a été distinguée des autres erreurs JS, puis tous les contrôles ont réussi. **Ce n’est pas une validation du fournisseur Stripe réel ni un achat de bout en bout réel**.
- Captures locales examinées : support mobile non vide, guide cadeau lisible. Les prix du build sont des fixtures synthétiques, pas une vérification commerciale des prix de production. Une première capture zoom était prise pendant son animation d’entrée ; elle ne sert pas à valider une opacité finale.
- Serveur et PostgreSQL jetables arrêtés dans le nettoyage vérifié.
- Scan statique : seul signal dans une déclaration de fixture explicitement synthétique (`tests/checkout-proof.test.mjs:24`), pas de secret utilisateur découvert par ce scan limité.

## Contrôles globaux et revue

Deux revues indépendantes finales favorables (`deleg_bfbe8e5d`) : sécurité checkout et UI/SEO, sans blocage sécurité ou logique. Le parent a conservé les verdicts et limites dans `cache/four-cards-local/reviews.json` du profil Cartoonova. Suggestions non bloquantes : retour bancaire par vrai lien intersite, gestion bornée des cookies de checkouts abandonnés, vérification Safari/Firefox et lecteur d’écran. Le manque de cas clients anniversaire reste une réserve d’acceptation SEO, pas un résultat réalisé.

Suite globale `npm test` : **365/365 tests réussis, 37/37 fichiers exécutés, zéro échec, annulé, ignoré ou TODO**. Le parent a relu le reçu final et rapproché programmatiquement le manifeste, les fichiers exécutés et l’inventaire courant. Reçu : `cache/four-cards-local/test-summary-final.json` du profil Cartoonova ; journal : `$TMPDIR/four-cards-all-tests.log`. Aucun total des suites ciblées n’a été additionné.

## Limites avant toute publication

- Travail **non poussé, non publié** ; aucune migration de production requise par ce lot, aucune facturation/configuration Stripe modifiée, aucun email envoyé.
- Ancien paiement dépourvu de preuve, navigateur sans cookie ou preuve expirée : confirmation refusée intentionnellement, sans repli PI/email. Les liens email déjà signés/support sont le chemin de récupération ; ne pas annoncer de compatibilité rétroactive implicite.
- Cas clients d’anniversaire non prouvés et gains SEO non mesurés. La carte SEO reste partiellement satisfaite et ne doit pas être clôturée comme intégralement validée.
- Cartes à conserver dans leur liste tant que la publication et leurs critères ne sont pas vérifiés. OPS-02 n’est ni testé ni déplacé par ce lot.
