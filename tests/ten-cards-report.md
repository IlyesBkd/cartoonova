# Dix cartes — bilan final d’intégration locale

## Verdict

**Dix cartes implémentées et vérifiées localement, non poussées et non publiées.** Les cartes Trello restent ouvertes jusqu’à une publication autorisée et vérifiée. Ce rapport final prime sur les limites d’intégration désormais résolues dans les rapports intermédiaires, qui sont conservés comme historique de preuve.

La validation porte sur l’arbre réuni après les correctifs et les deux revues finales, pas sur l’addition des campagnes ciblées des agents. La production n’a pas été modifiée. OPS-02 (restauration) reste exclue.

## Vérifications globales réellement exécutées

- `npm test`, environnement minimal sans secrets métier : **449/449 tests, 48/48 fichiers**, aucun échec, skip, todo ou annulation. Inventaire final comparé au manifeste ; `ok:true`, `complete:true`. Preuve : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/tap-XNYCyE/summary.json` et reçu `cache/ten-cards-local/global-tests-verified.json` du profil.
- `npm run lint` : sortie 0 ; **0 erreur, 28 avertissements**. Pas de prétention à un lint sans avertissement.
- `npm run build` : sortie 0, PostgreSQL 18 jetable avec schéma et migrations, identifiants synthétiques ; aucune base métier ni fournisseur réel.
- Même artefact lancé par `next start` : **69 contrôles HTTP** réussis, dont routes publiques/localisées, suivi et dépôt synthétiques, refus admin sans authentification.
- Chromium sur cet artefact, desktop et mobile : **48 contrôles** réussis, dont collections/suivi dans dix langues, prix exacts EUR/GBP/CHF/SEK/DKK/PLN selon fixture, actions éligibles, refus dépôt impayé, zoom/récapitulatif, compteur 35, refus et réouverture des préférences cookies.
- Le seul échec JavaScript externe explicitement toléré par ce banc hors réseau est `Failed to load Stripe.js`. Pas de paiement bancaire réel ni de validation Stripe fournisseur revendiqués.
- Serveur Next et base jetable arrêtés dans le nettoyage vérifié. Captures desktop produit et mobile suivi inspectées : pas de chevauchement ni débordement évident dans les zones visibles ; le bandeau cookies reste volumineux sur mobile.
- Revue backend finale indépendante : `tests/ten-cards-backend-final-review.json`, `passed:true`, aucune faille confirmée. Les neuf empreintes de fichiers du rapport correspondent encore à l’arbre final.
- Revue consentement finale indépendante : `tests/ten-cards-consent-final-review.json`, `passed:true`, aucune faille reproduite. Les anciennes revues défavorables restent conservées et explicitement antérieures aux corrections.
- Scan statique complémentaire des 65 fichiers source/test modifiés : 12 alertes classées comme fixtures synthétiques ou appel d’expression régulière, aucune alerte non résolue. Ce scan simple ne constitue pas un audit exhaustif de sécurité.

Preuves HTTP, build, navigateur et scans : `/home/hermes/.hermes/profiles/cartoonova/cache/ten-cards-local/`. Les comptes de tests ciblés des rapports suivants se recouvrent et ne sont pas additionnés aux 449 tests globaux.

## Cartes vérifiées localement

1. **FLOW-05 — actions par lien client** : paiement réel `paid_at` et jalons communs aux pages/API ; statut administratif libre non utilisé comme preuve de paiement. Dépôt, réponse à l’aperçu et avis refusés hors phase, y compris après attente sur verrou. [Carte](https://trello.com/c/DKXx0OQV)
2. **FLOW-08 — doubles livraisons express/extras** : registre PostgreSQL durable par octets/options/destinataire ; verrou partagé, rejeux et états incertains. Extras exigent une livraison finale `sent` compatible avec le contenu courant, pas seulement une ancienne date. Concurrence multiprocessus exercée. [Carte](https://trello.com/c/W8wxsCW5)
3. **FLOW-07 — ajout/remplacement photos** : ajout cumulatif par défaut, retrait/remplacement explicites avec instantané, propriété et plafond huit photos sous verrou, conflits et retries vérifiés. Retirer une référence ne supprime pas le fichier Blob. [Carte](https://trello.com/c/JQKJTafx)
4. **FLOW-06 — conserver l’expédition** : champs absents conservés, effacement explicite distingué ; première date préservée. Coût et destinataire canoniques jusqu’à l’email pour POST ; PATCH enregistre sans notifier. [Carte](https://trello.com/c/EFNN9eNe)
5. **QA-02 — contraste** : jeton de texte doré séparé des ornements, vrais styles et mesures desktop/mobile ; décorations `aria-hidden` désormais obligatoirement vérifiées. Les cas axe incomplets sur images/gradients ne sont pas annoncés conformes. [Carte](https://trello.com/c/tQQIaGe8)
6. **E2E-02 — suivi traduit et montants** : libellés des formats/supports via catalogues, prix selon langue/devise ; rendu ciblé et routes compilées dix langues, actions disponibles selon paiement/phase. [Carte](https://trello.com/c/SyOCbKv6)
7. **FLOW-09 — retouches** : borne partagée 2000 unités UTF-16, refus explicite au-delà, texte accepté conservé sans troncature entre commande/historique/email, transaction et rollback exercés. [Carte](https://trello.com/c/0hIuGbJe)
8. **CRO-10 — consentement** : PostHog après accord explicite uniquement, refus prioritaire même si Storage écrit en erreur, synchronisation interonglets et abandon des files batch/retry. **Pixel navigateur ChatGPT totalement désactivé même après accord** : la suppression de script/rechargement ne prouvait pas son arrêt immédiat. Notices alignées dans dix langues. [Carte](https://trello.com/c/Pr4ntP6j)
9. **SEO-03 — titre collections** : métadonnées descriptives localisées, slogan visuel conservé ; rendu Next réel, `document.title` et serveur compilé exercés. Aucun gain de classement/CTR prétendu. [Carte](https://trello.com/c/tc1TzCKk)
10. **SEO-04 — nombre de styles** : source unique `CATALOGUE_EN_LIGNE.length`, actuellement 35 ; paramètres ICU et appel partagé FicheProduit raccordés ; catalogue, CTA et métadonnées testés. [Carte](https://trello.com/c/2WpSF5IH)

## Résolution des défauts d’intégration

- Anciennes fixtures `paid`/sans paiement remplacées par de vrais jalons synthétiques ; 23 tests notifications passent dans la campagne finale. Le bootstrap historique isolé ne masque pas un échec produit.
- Gardes des trois chemins de livraison fondées sur `paid_at`, non sur la casse du statut.
- Confirmation physique vérifie aussi l’email canonique ; ancien email refusé.
- Retouche non livrée ou mêmes URL/octets différents : extras refusés jusqu’à livraison compatible ; historique sans empreinte : refus protecteur 409.
- Expédition POST utilise l’état relu sous verrou jusqu’au fournisseur et calcule le coût canonique ; pas d’email pour PATCH.
- Chiffres décoratifs masqués dans leurs vrais composants ; compteur FicheProduit et actions de suivi raccordés ; assertion de confidentialité ciblée sur la notice plutôt que les contrôles de remplacement de photos.
- Consentement : ancien accord Storage, pending interonglets, files PostHog et annulation `beforeunload` exercés. Pixel désactivé plutôt que prétendre à une API d’arrêt fournisseur non vérifiée.

## Limites et prérequis avant publication

- **Aucun push, déploiement, schéma ou commande de production modifié.** La migration `migrations/20261026_order_delivery_effects.sql` doit être appliquée par une procédure autorisée avant activation en production. Aucun backfill de preuve historique inventé.
- **Attribution publicitaire ChatGPT côté navigateur suspendue.** Conversions serveur inchangées et hors audit de consentement global. Pas d’arrêt rétroactif des anciens documents déjà chargés, ni d’effacement des données historiques revendiqués.
- PostHog : purge batch/retry dépend des structures internes de la version installée ; conserver les tests lors des mises à jour. Si Storage refuse toute écriture, la propagation aux autres onglets n’est pas garantie.
- Pas de garantie d’un seul envoi pour l’expédition : email accepté puis réponse/commit perdu impose une vérification fournisseur avant renvoi. Final/extras gardent leurs états durables d’incertitude et leur réconciliation explicite. Les transactions longues peuvent produire de la contention.
- Les images sont téléchargées/décodées avant détection de certains doublons ; coût de travail non supprimé. L’empreinte prouve les octets téléchargés, pas l’immuabilité future d’une URL externe ni la réception en boîte email.
- Retouche : aucun nouvel outbox atomique ajouté entre commit et accusé email. Expédition reste le proxy métier disponible pour l’avis physique, pas une livraison transporteur prouvée.
- Pas d’achat bancaire, d’email client, de fournisseur Blob réel, de Safari/Firefox/lecteur d’écran ni d’audit juridique/RGPD exhaustif. Les mocks/interceptions ne constituent pas une acceptation fournisseur.

## Rapports détaillés

- `tests/ten-cards-client-report.md` : actions, photos et retouches, rapport intermédiaire.
- `tests/ten-cards-delivery-integration-report.md` : correctifs backend RED/GREEN et limites.
- `tests/ten-cards-contrast-report.md` : mesures détaillées de contraste et état intermédiaire.
- `tests/ten-cards-copy-report.md` : titres, compteurs et traduction, état intermédiaire.
- `tests/ten-cards-pixel-disable-report.md` : décision de désactivation et preuves adversariales finales.
- `tests/ten-cards-backend-final-review.json` et `tests/ten-cards-consent-final-review.json` : verdicts finaux indépendants.
