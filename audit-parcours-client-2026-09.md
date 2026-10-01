# Audit du parcours client + backlog — 30 septembre 2026

Périmètre : uniquement le site et le parcours client (pas d'acquisition).
Méthode :

- **Tests réels sur le site en ligne**, iPhone 13 émulé et ordinateur 1440 px, 17 pages ×
  2 formats, plus trois parcours d'achat complets jusqu'au formulaire de carte
  (numérique et poster). Aucun paiement lancé, mesure PostHog coupée pendant le test.
  Script rejouable : `node scripts/audit-parcours-live.mjs <dossier>`.
- **PostHog, 90 derniers jours** (projet Cartoonova 145750).
- **Base de données** (lecture seule) : commandes, avis, prix, retouches.
- **Lecture du code** de la fiche produit, de la caisse et de la page de succès.

---

## Suivi

| Date | Points | État |
|---|---|---|
| 1ᵉʳ octobre 2026 | B-1, B-2, B-5, B-6, C-2 (partiel) | Corrigés et vérifiés en local, **pas encore commités ni déployés** |
| 1ᵉʳ–2 octobre 2026 | A-2, A-4, B-9, F-1, F-2, F-3, F-4, F-9 (version 1), G-1, décision prix (option A), dates de Noël | Faits et vérifiés en local, **pas encore commités ni déployés**. Le bon cadeau exige d'appliquer `migrations/2026-10-bons-cadeaux.sql` sur le VPS **avant** le déploiement. |

| 2 octobre 2026 (5 agents en parallèle) | A-5, A-6, A-7, B-3, B-4, B-7, B-8, C-1, C-3/C-9, C-5, C-8, C-11, D-1, D-2, D-3, E-3, E-4, G-2 | Faits ; vérifiés en local sauf le paiement express à l'étape 1 (vrai téléphone nécessaire) et les envois réels d'e-mails. **Pas encore commités ni déployés.** Migrations à appliquer sur le VPS dans l'ordre : `2026-10-bons-cadeaux.sql`, `2026-10-paid-at.sql` (puis rejouer son `UPDATE` juste après le déploiement), `2026-10-relances.sql` ; réinstaller la crontab (`crontab vps/crontab`). |

### Ce qui a été fait le 1ᵉʳ–2 octobre (détail)

- **Dates de Noël** (`lib/evenements.ts`) : impression = 2 j de dessin + 1 j de validation + 7 j Gelato → **11 décembre** ; numérique → **22 décembre** ; après le 11, le bandeau parle du numérique jusqu'au 22. Les textes « 3 jours ouvrés » sont alignés sur « 3 à 7 » (messages, e-mails, FAQ cadeau, page de succès).
- **Prix de lancement** (`lib/lancement.ts`) : prix barré « −40 % » supprimé (A-2) ; bandeau « Prix de lancement jusqu'au 15 novembre, puis 19 € le portrait » sur la fiche et l'accueil, qui disparaît seul ; rappel dans l'admin à partir du 16 novembre. **La hausse elle-même reste à faire à la main dans l'admin le 16 novembre** (base 19, +7/personnage, toile +55), et le bloc « par personnage » de l'accueil devra être revu (il suppose base = personne supplémentaire).
- **Garantie** (A-4, F-9 version 1) : « Tu valides ton portrait avant qu'on l'imprime. Pas convaincu après les retouches ? Remboursé. » (imprimé) / « Retouches jusqu'à ce que tu l'adores. Pas convaincu ? Remboursé. » (numérique) ; « sans engagement » retiré ; CGV articles 6, 7, 9 et nouvel article 9 bis (bons cadeaux) ; faits de l'assistant IA alignés. **Reste A-3** : l'identité de la société dans les CGV et les mentions légales.
- **Cadeaux offerts** (F-3) : page `/bonus/[jeton]` (fond d'écran 1080×1920, avatar rond 1024×1024, carte A6 imprimable avec prénom et occasion), liée depuis l'e-mail d'image finale et la page de suivi ; ligne « Offerts » sur la fiche.
- **Options payantes** (F-1) : banderole +3 €, décor supplémentaire +5 €, express 24 h 7j/7 +7 € (grille par devise, éditable dans l'admin). Formule de prix unique partagée fiche/serveur. Express : badge admin, titre Discord, délai dans l'e-mail de confirmation, **envoi immédiat de l'image au dépôt**.
- **Case « Ajoute le poster 30×40 »** dans la caisse (F-2) : faite à la demande, **marge du poster toujours non chiffrée** (pas de `GELATO_API_KEY` en local).
- **Bon cadeau** (F-4) : page `/[langue]/bon-cadeau` (20/40/60 €, convertis par devise), code `CADEAU-XXXX-XXXX` à solde, utilisable en plusieurs fois, débité après paiement ; e-mail, version imprimable A5 `/bon/[jeton]`, branche dédiée dans le webhook et la page de succès.
- **Page Noël** (G-1) : `/[langue]/noel` avec les trois dates, le bon cadeau, les 6 univers vers leurs pages « × Noël », FAQ balisée ; dans le sitemap ; le bandeau du site y mène pendant la période de Noël.
- **Au passage** : l'événement « caisse ouverte » partait en rafale à chaque défilement (236 fois pour une personne le 13 juillet) — corrigé ; le pays « MY » a un nom dans les 10 langues (B-9).

---

## Ce que disent les chiffres

### L'entonnoir réel, 90 jours, personnes uniques

| Étape | Mobile | Ordinateur |
|---|---|---|
| Visiteurs | 171 | 114 |
| Ont vu une fiche produit | 133 | 38 |
| Ont touché une option | 73 | 18 |
| Ont envoyé une photo | 35 | 3 |
| Ont cliqué « Commander » | 15 | 2 |
| Ont validé leur e-mail dans la caisse | 9 | 1 |
| Ont lancé le paiement | 6 | 0 |

- **Toutes les ventes viennent du mobile.** iPhone/Safari est le premier segment (177 sessions).
- **La fuite principale est la fiche produit** : 133 personnes la voient, 15 cliquent sur
  « Commander » (11 %). Une fois dans la caisse, le taux est correct (6 sur 17).
- **Deuxième fuite : l'étape e-mail de la caisse** — 17 ouvrent la caisse, 9 seulement
  valident leur e-mail. Et aujourd'hui rien ne rattrape ces 8 personnes (voir B-4).
- **La vitesse n'est pas le problème** : mesures de vrais visiteurs, LCP p75 = 1,7 s sur
  mobile, CLS ≈ 0. On peut la sortir des priorités.
- **Les données sont polluées** : 131 sessions « Chrome / Linux / États-Unis » sans
  aucune interaction (des robots), 480 événements venus de `localhost`, et tes propres
  visites de l'admin. Environ 1 session sur 4 n'est pas un client.

### Ce qui s'est vendu depuis juillet

7 commandes payées : 10 €, 15 € (numérique), 39 €, 43 €, 61 £, 73 $, 79 € (imprimées).
**Zéro avis en base.** 3 inscrits à la newsletter. 0 code promo existant.

### Les pages d'entrée

`/en` (81 sessions), `/fr/carte-pokemon-personnalisee` (64, **beaucoup venant de ChatGPT**),
`/sv/simpson` (59), `/fr` (36). La carte Pokémon est de fait ta page n°1.

---

## Priorité 0 — La confiance et la conformité, avant toute chose

Ces points passent avant le reste : si le site reçoit plus de trafic grâce au SEO, c'est
eux qui feront le plus de dégâts.

**A-1. Retirer les chiffres inventés.** — Effort S
Le site affiche « 2 540 avis vérifiés », « 85 000+ portraits livrés », « 4,9/5 »,
« (1125 avis) » par univers, et des avis signés « Sophie M. — Achat vérifié » qui sortent
des fichiers de traduction. La base contient 0 avis et une douzaine de commandes.
- En France, c'est une pratique commerciale trompeuse (Code de la consommation, L121-2 et
  L121-4 : faux avis, avis présentés comme vérifiés sans contrôle). Les amendes vont jusqu'à
  300 000 €.
- Google Merchant Center suspend les marchands pour « déclarations trompeuses », ce qui
  couperait ton flux produit, le canal que tu es en train de construire.
- Un visiteur qui cherche « Cartoonova avis » ne trouve rien. L'écart entre « 85 000
  portraits » et zéro trace en ligne est exactement ce qui fait fuir.
- Emplacements : `FicheProduit.tsx:517-519`, `components/pages/Accueil.tsx:420`,
  `app/[locale]/avis/AvisClient.tsx:53-74`, `a-propos/AProposClient.tsx:72,88`,
  `messages/*.json` (`review1Name`… `temoinsTexte`, `preuveNombre`).
- À mettre à la place : des preuves vraies (voir C-6, C-7, E-1). Une petite marque honnête
  (« un illustrateur, tes photos, des retouches jusqu'à ce que tu adores ») convertit mieux
  qu'une fausse grosse marque qu'on démasque en 10 secondes.

**A-2. Retirer le prix barré permanent « −40 % ».** — Effort S
`FicheProduit.tsx:36` calcule toujours un prix barré = prix ÷ 0,6 et affiche « Tu économises
3 € ». Une réduction doit se référer au prix le plus bas des 30 jours précédents (directive
Omnibus). Un prix barré qui n'a jamais été le prix est interdit, et « 8 € barré » sur un
produit à 5 € n'apporte rien.

**A-3. Vérifier les mentions légales.** — Effort S
`mentions-legales/page.tsx:23-25` : SIRET `912 345 678 00014`, 42 rue du Faubourg
Saint-Honoré. `912 345 678` a tout d'un numéro fictif. Si c'est un texte de remplissage, le
remplacer par tes vraies informations : c'est une obligation légale (LCEN), et c'est la
première chose qu'un client méfiant vérifie sur societe.com.

**A-4. Mettre d'accord « Satisfait ou remboursé » et les CGV.** — Effort S
Le site promet « Satisfait ou remboursé » (accueil, fiche, garantie) et « aperçu sous
2 jours, sans engagement ». Les CGV (article 8) disent l'inverse : pas de rétractation, et
remboursement seulement si le produit est défectueux. « Sans engagement » laisse croire
qu'on paie après l'aperçu, alors qu'on paie avant.
Choisis une vraie garantie et écris-la partout pareil. Proposition : « Retouches illimitées
jusqu'à ce que tu adores. Si on n'y arrive pas, on te rembourse avant l'impression. »

**A-5. Le formulaire de contact n'envoie toujours rien.** — Effort S
`ContactClient.tsx:57` : `livre: false`. Un visiteur qui écrit croit avoir écrit. (Déjà
signalé le 18 septembre, toujours ouvert.)

**A-6. Une demande de retouche est restée sans réponse.** — Effort S
Table `retouches`, commande `efeebfa9`, 12 septembre : « Ho già fatto una richiesta ma non
ho avuto nessuna risposta » (« j'ai déjà fait une demande et je n'ai eu aucune réponse »).
- Accusé de réception automatique à chaque demande de retouche (« reçu, réponse sous 24 h »).
- Alerte Discord à chaque demande.
- Retouche sans réponse depuis 24 h = alerte rouge.

**A-7. La relance « photos manquantes » s'arrête dès que tu touches la commande.** — Effort M
`lib/db.ts:187` filtre toujours `status = 'PAID'`, alors que l'admin remplace ce statut par
`in_progress` ou `completed`. Un client qui a payé sans photo n'est plus relancé. C'est le
P0-1 du backlog du 18 septembre, toujours ouvert — et c'est désormais un vrai trou du
parcours, puisque la caisse accepte de payer sans photo.

---

## Priorité 1 — Les obstacles vus pendant les tests

**B-1. La bulle « Live Chat » recouvre le bouton « Commander » sur mobile.** — Effort S
✅ **Corrigé le 1ᵉʳ octobre.** Sous 620 px, le lanceur devient une pastille ronde de 52 px
(`app/toonjaune-app.css`), qui tient dans la place que la barre d'achat lui réservait déjà.
Vu sur les captures : elle cache la moitié du bouton principal de la fiche, le bouton de la
barre collante, et le bouton « Créer mon portrait » de l'accueil. Sur ordinateur, elle
empiète aussi sur le bouton de la barre collante.
Solution : sur mobile, la réduire à une icône ronde de 48 px, la remonter au-dessus de la
barre d'achat, et la masquer quand un bouton d'achat est à l'écran.

**B-2. La pop-in « Vous partez déjà ? » coupe l'achat.** — Effort S
✅ **Corrigé le 1ᵉʳ octobre.** Retirée des fiches produit, gardée sur les articles de blog
(`components/LayoutShell.tsx`).
Elle se déclenche sur mobile dès qu'on remonte de 120 px (`ExitIntentDialog.tsx:71`). Sur une
fiche produit, on remonte sans arrêt entre la galerie et les options. Pendant mon test sur
ordinateur, elle s'est ouverte au moment précis du clic sur « Commander » et l'a bloqué.
Bilan sur 90 jours : 67 affichages, **0 inscription**.
→ La retirer des fiches produit (ou complètement). Elle ne rapporte rien et gêne au pire
moment.

**B-3. Le dépôt de photo parle à un ordinateur.** — Effort S
« Glisse tes photos ici ou bien parcourir » : on ne glisse rien sur un téléphone, et
« parcourir » est du vocabulaire d'ordinateur. PostHog relève 13 personnes qui ont tapé sur
« parcourir » ou sur le champ sans effet mesurable. Une partie peut venir de l'outil (le
sélecteur de fichiers s'ouvre hors de la page), donc à vérifier sur un vrai iPhone.
Dans tous les cas : un gros bouton « 📷 Ajouter une photo », une barre de progression par
photo, l'acceptation des photos HEIC de l'iPhone, et trois exemples « bonne photo /
mauvaise photo ».

**B-4. Les e-mails saisis dans la caisse sont perdus.** — Effort M
La commande n'est créée qu'au moment du paiement. Résultat en base : 0 relance de panier
abandonné envoyée, 0 commande en attente depuis juin. Les 8 personnes qui ont donné leur
e-mail puis sont parties ne recevront jamais rien.
→ Enregistrer l'e-mail dès « Continuer vers le paiement », avec une ligne d'information,
puis une seule relance à J+1 (« ton portrait t'attend, ta configuration est gardée »). À
0–2 commandes par mois, c'est le seul filet de rattrapage possible.

**B-5. La page de succès n'est traduite dans aucune langue.** — Effort M
✅ **Corrigé le 1ᵉʳ octobre.** Traduite en 10 langues (`successPage` dans
`lib/email-i18n.ts`). La langue vient de `?lang=` (posé par la caisse), puis du cookie de
langue, du pays détecté et enfin du pays de la commande. Textes à 12 px minimum, liens
corrigés vers `/<langue>/portfolio` et `/<langue>`. Reste : le thème visuel de l'ancien site,
et un `<html>` imbriqué dans `app/success/layout.tsx` (erreur d'hydratation qui existait déjà).
`app/success/SuccessClient.tsx` est en français codé en dur, alors que la moitié des clients
récents sont italiens, anglais ou américains. Elle porte encore l'ancien thème (jaune
Tailwind, textes de 10 px), et le bouton « Portfolio » mène à `/collections` sans la langue.

**B-6. Un client qui paie par PayPal ou Revolut peut voir « Paiement non finalisé ».** — Effort S
✅ **Corrigé le 1ᵉʳ octobre.** `processing` affiche « paiement en cours de confirmation »
et la page se relance seule (4 s × 15). Un paiement refusé ou annulé affiche « aucun montant
débité ». Les pages d'erreur brutes sont remplacées par des cartes traduites. Vérifié avec
un vrai paiement SEPA de test qui est passé de `processing` à `succeeded`.
`app/success/page.tsx:40` traite tout statut autre que `succeeded` comme un échec, et
affiche une page d'erreur brute en police machine (« Statut Stripe : processing »). PayPal et
Revolut Pay sont activés (vus dans la caisse), et ces moyens passent souvent par
`processing` avant d'aboutir. Le client a payé, et on lui dit le contraire.
→ Traiter `processing` comme « paiement en cours de confirmation, tu recevras un e-mail »,
et habiller les quatre pages d'erreur.

**B-7. Après paiement sans photo, rien n'invite à envoyer la photo.** — Effort S
La page de succès propose « Suivre ma commande », « Portfolio », « Accueil ». Si la commande
n'a pas de photo, le premier bouton doit être « Envoie tes photos maintenant » (le lien de
dépôt existe déjà).

**B-8. Page 404 par défaut, en anglais, sans aucun lien.** — Effort S
« 404 — This page could not be found. » sur fond blanc. À remplacer par une page traduite
avec la recherche d'univers et les best-sellers.

**B-9. Le pays « MY » (Malaisie) n'a de nom dans aucune des 10 langues.** — Effort S
Erreur `MISSING_MESSAGE: checkout.countries.MY` à chaque ouverture de la caisse imprimée, et
un libellé brut dans la liste des pays.

**B-10. Choisir entre « tu » et « vous ».** — Effort S
Sur la même fiche : « Transforme ta photo », « Recevez-le en 2 jours », « Vous pourrez les
envoyer », « Tu économises ». Le « tu » colle à la marque, il suffit de le généraliser.

**B-11. Appeler l'assistant par ce qu'il est.** — Effort S
« Live Chat » (en anglais sur le site français) est un assistant IA. « Une question ? » ou
« Aide » est plus juste, et évite la déception de qui attend un humain.

---

## Priorité 1 — La fiche produit (la fuite n°1 : 11 % de clics sur « Commander »)

**C-1. Montrer la transformation dès le premier écran, sur les 35 fiches.** — Effort M
Le produit, c'est « ma photo devient un dessin ». La fiche Pokémon ouvre sur un avant/après
(photo du couple → carte), et c'est la plus visitée. La fiche Simpson ouvre sur un dessin
seul, sans la photo d'origine. Faire de l'avant/après le premier visuel partout.

**C-2. Pokémon : ajouter les champs que la page promet.** — Effort M
✅ **En partie corrigé le 1ᵉʳ octobre.** Étape « Ta carte » (nom, 2 attaques, PV), tous
facultatifs. Le texte part dans la note de commande, donc il apparaît déjà dans l'admin, sur
Discord, dans les e-mails et le récapitulatif de la caisse. **Reste ouvert** : l'aperçu du
texte sur l'image de la carte, et l'affiche Wanted de One Piece (le champ
`champsPersonnalises` de `lib/catalogue.ts` est prévu pour).
La vignette du catalogue dit « choisis ton nom, tes attaques », mais le configurateur ne
propose que personnages / animaux / cadrage / décor. Tout passe par la note libre (où
PostHog relève 10 clics sans saisie). Ajouter des champs dédiés : nom sur la carte, PV,
deux attaques, type d'énergie, date, avec l'aperçu du texte sur la carte. Même logique pour
l'affiche Wanted One Piece (nom, prime).

**C-3. Le bouton « Commander » est à 4,5 écrans du haut sur mobile.** — Effort M
Il est à 2 976 px, pour un écran de 664 px, après 7 étapes. Pistes :
- afficher la barre d'achat collante (prix + Commander) dès qu'on entre dans le
  configurateur, et pas seulement une fois le bouton dépassé ;
- regrouper « personnages » et « animaux » en une seule étape ;
- replier « Précisions pour ton portrait » (facultatif) derrière un lien.

**C-4. Des visuels de support qui montrent la différence.** — Effort S
« Digital » et « Portrait sur toile » utilisent la même image : on ne voit pas ce qu'on
achète en plus pour 39 €. Une photo de toile au mur, un cadre chêne en situation.

**C-5. Une date au lieu d'un délai.** — Effort S
Remplacer « Recevez-le en 2 jours » par une date calculée : « Commande aujourd'hui →
aperçu jeudi 2 octobre, poster chez toi avant le mercredi 8 ». Pour un cadeau, c'est la
question qu'on se pose.

**C-6. Montrer qui dessine.** — Effort M
Une photo, un prénom, une vidéo accélérée d'un dessin en train de se faire. C'est la preuve
qui remplace les faux chiffres, et elle te distingue des générateurs IA.

**C-7. De vraies réactions.** — Effort M
Demander aux 7 clients récents une photo de leur portrait chez eux, ou une vidéo de la
personne qui le reçoit. Une seule vraie vidéo de réaction vaut mieux que quatre « Sophie M. ».

**C-8. Trois questions juste sous le bouton.** — Effort S
« Et si ça ne ressemble pas ? », « Combien de photos envoyer ? », « Je peux payer et
envoyer les photos plus tard ? ». Aujourd'hui la FAQ est 5 000 px plus bas.

**C-9. Raccourcir la page mobile (17,6 écrans).** — Effort M
Les blocs « Comparatif » et « Atouts » sont identiques sur les 35 fiches. Les garder sur
l'accueil, et ne laisser sur la fiche que ce qui aide à décider.

**C-10. Accueil mobile : le premier écran n'a aucune image.** — Effort S
Le titre, le prix et le bouton occupent l'écran ; le premier dessin apparaît au 2ᵉ écran.
Mettre une vignette avant/après dans le premier écran.

**C-11. Page « Idées cadeaux » : une liste de textes.** — Effort M
Cinq cartes blanches sans image ni prix. C'est pourtant la page qui porte le positionnement
cadeau. La refaire avec des visuels, un prix « à partir de », et la date limite.

**C-12. Portfolio : seulement du Simpson, sans photos d'origine.** — Effort M
Le portfolio montre uniquement des portraits Simpson, sans la photo de départ et sans lien
pour commander le même style. Galerie avant/après filtrable par univers, avec un bouton
« Je veux le même » sur chaque dessin.

---

## Priorité 1 — La caisse

**D-1. Le champ « code promo » ouvert invite à partir chercher un code.** — Effort S
Il n'existe **aucun** code en base. Un champ visible sans code à trouver est une fuite pure.
Le replier derrière « J'ai un code ».

**D-2. Apple Pay avant l'e-mail.** — Effort M
Le paiement express n'apparaît qu'à l'étape 2 (`CheckoutModal.tsx:299`). Sur iPhone, ton
premier segment, Apple Pay fournit e-mail, nom et adresse d'un geste. À placer en haut de
l'étape 1. Vérifier aussi que le domaine est validé pour Apple Pay dans Stripe : mon test
(Chrome sans portefeuille) ne pouvait pas l'afficher.

**D-3. Ouvrir la carte bancaire par défaut à l'étape 2.** — Effort S
Il faut d'abord taper sur « Carte bancaire » pour voir les champs, alors que le bouton
« Payer maintenant » est déjà là. Un geste de moins.

**D-4. Saisie d'adresse assistée pour les impressions.** — Effort M
11 champs pour un poster. L'`AddressElement` de Stripe remplit l'adresse en 3 frappes.

**D-5. Retirer le journal de l'e-mail client dans la console.** — Effort S
`CheckoutModal.tsx:88-102` écrit le secret de paiement et l'e-mail du client dans la console
du navigateur à chaque passage en caisse.

---

## Priorité 2 — Après l'achat (avis, fidélité)

**E-1. Obtenir les premiers vrais avis.** — Effort S
3 demandes envoyées, 0 avis. Écris toi-même aux 7 clients de juillet à septembre, un par un.
Puis placer la demande au moment où le client est content : dans l'e-mail qui livre le
dessin final, avec des étoiles cliquables directement dans l'e-mail. Un bonus pour un avis
est permis, à condition de le dire.

**E-2. Page de suivi : ajouter la prochaine action.** — Effort S
Selon l'étape : « envoie tes photos », « valide ton aperçu », « laisse un avis ».

**E-3. Proposer l'impression aux clients du numérique.** — Effort S
Les commandes numériques rapportent 10 à 15 €, contre 39 à 79 € pour les impressions.
Quand le fichier est livré : « Ton portrait
en poster 30×40 pour 19 €, chez toi en 3 jours ». Le dessin existe déjà, c'est de la marge
pure. (La colonne `reorder_email_sent_at` existe ; vérifier que cet e-mail part vraiment.)

**E-4. Parrainage simple.** — Effort M
« Offre −5 € à un ami, reçois −5 € » : le cadeau est vu par toute la famille, c'est le
moment où il circule.

---

## Nouveaux produits, options et petits cadeaux

Classés du moins cher au plus cher à mettre en place.

**Correction du 1ᵉʳ octobre.** J'avais écrit que tout ce qui passe par Gelato était
« presque de la marge pure ». C'est faux à cause du port, payé à chaque colis. Le relevé
de `scripts/tarifs-gelato.mts` : une toile 30×40 livrée en France coûte 23,49 € de
production + 17,69 € de port = 41,18 €. Elle est vendue 44 € (5 € de dessin + 39 € de
support), il reste donc environ 2 € après les frais Stripe. Ce qui est vraiment de la marge
pure, ce sont les **bonus numériques** (F-1, F-3) et le **bon cadeau** (F-4). Les objets
Gelato ne sont rentables que si leur prix couvre le port. Avant de lancer un objet,
chiffrer son coût réel avec `GELATO_API_KEY=… npx tsx scripts/tarifs-gelato.mts --explore`.

**F-1. Options à forte marge dans le configurateur.** — Effort S
- **Texte ou banderole personnalisée** (« Joyeux anniversaire Mitchell » — ton visuel
  principal en a une) : +3 €.
- **Décor supplémentaire** (mêmes personnages, deuxième fond) : +5 €, presque sans travail.
- **Express 24 h** : +7 €, pour les cadeaux de dernière minute.

**F-2. Une case « ajoute l'impression » dans la caisse.** — Effort S
Pour qui a choisi le numérique : « Ajoute le poster 30×40 : +19 € ». Un clic, sans revenir
à la fiche.

**F-3. Petits cadeaux offerts à chaque commande.** — Effort S
Tu parlais d'échantillons gratuits. Ce qui ne coûte rien une fois le dessin fait :
- fond d'écran téléphone recadré sur le portrait ;
- avatar rond pour les réseaux sociaux ;
- **carte cadeau imprimable** en PDF avec le portrait, à glisser dans une enveloppe le jour J.
Affiché « Offert » sur la fiche, ça augmente la valeur perçue sans toucher au prix.

**F-4. Le bon cadeau.** — Effort M
Pour qui veut offrir sans avoir la photo, ou garder la surprise : un bon d'un montant choisi,
en PDF imprimable, que le destinataire utilise avec ses propres photos. C'est le produit
logique d'une marque « cadeau », et il se vend jusqu'au 24 décembre au soir.

**F-5. Le portrait sur d'autres objets.** — Effort M
Mug, t-shirt, coque de téléphone, puzzle, via Gelato. D'abord en proposition après livraison
(« ton portrait sur un mug »), puis dans le configurateur si ça prend.

**F-6. Cartes de vœux de Noël personnalisées.** — Effort M
La famille dessinée sur une carte, par lots de 10 ou 20 imprimées. Produit de saison,
panier plus élevé.

**F-7. Calendrier 2027.** — Effort M
Le même portrait sur 12 décors. Vendu en octobre–décembre.

**F-8. La vraie carte Pokémon, au format carte.** — Effort L
Ta page la plus visitée vend un poster ; les gens imaginent une carte (63 × 88 mm,
brillante, éventuellement holographique). Nécessite un fournisseur autre que Gelato.

**F-9. Un aperçu gratuit avant de payer.** — Effort L, **décision de fond**
Dans cette catégorie, c'est le levier de conversion le plus fort (« vois ton portrait avant
de payer »). Deux versions :
- une esquisse faite à la main : coûteuse en temps, difficile à 5 € le personnage ;
- un aperçu instantané généré par IA, avec filigrane : très efficace, mais contredit le
  « dessiné à la main » et pose la question de ce que le client achète ensuite.
À trancher toi-même : c'est une question de positionnement, pas de code.

---

## Nouvelles pages

**G-1. Page Noël** : dates limites (numérique, poster, toile), bon cadeau, cartes de vœux,
compte à rebours. À publier **avant le 1ᵉʳ novembre**, le temps que Google l'indexe.
**G-2. « Quelle photo envoyer ? »** : exemples bonnes et mauvaises photos. Rassure avant
l'achat et réduit les retouches après.
**G-3. « Qui dessine ton portrait »** : l'illustrateur, le processus, une vidéo accélérée.
**G-4. Galerie avant/après** par univers (remplace le portfolio actuel, voir C-12).
**G-5. Page « Garantie »** d'une seule phrase claire, liée partout où elle est promise (A-4).
**G-6. Page 404 traduite** (B-8).

---

## Mesure — le minimum utile à ce volume

**H-1. Nettoyer PostHog** : exclure les robots (Chrome/Linux sans interaction), `localhost`,
et tes propres visites (admin, IP). Aujourd'hui environ 1 session sur 4 n'est pas un client,
et tous les taux sont faussés.
**H-2. Regarder les enregistrements des 17 personnes qui ont ouvert la caisse.** Une heure
de visionnage vaut mieux que n'importe quel tableau à ce volume : on voit où elles hésitent.
**H-3. Rejouer `scripts/audit-parcours-live.mjs` après chaque lot de changements**, pour
vérifier qu'aucune fenêtre ne recouvre plus le bouton d'achat.

---

## Une décision à prendre : le prix

Le portrait numérique est à **5 € par personnage** (réglé dans l'admin, table `prices` ;
`data/prices.json` dit encore 49 €). C'est affiché comme argument sur l'accueil.

- Pour un dessin « fait à la main », avec aperçu sous 2 jours et retouches illimitées, 5 €
  est très en dessous du marché. Un prix aussi bas fait penser à de l'IA ou à du travail
  bâclé, et rend chaque retouche déficitaire.
- Les commandes numériques rapportent 10 à 15 € ; les commandes imprimées, 39 à 79 €.
- À ton volume, aucun test A/B ne pourra trancher. C'est une décision, pas une mesure.

Si le prix bas est un choix pour obtenir les premiers clients et les premiers avis, il faut
le dire (« prix de lancement ») avec une date de fin, ce qui règle aussi le problème du prix
barré (A-2). Sinon, un numérique autour de 19–29 € avec +10 € par personnage est plus cohérent
avec la promesse.

---

## Ce que je ne recommande pas

- **Refaire le design** : il est cohérent et agréable ; les problèmes sont ponctuels.
- **Travailler la vitesse** : les vrais visiteurs ont un LCP de 1,7 s.
- **Des tests A/B** : 15 clics « Commander » en 90 jours, aucun test n'aboutira.
- **Ajouter d'autres univers** : 35 fiches, c'est déjà plus que ce que le trafic explore.

---

## Ordre proposé, avec Noël en ligne de mire

Pour un produit cadeau, **le dernier trimestre fait souvent l'essentiel de l'année**. Tout ce
qui suit devrait être en ligne vers le 10 novembre.

1. **Semaine 1 — confiance** : A-1 à A-6. Surtout du texte, peu de code.
2. **Semaine 1 — obstacles** : B-1 (bulle), B-2 (pop-in), B-6 (PayPal), B-9, D-1, D-5.
3. **Semaine 2** : B-3 (dépôt photo), B-4 (relance caisse), B-5 et B-7 (page de succès),
   A-7 (relance photos), B-8.
4. **Semaine 3** : C-1, C-2 (Pokémon), C-3, C-5, D-2, D-3.
5. **Semaine 4** : F-1, F-2, F-3, E-1, E-3, G-1 (page Noël), F-4 (bon cadeau).
6. **Ensuite** : C-6/C-7 (preuves réelles), F-5 à F-7, puis la décision F-9 et la décision
   sur le prix.
