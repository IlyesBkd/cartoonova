# Audit complet du site + backlog — 2 octobre 2026

Ce backlog fait suite à `audit-parcours-client-2026-09.md`. Les points encore ouverts de ce premier audit sont repris ici, et ce fichier devient la liste de travail.

## Suivi

| Date | Points | État |
|---|---|---|
| 2 octobre 2026 | P0-3, P0-6, P1-1, P1-2, P1-3, P1-4, P1-5, P1-6, P1-10 | Faits, vérifiés en local, voir ci-dessous |

**Fait le 2 octobre 2026 :**
- **P0-3 Vitesse.**
  - Les pages de langue sont maintenant statiques : régénérées en arrière-plan au plus toutes les heures (fiches, collections, cadeau : 5 min, à cause des prix), puis servies par le CDN. Le build passe de 0 à 1 023 pages pré-générées.
  - Toutes les lectures en base des pages publiques passent par un cache partagé (`lib/lecturesCache.ts`), invalidé tout de suite quand un prix change ou qu'un avis est modéré.
  - Restructuration : `app/[locale]/layout.tsx` est devenue la mise en page racine. Les pages hors langue (succès, suivi, dépôt, bon, bonus, confirmation d'aperçu) sont passées dans `app/(hors-langue)/`, sans changement d'URL. La 404 des URL inconnues vit dans `app/global-not-found.tsx`.
  - Mesure en production : à faire juste après le déploiement.
- **P0-6 Bouton retour.** Il ferme la caisse, l'image agrandie, le menu mobile et le chat, au lieu de quitter la page. La configuration reste intacte. Après une fermeture par la croix, un seul appui sur retour suffit pour quitter la page.
- **P1-1 Chat** traduit dans les 10 langues. Le bouton s'appelle « Aide ». Une seule promesse de délai partout : réponse sous 24 h, du lundi au vendredi (au lieu de « moins de 2 h »).
- **P1-2 À propos** traduite dans les 10 langues. Délais corrigés : aperçu en 2 jours, impression en 3 à 7 jours ouvrés.
- **P1-3 Tutoiement partout**, en français et en allemand, dans les pages, la caisse, les e-mails, le chat, le formulaire d'avis et les données du catalogue. Quelques formes polies en espagnol et en néerlandais aussi. Exceptions voulues : les pages juridiques, et le bouton « Je confirme, lancez l'impression » (c'est le client qui parle à l'équipe). L'assistant de support et les rédacteurs de fiches et de blog ont la consigne de tutoyer.
- **P1-4 Accueil.** « Sans frais cachés » devient « … en fichier numérique. Impression en option, livraison en plus », et « livraison 2 jours » devient « fichier en 2 jours » (10 langues). Corrections au passage :
  - délais « 3 jours de plus » ou « 3 à 5 jours » remplacés par « 3 à 7 jours ouvrés » dans la FAQ, l'e-mail de bienvenue et les données structurées ;
  - « Livré en 2 jours » devient « Fichier en 2 jours ».
- **P1-5 Accueil mobile.** Le portrait de famille apparaît sous le titre, dans le premier écran (à 380 px sur un écran de 664 px).
- **P1-6 E-mails.**
  - Une seule règle de validation pour tout le site (`lib/email.ts`) : « test@exemple » est refusé à la caisse et sur le serveur.
  - Proposition « Tu voulais dire …@gmail.com ? » sur les fautes courantes, avec correction en un clic.
- **P1-10** L'ancienne adresse info.cartoonova@gmail.com est remplacée par support@cartoonova.com dans les 10 langues.

**Nouveaux points relevés pendant ce lot :**
- **P1-18. Textes de fiches en base au vouvoiement.** 🤖 S
  - Les 225 textes de fiches déjà rédigés (table `contenus_fiche`) restent au « vous ».
  - La consigne de tutoiement ne vaut que pour les prochains textes, et la rédaction est bloquée tant que les crédits OpenAI ne sont pas rechargés (P0-7).
  - À régénérer ou à convertir une fois les crédits rechargés.
- **P1-19. Suppression des photos : deux délais.** 👤 décision
  - La fiche dit « tes photos sont supprimées après 30 jours ». Les faits de l'assistant de support disent « 90 jours après la livraison ».
  - Quelle est la vraie règle ?
- **P1-20. Éclair de devise hors zone euro.** 🤖 S
  - Les pages étant maintenant statiques, la devise n'est plus connue au rendu côté serveur. Un visiteur suisse, américain ou britannique voit un instant le prix en euros (ou en livres sur /en) avant sa devise.
  - Correctif possible : masquer les montants jusqu'à la lecture du cookie.
- **P1-21. Chiffres toujours inventés.** La page À propos les affiche maintenant dans les 10 langues : « 85 000+ », « 3 000+ avis », « 50+ pays ». Ils sont regroupés dans des clés, pour être corrigés en un seul endroit dès la décision P0-1.

## Comment l'audit a été fait

| Passe | Ce qui a été testé | Résultat |
|---|---|---|
| 1. HTTP | Les **897 URL** du sitemap : statut, temps de réponse, titre, description, h1, canonical, og:image, JSON-LD | 897/897 en 200 |
| 2. Liens | Les 914 liens internes trouvés dans les pages | 0 lien cassé, 1 redirection évitable |
| 3. Rendu | 185 pages dans Chromium (17 types × 10 langues sur iPhone 13, plus 13 pages sur bureau), avec les mesures suivantes : erreurs JS, images cassées, débordement, LCP/CLS, texte brut, langue, accessibilité | Voir ci-dessous |
| 4. Parcours | Numérique, toile, code promo, devises, bon cadeau, contact, pages après-vente avec jetons invalides, bureau | 4 défauts |

Tests sans aucun paiement ni écriture en base : PostHog bloqué, envoi du lead intercepté, parcours d'achat joués sur le serveur local avec les clés Stripe de test.

**Ce qui va bien :**
- Aucune erreur 404 ni lien cassé.
- Aucune image cassée.
- Aucun débordement horizontal sur 185 pages.
- Aucune traduction manquante.
- Un seul h1 par page, canonical correctes, hreflang présents dans le sitemap.
- La 404 est traduite dans la coque du site.
- Messages d'erreur clairs dans la caisse.
- Le prix de la fiche, celui de la caisse et celui facturé sont identiques.

**Non testé (impossible sans vraie carte ou vrai appareil) :**
- Paiement réel (carte, PayPal, Apple Pay sur iPhone) et rendu des e-mails dans Gmail/Outlook.
- Admin.

À faire une fois, toi-même, avec une vraie commande à 5 € remboursée ensuite (voir Z-1).

**Effort estimé :**
- **S** = moins d'une heure ;
- **M** = une demi-journée ;
- **L** = un à deux jours.

**Responsable :**
- 👤 = action de ta part (décision, compte externe) ;
- 🤖 = je peux le faire.

---

## Priorité 0 — Ce qui coûte de l'argent, des clients ou un risque légal

**P0-1. Les chiffres inventés sont toujours en ligne.** 👤 décision → 🤖 S
- « 2 540 avis vérifiés », « 85 000+ portraits livrés » et « 4,9/5 » apparaissent sur l'accueil, les fiches et /avis.
- Les faux avis « Sophie M. — Achat vérifié » sont toujours là. La page « À propos » dit « plus de 85 000 portraits créés ».
- Réalité : 25 commandes payées et 0 avis en base.
- C'est une pratique commerciale trompeuse (Code de la consommation, art. L121-2 et L121-4), et c'est le premier motif de suspension Google Merchant.
- À remplacer par des formulations vraies (« Retouches illimitées », « Satisfait ou remboursé », « Aperçu sous 2 jours »). Afficher les vrais avis dès qu'il y en a (voir P2-1).
- *Reprend A-1.*

**P0-2. Identité légale.** 👤 informations → 🤖 S
- Le SIRET des mentions légales ressemble à un placeholder. Il manque la raison sociale réelle et l'adresse.
- Sans elles, les CGV ne sont pas opposables, et Stripe ou Google peuvent bloquer le compte.
- *Reprend A-3.*

**P0-3. Les pages mettent 7 à 18 secondes à s'afficher pour le premier visiteur.** 🤖 M
- **Mesure :**
  - Les fiches, collections, idées cadeaux et blog répondent en 7 à 16 s quand personne ne les a vues depuis quelques minutes, puis en 0,6 à 2 s.
  - LCP mobile : médiane 2,5 s, et 91 pages sur 185 au-dessus de 2,5 s (le seuil « bon » de Google). Jusqu'à 18 s sur /it/avis, /pl/spersonalizowany-portret-naruto et /sv/blog/….
  - Tous les en-têtes indiquent `Cache-Control: no-store` et `X-Vercel-Cache: MISS`.
- **Cause :** `app/[locale]/layout.tsx:102` lit `headers()` (pays du visiteur) dans le layout commun. Toutes les pages deviennent donc dynamiques : rien n'est mis en cache, et chaque visite rouvre le tunnel SSH vers la base.
- **Correction :**
  - Faire détecter le pays par `proxy.ts`, qui le pose en cookie (c'est déjà fait pour la devise), et le lire côté client.
  - Rendre les pages statiques avec revalidation (fiches, collections et cadeau toutes les heures, blog toutes les 5 min).
  - Mettre en cache les lectures de prix et de contenu.
- **Effet attendu :** des pages servies en moins de 300 ms partout. C'est le plus gros levier SEO et conversion de la liste.

**P0-4. La base de production n'a aucune sauvegarde automatique.** 🤖 S
- Le seul timer de sauvegarde du VPS (`hermes-biweekly-backup`) sauvegarde la configuration de l'assistant Hermes, pas Postgres.
- Les seules sauvegardes de la base sont celles faites à la main (25/09, 26/09, 01/10), sur le même disque que la base.
- Une panne disque efface donc les commandes, les clients et les bons cadeaux.
- **Correction :**
  - `pg_dump` chaque nuit dans la crontab, avec une rotation sur 14 jours.
  - Une copie hors du VPS (bucket S3/Backblaze, environ 1 €/mois, ou Google Drive). 👤 Il faut créer le compte de stockage.

**P0-5. Le disque du VPS est plein à 96 %.** 👤 décision → 🤖 S
- Il reste 4,5 Go. Si le disque se remplit, Postgres s'arrête et **le site ne peut plus prendre de commande**.
- `/home/hermes` occupe 65 Go et `/home/ubuntu` 17 Go. La base ne fait que 116 Mo.
- **À faire :**
  - Supprimer `/tmp/cartoonova-inspect` (1,2 Go).
  - Regarder ce que contient `/home/hermes`.
  - Ajouter à la veille une alerte Discord au-dessus de 85 %.

**P0-6. Le bouton « retour » du téléphone, caisse ouverte, fait quitter la fiche.** 🤖 S
- Sur mobile, c'est le geste naturel pour fermer une fenêtre. Le client perd alors toute sa configuration et ses photos.
- **Correction :** ajouter une entrée d'historique à l'ouverture de la caisse, et fermer la caisse au retour.

**P0-7. Crédits OpenAI épuisés.** 👤
- La rédaction des fiches, le moteur de blog et la sonde de citation tournent sans rien produire depuis fin septembre.

---

## Priorité 1 — Conversion et qualité perçue

**P1-1. Le widget de support est en français sur les 10 langues.** 🤖 S
- Sur /en, /de, /pl… la bulle affiche « Une question sur votre portrait ? On est là », « Où en est ma commande ? », « Modifier ma commande ».
- Pour un visiteur étranger, c'est le signe d'un site bricolé.

**P1-2. La page « À propos » n'est traduite dans aucune langue.** 🤖 S
- Tout son texte est en français sur les 10 versions.
- Elle dit aussi « impressions livrées en 5 jours ouvrés », ce qui contredit les 3 à 7 jours annoncés ailleurs, et « 85 000 portraits » (voir P0-1).

**P1-3. « Tu » et « vous » mélangés.** 👤 choix → 🤖 M
- Dans le même écran d'accueil, on lit « **Votre** photo transformée » puis « **Ton** portrait sous 2 jours ».
- Même mélange dans la caisse : « **Vos** informations » puis « On peut **te** rappeler **ton** panier ».
- Il faut choisir une forme et l'appliquer partout : textes, e-mails, assistant. Le tutoiement colle mieux au ton cartoon.
- *Reprend B-10.*

**P1-4. Les promesses de l'accueil sont devenues ambiguës avec la livraison payante.** 🤖 S
- « 5 € par personnage — une famille de 4 : 20 €. **Sans frais cachés** » et le bandeau bureau « **livraison 2 jours** » ne sont vrais que pour le fichier numérique.
- Formulation proposée : « Fichier en 2 jours » et « Impressions : + livraison 4,90 € ».

**P1-5. Accueil mobile : le premier écran n'a aucune image.** 🤖 S
- Sur iPhone, on voit un titre, un prix et un bandeau, mais aucun portrait avant de défiler. Sur bureau, la photo de famille est bien là.
- *Reprend C-10.*

**P1-6. La caisse accepte les e-mails sans domaine.** 🤖 S
- « test@exemple » passe. Une faute de frappe (gmail.con, hotmial.fr) fait perdre l'e-mail de confirmation, l'aperçu et le fichier final.
- **Correction :**
  - Vérifier qu'il y a un domaine et une extension.
  - Proposer « Vouliez-vous dire gmail.com ? » sur les fautes courantes.

**P1-7. La caisse accepte n'importe quel code postal.** 🤖 S
- « ABC » est accepté pour la France, donc un colis peut partir vers une adresse invalide.
- **Correction :** valider le format pour les principaux pays (FR et DE : 5 chiffres ; GB, CA et NL : formats propres).

**P1-8. Saisie d'adresse assistée.** 🤖 M
- Une adresse imprimée se tape aujourd'hui en 7 champs sur mobile.
- **Correction :** suggestions d'adresse, via Google Places ou l'API Adresse (gratuite pour la France).
- *Reprend D-4.*

**P1-9. Erreur d'hydratation React sur /depot, /confirm-poster et /success.** 🤖 S
- Le HTML du serveur et celui du navigateur diffèrent. Le contenu peut clignoter, et React abandonne la correction.
- Ce sont précisément les pages après paiement.

**P1-10. Mauvaise adresse de support sur la page de confirmation d'aperçu.** 🤖 S
- `/confirm-poster` avec un lien expiré, ainsi que `lib/email-i18n.ts`, indiquent **info.cartoonova@gmail.com**, en 7 occurrences.
- Partout ailleurs, c'est support@cartoonova.com.

**P1-11. La page de dépôt de photo, lien expiré, ne parle qu'anglais.** 🤖 S
- Un client français y lit « Invalid or expired link ».
- Les autres pages après-vente (suivi, bonus, bon) sont bilingues.

**P1-12. Saut de mise en page sur certaines fiches.** 🤖 S
- CLS de 0,53 sur /de/personalisierte-pokemon-karte, 0,17 sur /sv/cadeau/simpson-fodelsedag et 0,14 sur /pt/retrato-naruto-personalizado. Le seuil est de 0,1.
- Le bouton bouge pendant le chargement, ce qui fait cliquer à côté.

**P1-13. Accessibilité de la caisse.** 🤖 S
- À l'ouverture de la caisse, le focus clavier reste derrière la fenêtre.
- **Correction :** placer le focus dans la caisse et l'y garder tant qu'elle est ouverte.
- Il y a aussi 7 cibles tactiles de moins de 24 px sur chaque fiche (pastilles et liens de la galerie).

**P1-14. Amazon Pay activé dans Stripe mais pas configuré.** 👤 S
- Chaque ouverture de la caisse produit des erreurs « merchantId=undefined » vers payments-eu.amazon.com.
- Constaté en mode test ; probablement le même réglage en production.
- **Correction :** désactiver Amazon Pay dans le tableau de bord Stripe (Paramètres → Moyens de paiement), ou finir sa configuration.

**P1-15. L'adresse e-mail du client part dans la console du navigateur.** 🤖 S
- On voit `[CHECKOUT] INSERT PENDING | email: …` et une douzaine de journaux `[CARD]` à chaque paiement.
- *Reprend D-5.*

**P1-16. Fin du prix de lancement le 15 novembre : à automatiser.** 🤖 S
- Le bandeau annonce « puis 19 € le portrait », mais les prix ne changeront que si tu les modifies toi-même dans l'admin le 16.
- En cas d'oubli, le site affiche une promesse fausse. En cas de retard, il vend à perte.
- **Correction :** basculer automatiquement la grille à la date prévue, avec une alerte Discord la veille.

**P1-17. Fiches et collections encore très longues sur mobile.** 🤖 M
- 15 à 17 écrans pour les fiches et les collections, 20 à 23 pour les articles de blog.
- Le bouton « Commander » reste haut, mais tout ce qui suit la garantie pourrait être replié ou remonté en onglets.
- *Suite de C-9.*

---

## Priorité 1 — Référencement (SEO)

**S-1. Données structurées produit incomplètes.** 🤖 S
- Le JSON-LD `Product` n'a ni `shippingDetails` ni `hasMerchantReturnPolicy`.
- Depuis que la livraison est payante, Google l'exige pour les fiches marchandes, et Search Console affichera des avertissements.

**S-2. 113 pages sans image de partage (og:image).** 🤖 S
- Concerne l'accueil, collections, blog, idées cadeaux, Noël, bon cadeau, quelle photo, portfolio, avis, contact et à propos, dans les 10 langues.
- Un lien partagé sur WhatsApp ou Facebook s'affiche sans visuel.

**S-3. 73 pages sans données structurées.** 🤖 S
- Blog (liste), cadeau, bon cadeau, portfolio, avis, contact, à propos et pages légales.
- À ajouter : `CollectionPage`, `ItemList`, `Organization` et `ContactPage`.

**S-4. Titres et descriptions trop longs.** 🤖 M
- 307 titres dépassent 60 caractères et 183 descriptions dépassent 160 caractères. Google les coupe.
- À raccourcir automatiquement par gabarit (le « — Cartoonova » final peut sauter sur les fiches).

**S-5. Descriptions en double.** 🤖 S
- 70 doublons : l'accueil et /cadeau partagent la même description dans les 10 langues, et d'autres pages suivent le même schéma.
- 27 titres sont identiques entre l'espagnol et le portugais (« Retrato Bleach Personalizado »). Ce n'est pas bloquant, mais un mot propre à chaque langue les distinguerait.

**S-6. Pages légales en français seulement.** 🤖 M
- CGV, mentions légales et confidentialité n'existent qu'en /fr. Un visiteur allemand qui paie accepte des CGV qu'il ne peut pas lire.
- Le lien /politique-de-confidentialite (sans langue), depuis les CGV, passe par une redirection.
- Le minimum : traduire les CGV en anglais et lier la bonne version depuis la caisse.

**S-7. Google Merchant.** 🤖 S
- Le flux déclare une livraison à 0 € pour le prix de départ (le numérique), ce qui reste juste.
- À vérifier après déploiement : aucun avertissement « prix ou livraison incohérents » dans Merchant Center.

---

## Priorité 1 — Exploitation et sécurité

**O-1. En-têtes de sécurité absents.** 🤖 S
- Seul HSTS est présent. Il manque `X-Frame-Options` (la caisse peut être encadrée par un autre site), `X-Content-Type-Options`, `Referrer-Policy` et une politique de contenu (CSP).
- Se règle dans `next.config` en quelques lignes.

**O-2. Bascule des tâches GitHub vers le VPS.** 🤖 S
- Les deux systèmes tournent en parallèle depuis le 1ᵉʳ octobre.
- **Le 4 octobre :**
  - vérifier le journal des tâches (`ge_job_runs`) ;
  - couper les plannings GitHub ;
  - supprimer l'ancienne clé SSH de cette machine dans `authorized_keys`.

**O-3. Fichiers non versionnés à trier.** 🤖 S
- `lib/emailNouvelleCommande.ts` est cassé et inutilisé (erreur TypeScript permanente).
- `.github/workflows/veille-taches.yml` est devenu inutile.
- Il reste trois fichiers « C:Users…notify-signals » créés par erreur, et `portable-content-publisher/src/core/journal.ts` qui n'est pas branché.

**O-4. Erreur TypeScript permanente.** 🤖 S
- Elle disparaît avec O-3. Ensuite, il faudra ajouter une vérification `tsc` à chaque push, pour qu'une erreur ne s'installe plus en silence.

---

## Priorité 2 — Confiance et après-vente

**P2-1. Obtenir les premiers vrais avis.** 🤖 S + 👤
- La demande d'avis part 10 jours après la livraison, mais 0 avis est arrivé.
- **Pistes :**
  - un lien d'avis direct sur la page bonus ;
  - une relance à J+20 ;
  - un bon de 3 € contre un avis avec photo (autorisé s'il est accordé quel que soit l'avis, positif ou négatif).
- *Reprend E-1.*

**P2-2. Page de suivi : afficher la prochaine action du client.** 🤖 S
- Les étapes imprimées sont en ligne depuis aujourd'hui.
- Il reste à mettre en avant le bouton « Valider mon aperçu » quand un aperçu attend, et « Envoyer mes photos » quand il en manque.
- *Suite de E-2.*

**P2-3. Retouche demandée : la montrer dans le suivi.** 🤖 S
- Après une demande de retouche, le suivi affiche « Aperçu envoyé » comme si de rien n'était.
- Ajouter la mention « Retouche demandée, nouvel aperçu sous 24 h ».

**P2-4. Un vrai essai de bout en bout chaque mois.** 👤 S
- Une commande réelle à 5 €, remboursée ensuite.
- **Vérifier :** e-mails reçus dans Gmail, page de succès, suivi, dépôt de photo et page bonus.
- C'est le seul test qui couvre la vraie banque, les vrais e-mails et Apple Pay.
- (Z-1 dans la section d'introduction.)

---

## Priorité 3 — Produit et contenu (repris de l'audit de septembre)

| Point | Quoi | Effort |
|---|---|---|
| C-4 | Des visuels de support qui montrent la différence (toile, cadre, poster en situation) | 👤 photos ou 🤖 maquettes M |
| C-7 | De vraies réactions de clients (vidéo de déballage, photo du cadeau offert) | 👤 |
| C-12 | Portfolio : seulement du Simpson, sans la photo d'origine → avant/après dans tous les univers | 🤖 M |
| F-5 | Le portrait sur d'autres objets (tasse, coussin, puzzle) | 👤 fournisseur + 🤖 L |
| F-6 | Cartes de vœux de Noël personnalisées | 🤖 M, **avant le 15 novembre** |
| F-7 | Calendrier 2027 | 🤖 M, **avant le 1ᵉʳ décembre** |
| F-8 | La carte Pokémon au vrai format carte | 👤 fournisseur + 🤖 M |
| G-4 | Galerie avant/après | 🤖 S |
| G-5 | Page « Garantie » | 🤖 S |
| H-1 | Nettoyer PostHog (événements morts, doublons) | 🤖 S |
| H-2 | Regarder les enregistrements des visiteurs qui ont ouvert la caisse | 👤 30 min |

*C-6 (« montrer qui dessine ») et G-3 sont retirés : ils contredisent la règle de ne jamais décrire comment les portraits sont réalisés.*

---

## Ordre proposé

1. **Cette semaine :**
   - 👤 P0-1 (chiffres), P0-2 (SIRET), P0-7 (OpenAI), P1-14 (Amazon Pay), P1-3 (tu/vous) ;
   - 🤖 P0-3 (vitesse), P0-4 (sauvegardes), P0-5 (disque), P0-6 (bouton retour).
2. **Ensuite, un lot « finitions »** 🤖 : P1-1, P1-2, P1-4 à P1-13, P1-15, P1-16, S-1 à S-5, O-1, O-3, O-4. Environ une journée en tout.
3. **Avant le 15 novembre :** P1-16 (bascule des prix), F-6 (cartes de vœux) et S-6 (CGV en anglais).
4. **En continu :** P2-1 (avis), P2-4 (commande test mensuelle), O-2.

Le site ne sera jamais « fini » au sens où plus rien ne bougera : les prix, les fêtes, les nouveaux univers et les avis demandent une petite intervention régulière. Mais une fois les priorités 0 et 1 faites, il n'y aura plus de défaut connu. Il ne restera que des améliorations au choix.
