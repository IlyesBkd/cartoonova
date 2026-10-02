# Audit complet du site + backlog — 2 octobre 2026

Ce backlog fait suite à `audit-parcours-client-2026-09.md`. Les points encore ouverts de ce premier audit sont repris ici, et ce fichier devient la liste de travail.

## Suivi

| Date | Points | État |
|---|---|---|
| 2 octobre 2026 | P0-3, P0-6, P1-1, P1-2, P1-3, P1-4, P1-5, P1-6, P1-10 | Faits, déployés et mesurés en production, voir ci-dessous |
| 2 octobre 2026 (2ᵉ lot) | P1-8, P1-9, P1-11, P1-12, P1-13, P1-15, P1-17 | Faits, déployés et revérifiés en production ; P1-14 attend une action dans Stripe |
| 2 octobre 2026 (lot SEO) | S-1 à S-8 | Faits, vérifiés sur un build de production local ; L-1 à L-4 à faire relire |
| 2 octobre 2026 (lot exploitation et contenu) | O-1 à O-4, P2-2, P2-3, C-4, C-12, G-4, G-5, F-6, F-7, H-1 | Faits, vérifiés sur un build de production local (Playwright) ; restes à ta charge listés ci-dessous |

**Fait le 2 octobre 2026, lot exploitation et contenu :**
- **O-1 En-têtes de sécurité** sur toutes les pages : nosniff, Referrer-Policy, X-Frame-Options, HSTS, Permissions-Policy (paiement autorisé pour Stripe).
  - CSP en **Report-Only** : elle ne bloque rien et envoie ce qu'elle aurait bloqué à `/api/csp` (journaux Vercel + un résumé Discord par heure au plus).
  - Parcours testé jusqu'au formulaire de carte Stripe : une seule violation trouvée (`ad.doubleclick.net`, Google Ads), origine ajoutée.
  - **À faire dans 1 à 2 semaines :** si Discord ne signale plus rien de légitime, passer l'en-tête en `Content-Security-Policy` (bloquant) dans `next.config.ts`.
- **O-2 Bascule vers le VPS faite.** Nuit du 01 au 02/10 complète dans `ge_job_runs` ; seuls échecs : crédits OpenAI et Perplexity épuisés (P0-7), qui touchaient GitHub pareil. Plannings GitHub commentés (fiches, moteur de contenu, sonde entonnoir), déclenchement manuel gardé en secours. Voir `vps/README.md`.
  - **Nouveau : disque du VPS plein à 96 %** (92 Go sur 96). À libérer avant qu'une tâche ou PostgreSQL ne tombe.
  - Note : `blog-seo` journalise une erreur PostgreSQL `index_create` mais sort en code 0, à regarder.
- **O-3** Fichiers morts retirés (mis de côté hors du dépôt), `.secrets/` et les marqueurs des hooks Claude ignorés par git.
- **O-4** Vérification à chaque push sur main (`.github/workflows/verification.yml`) : types (`next typegen` + `tsc`) et lint (erreurs seulement) sur le code du site. 4 erreurs de lint existantes corrigées ; `portable-content-publisher` (outil à part, configuration pm2 en CommonJS) reste hors du lint.
- **P2-2 / P2-3 Page de suivi :** une carte « Ce qu'il te reste à faire » en tête : envoyer ses photos, valider son aperçu, ou « Retouche demandée le …, nouvel aperçu sous 24 h » avec la note du client. L'étape « Commande reçue » ne parle plus de photos reçues quand il n'y en a pas. 10 langues.
- **C-12 / G-4 Portfolio avant/après :** 31 paires photo d'origine → portrait (6 univers d'origine + 25 fiches importées vérifiées image par image), filtre par famille, lien « Ce style » vers chaque fiche.
  - Bug de légende corrigé : 12 fiches légendaient « Transforme-toi » une image qui n'était pas l'avant/après (et l'avant/après « Imprimé en France »), 4 autres portaient des légendes sans rapport avec leurs images.
- **C-4** Fiches importées complètes (14) : les vignettes « poster » et « encadré » montrent leurs propres photos en situation au lieu des vignettes Simpson.
- **G-5 Page « Garantie »** (`/garantie`, 10 langues) : retouches illimitées, remboursement intégral sur demande (avant validation de l'aperçu pour un imprimé), impression abîmée sous 14 jours, délai de remboursement, FAQ. Liens depuis le pied de page et sous le bouton d'achat. Les réponses de FAQ qui oubliaient le remboursement sont corrigées.
- **F-6 / F-7 Carte de vœux (+4 €) et calendrier 2027 (+9 €)**, en fichiers PDF à imprimer :
  - options visibles sur la fiche du 1er octobre au 31 janvier (le serveur les ignore hors saison), présentées sur la page Noël ; prix modifiables dans l'admin ;
  - livraison : dans l'admin, bouton « Envoyer carte / calendrier » sur la commande, une fois le portrait final déposé. Il génère les PDF (carte A5 recto verso, calendrier A4 de 13 pages) dans la langue du client et les lui envoie par e-mail. Chaque clic renvoie un e-mail : ne cliquer qu'une fois.
  - **Bug corrigé au passage :** le forfait de livraison saisi dans l'admin n'était jamais enregistré.
- **H-1 PostHog :**
  - code : événement mort retiré, doubles comptes documentés (`photos_submitted`, `payment_error` : filtrer sur `$lib = posthog-node` pour un total) ; robots, localhost et navigateur de l'admin (cookie posé à la connexion admin) ne sont plus mesurés ;
  - compte : 8 anciens événements masqués (réversible) ; filtre « trafic interne » complété (robots sans tête) et coché par défaut.

**Restes à ta charge (pas de code) :**
- **P2-4** une vraie commande test par mois ; **C-7** vraies réactions de clients ; **H-2** regarder les enregistrements des sessions qui ouvrent la caisse.
- **F-5 / F-8** objets et vraie carte Pokémon : il faut d'abord un fournisseur (l'imprimeur réel n'est pas clair non plus : « Optimal Print » dans l'admin, Gelato dans le script de coûts).
- **C-4 suite** : vraies photos de toile et de cadre en situation pour les 6 univers d'origine.
- **Images importées :** l'agent qui a refait le portfolio signale que les galeries importées viendraient du catalogue cartoontoi.fr, et que certaines photos « avant » ressemblent à des photos de banque d'images. Si ce ne sont pas tes images, c'est un risque de droits d'auteur, désormais plus visible sur le portfolio. Le texte du portfolio ne parle donc pas de « vrais clients ».
- **CSP bloquante** dans 1 à 2 semaines (voir O-1).
- **Hooks Claude** : dans `~/.claude/settings.json` (lignes 66, 85, 127), écrire le chemin du `touch` avec des `/` (`C:/Users/ilyee/.claude/claude-notify-signals/...`) ; avec des `\`, il crée des fichiers au nom cassé dans le projet.
- **Clé SSH** de ce PC sur le VPS : à retirer quand tu ne veux plus que j'y accède (`ssh ubuntu@57.129.155.13` puis supprimer la ligne correspondante dans `~/.ssh/authorized_keys`).
- **Disque du VPS à 96 %** (voir O-2).

**Fait le 2 octobre 2026, deuxième lot :**
- **P1-8 Suggestions d'adresse** à la caisse des impressions :
  - Base Adresse Nationale pour la France et Monaco, Photon (OpenStreetMap) pour les autres pays ; gratuits, sans clé ;
  - utilisables au clavier (↑ ↓ Entrée Échap) ; le choix remplit l'adresse, le code postal et la ville ;
  - si le service est coupé, la saisie manuelle reste intacte ; mention « © OpenStreetMap » affichée, comme l'exige sa licence ;
  - testé : « 10 rue de la Paix Par » donne 75002 Paris, « Unter den Linden 1 Berlin » donne 10117 Berlin.
- **P1-9 Hydratation :** les pages après paiement rendaient un second `<html>` dans le premier. Plus aucune erreur sur dépôt, confirmation d'aperçu, succès, suivi, bonus et bon.
- **P1-11 :** les liens expirés de dépôt et de confirmation d'aperçu s'affichent en français puis en anglais.
- **P1-12 :** aucune page au-dessus de 0,1 de CLS en production depuis le lot précédent (mesuré).
- **P1-13 Caisse accessible :**
  - le focus entre dans la caisse (sur le champ e-mail au clavier, sur la fenêtre sur écran tactile pour ne pas ouvrir le clavier) ;
  - Tab reste à l'intérieur (0 sortie sur 35 appuis) et le focus revient au bouton « Commander » à la fermeture ;
  - plus aucune cible tactile sous 24 px sur la fiche (croix de photo, cases d'option, fil d'Ariane).
- **P1-15 :** plus aucun `console.log` dans la caisse ni sur la page de succès. Les erreurs restantes ne contiennent ni e-mail, ni secret de paiement, ni détail de commande.
- **P1-17 Pages plus courtes sur mobile :**

  | Page | Avant | Après |
  |---|---|---|
  | Collections | 16,9 écrans | 6,3 écrans |
  | Fiche | 16,1 écrans | 10,9 écrans (production) |
  | Article de blog | 22,4 écrans | 20,3 écrans |

  - Fiche : texte de l'univers replié (toujours présent dans la page pour Google), contact fusionné dans les questions, FAQ fermée et sans illustration sur mobile, fiches similaires en rail, bannière finale retirée.
  - Collections : sections en doublon retirées (atouts, bannière), catégories en rails horizontaux.
  - Article : images en rail, cartes en 2 colonnes, bandeau d'appel en double retiré.
  - Ce qui reste est l'essentiel : le configurateur fait à lui seul 4,7 écrans sur la fiche, et le texte de l'article 16,4.

**Fait le 2 octobre 2026, lot SEO (S-1 à S-8) :**

| Mesure (900 pages, build de production) | Avant | Après |
|---|---|---|
| Pages sans image de partage | 113 | 0 |
| Pages sans données structurées | 73 | 0 |
| Titres de plus de 60 caractères | 307 | 0 |
| Descriptions de plus de 160 caractères | 183 | 0 |
| Titres en double (es/pt) | 27 | 0 |
| Descriptions en double | 70 | 0 (dernière correction après la mesure) |

- **S-1 Fiches produit :**
  - une offre par support (fichier, poster, toile, portrait encadré) avec son prix et la date de fin de validité (fin du prix de lancement) ;
  - livraison déclarée : 0 € pour le fichier, forfait pour un tirage, délais des CGV ;
  - politique de retour déclarée (création sur mesure : pas de retour, CGV art. 8) ;
  - le prix maximal ne sous-estime plus le portrait encadré.
- **S-2 :** une image de partage aux couleurs du site (`public/og/`), sur toutes les pages qui n'en avaient pas.
- **S-3 :** données structurées sur le blog, cadeau, bon cadeau (produit à 3 montants, retour 14 jours), portfolio, contact, à propos et pages légales, plus un fil d'Ariane partout.
- **S-4 :** titres limités à 60 caractères (la marque n'est ajoutée que si elle tient) et descriptions à 158 caractères, coupées au mot près. Les gabarits trop longs sont réécrits.
- **S-5 :** `/cadeau` a sa propre description, le gabarit portugais est distinct de l'espagnol, et chaque page cadeau par occasion porte le nom de son style.
- **S-6 Pages légales :**
  - CGV, mentions légales et confidentialité sont traduites dans les 10 langues (`lib/legal/`), avec la mention « la version française fait foi », et sont indexables ;
  - les liens gardent la langue de la page ;
  - la caisse affiche « En commandant, tu acceptes nos conditions générales de vente » avec un lien. Ce lien manquait totalement.
- **S-7 :** le flux Merchant (fichier, port à 0 €) et les données structurées des fiches disent maintenant la même chose. **À vérifier par toi :** Merchant Center et le test des résultats enrichis de Google (search.google.com/test/rich-results) sur une fiche, après le déploiement.
- **S-8 :** les 30 articles les plus récents de chaque langue sont générés au déploiement, avec leurs hreflang et leur `og:locale`.

**À faire relire (contenu juridique, pas du code) :**
- **L-1. Identité de la société** (P0-2) : la raison sociale, l'adresse, le SIRET, le RCS, la TVA, le téléphone et le directeur de publication ressemblent à des valeurs d'exemple. Ils sont regroupés dans `lib/legal/entreprise.ts` : les vraies valeurs se renseignent là, une seule fois, pour les 10 langues.
- **L-2. La politique de confidentialité ne décrit pas les outils réels.** Elle cite Google Analytics, alors que le site utilise PostHog (mesure d'audience), Google Ads et le pixel Meta (conversions), Resend (e-mails), Stripe (paiement), un serveur OVH en Europe (base de données) et un assistant IA pour préparer les réponses du support. À mettre à jour avant de s'y fier.
- **L-3. CGV, article 9 bis :** « un minimum de 1 (dans la devise de la commande) » est obscur, et « ni remboursable » contredit le droit de rétractation de 14 jours accordé juste après. À clarifier en français, puis à reporter dans les 9 traductions.
- **L-4.** Les traductions juridiques ont été faites avec soin mais pas par un juriste. La version française fait foi, et c'est écrit en tête de chaque traduction.

**P1-14 Amazon Pay, à faire par toi dans Stripe :**
- Ouvre dashboard.stripe.com, puis Paramètres → Paiements → Moyens de paiement.
- Dans la liste, Amazon Pay → Désactiver.
- Fais-le en mode test et en mode live (interrupteur en haut à droite).

**Fait le 2 octobre 2026 :**
- **P0-3 Vitesse.**
  - Les pages de langue sont maintenant statiques : régénérées en arrière-plan au plus toutes les heures (fiches, collections, cadeau : 5 min, à cause des prix), puis servies par le CDN. Le build passe de 0 à 1 023 pages pré-générées.
  - Toutes les lectures en base des pages publiques passent par un cache partagé (`lib/lecturesCache.ts`), invalidé tout de suite quand un prix change ou qu'un avis est modéré.
  - Restructuration : `app/[locale]/layout.tsx` est devenue la mise en page racine. Les pages hors langue (succès, suivi, dépôt, bon, bonus, confirmation d'aperçu) sont passées dans `app/(hors-langue)/`, sans changement d'URL. La 404 des URL inconnues vit dans `app/global-not-found.tsx`.
  - **Mesuré en production après le déploiement (commit c86a9a1), sur les mêmes 185 pages que l'audit :**

    | Mesure | Avant | Après |
    |---|---|---|
    | LCP mobile médian | 2,46 s | 0,96 s |
    | Pages au-dessus de 2,5 s | 91 | 17 |
    | Pages au-dessus de 4 s | 65 | 13 |
    | Sauts de mise en page (CLS > 0,1) | 3 | 0 |
    | Pages étrangères contenant du français | 170 | 0 |

  - Le temps de réponse du serveur passe de 7–16 s (première visite) à 0,15–1 s. Les réponses sont servies depuis le cache (`X-Vercel-Cache: HIT`, `Cache-Control: public`).
  - Reste lente : la toute première visite d'une page qui n'a pas encore été générée, en particulier les articles de blog, créés à la demande (jusqu'à 18 s, une seule fois par article). Piste (S-8 ci-dessous) : pré-générer les 30 articles les plus récents au déploiement.
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

**S-8. Pré-générer les articles de blog récents.** 🤖 S
- Un article n'est généré qu'à sa première visite : jusqu'à 18 s pour ce premier visiteur, souvent Googlebot.
- **Correction :** `generateStaticParams` renvoie les 30 articles les plus récents de chaque langue.

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
