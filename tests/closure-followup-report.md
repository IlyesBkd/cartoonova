# Complément de clôture — local uniquement, 26 octobre 2026

## État et vérification

HEAD de départ `e613645a5a6a24a0a6114e097c6edbbbbe82e2e6`. Changements **non commités, non poussés, non publiés, revue indépendante parent attendue**. Aucune mutation Trello/Vercel, aucune migration production, aucun paiement réel, aucun message externe. La base locale `cartoonova` n’est jamais une fixture.

- Suite complète **réexécutée après R1/R2 : 477/477 tests, 57/57 fichiers**, aucun ignoré/annulé/échec ; `r1-all-tests-stable.tap`, `r1-verified-tests.json` et résumé `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/tap-qShCld/summary.json`. Inventaire courant = manifeste = fichiers exécutés uniques ; compteurs des 57 TAP bruts rapprochés et 1005 empreintes d’entrées code/config/tests inchangées pendant la vérification. Environnement minimal via `env -i ... npm test`, partitions et gardes réseau du runner existant. **Ancien 474/474 sur 57 fichiers conservé comme historique avant R1**, dans `all-tests-stable.tap` / `tap-n2FBLi`, pas annoncé comme la suite finale après ajout de trois tests.
- Lint réexécuté : **0 erreur, 28 avertissements**, `r1-lint-final.log`. Build isolé réel précédent : réussi (`final-build.log`, `final-build-http.json`), **réutilisé, pas relancé après R1/R2**. Comparaison de 738 entrées runtime/config/dépendances : seul nouveau écart = `lib/giftGuideMeasurement.ts`, module sans import dont les seuls appelants sont la CLI offline et son test ; les trois adaptateurs isolés préexistants restent les autres écarts. Aucun appelant applicatif/proxy ni changement de configuration/lock. Le fichier TS, inclus dans l’analyse de types Next même sans import applicatif, passe un contrôle strict no-emit ciblé (`r1-cli-types.log`) ; pas de script typecheck projet déclaré. Justification et empreintes : `r1-build-reuse.json`. Un premier rebuild historique avait échoué faute de clé Resend synthétique ; le rebuild réussi utilisait un marqueur local non secret et la capture mail, sans accès externe ajouté. Aucun nouveau build/HTTP ni paiement PSP n’est prétendu ici.
- Migration PostgreSQL jetable : **1/1**, application idempotente, abort transactionnel et down/up sans perte.
- Redirections HTTP du build final : **5/5** ; test unitaire avec et sans port, rouge puis vert.
- Scanner CI/repo : aucune anomalie ; contrôle exact de **55 valeurs privées** dans **9352 fichiers** du banc/rapports/build/captures, **aucune correspondance**. Aucun fichier d’environnement copié. Dix fichiers métier/CSP/éditorial comparés au dépôt : tous identiques. Aucun fichier compressé dans cet ensemble (`decompressedArchives=0`) : ne pas prétendre avoir décompressé une archive livrée inexistante.

Chemin des preuves ci-dessous : `$HERMES_HOME/cache/closure-followup/` dans le profil Cartoonova. Les chemins locaux ne sont pas des liens publics Trello. Le JSON `closure-evidence.json` est l’index machine ; `trello-update-payload.json` est préparé seulement, à rebaser sur la carte live avant tout futur PUT.

## SEO-06 — corps réels, pas uniquement métadonnées

Les quatre corps Markdown de production ont été extraits et lus intégralement. Leurs longueurs exactes dans `article-bodies.json` sont 9358, 10725, 10027 et 9885 caractères. Les deux paires partageaient une démarche de sélection généraliste ; changer seulement H1/introduction ne suffisait pas à faire livrer une différence utile.

`lib/articleBodies.ts`, utilisé par `lib/articleIntents.ts`, livre désormais quatre textes FR réellement différents, sans écriture CMS production :

| Slug | Intention et contenu effectivement livré |
|---|---|
| `idees-cadeaux-d-anniversaire-simples-originales-et-vraiment-marquantes` | Décider selon budget/délai, dépenses annexes, date disponible et solutions de repli ; sans promesse de livraison chiffrée. |
| `idees-de-cadeaux-d-anniversaire-pour-femme-et-homme` | Partir des goûts, passions et souvenirs du destinataire, sans stéréotype lié au sexe. |
| `cadeaux-photo-personnalises-comment-choisir-une-idee-vraiment-touchante` | Comparer tirage, support, fichier numérique et qualité/cadrage de la photo. |
| `cadeau-photo-personnalise-une-idee-vraiment-originale` | Transformer un souvenir en brief de portrait : sujet, références, personnes et choix de rendu. |

Liens complémentaires vers l’autre article de la paire ; pas de fusion ni redirection article sans preuve de concurrence. Pas d’avis, de prix, de délais garantis ou de performance inventés ; le test verrouille notamment l’absence des promesses commerciales de sa fixture. Les articles anglais restent inchangés.

Contrôle navigateur sur les 4 URL × 1440/390 px : **8 statuts 200**, H1 spécifiques, corps entre 3268 et 3687 caractères rendus, aucun débordement horizontal. Captures `cache/screenshots/closure-followup/article-{1..4}-{1440|390}.png`.

La revue indépendante `closure-followup-review.json` approuve les quatre corps éditoriaux ; cette approbation ne vaut pas autorisation propriétaire de publication. Limite R3 conservée : la bulle Aide mobile préexistante peut recouvrir ponctuellement quelques caractères sur les captures du premier écran. Celles-ci ne prouvent ni zéro chevauchement ni tout le contenu sous le pli ; aucune capture existante n’a été modifiée dans le suivi R1/R2.

GSC réellement authentifié, filtre exact des 4 URL : **aucune ligne de requête sur 28 ou 90 jours**. La requête séparée par page sur 90 jours révèle cependant **1 impression / 0 clic** pour le guide anniversaire général et **2 impressions / 1 clic** pour le comparatif photo ; aucune ligne pour les deux autres. L’absence de requêtes détaillées ne signifie donc pas zéro impression : seuils/confidentialité et agrégations diffèrent. Ce volume ne prouve ni cannibalisation ni effet du nouveau contenu. Inspection : trois articles « Envoyée et indexée » ; anniversaire femme/homme **« Google ne reconnaît pas cette URL »**, verdict NEUTRAL et pas de crawl renseigné. Le choix des rôles est une validation éditoriale locale, **pas une approbation propriétaire ni une validation statistique Google**. Restent décision propriétaire de publication et observation après publication autorisée.

## CODE-14 — vrais SDK Stripe test sous CSP bloquante

Deux parcours refus→carte valide dans la même caisse, desktop 1440 et mobile 390 : refus garde commande impayée ; reprise concurrente et rechargement aboutissent à une commande et une confirmation locale uniques. Relecture Stripe pour chaque cas : `succeeded`, `livemode=false`, **499 reçus sur 499 centimes**. Preuve `retry-regression-1793044623759.json`.

Second pilote navigateur réel, sans interception des réponses PSP :
- 3DS avec challenge visible et bouton officiel Complete ; relecture Stripe : `authentication_flow=challenge`, `result=authenticated`, `succeeded`, `livemode=false`, **499/499 centimes**, commande payée.
- Bon cadeau : vrai Payment Element, `succeeded`, `livemode=false`, **4000/4000 centimes**, un bon FR et un message capturé ; rechargement sans doublon.
- La première tentative 3DS a échoué sur le sélecteur/temps d’attente du pilote ; seconde tentative résolue en attendant le vrai frame et le bouton accessible. Ne pas présenter cet échec de banc comme un défaut de paiement de l’application.

Le header CSP enforcement est sauvegardé dans `sdk-browser.json`. Aucun blocage Stripe script/connect/frame provoqué par la CSP applicative dans les parcours réussis. **Deux violations image data:** appartiennent à la propre CSP du document challenge Stripe `img-src 'self'`, pas à celle du site (qui autorise data:), et n’ont pas empêché l’authentification. Les requêtes Google Pay/hCaptcha bloquées par l’allowlist du premier pilote sont des limites de banc, non des violations CSP.

Probe wallets séparée, avec script Google Pay et gstatic réellement autorisés : iframe Express Checkout Stripe affiche un **bouton Google Pay de test « Payer avec 0000 »** dans Chromium headless sans compte/device wallet enrôlé. Aucun paiement wallet exécuté. Cela ne prouve pas une carte personnelle enrôlée ni la disponibilité Safari/Apple Pay ; ne pas annoncer « wallets validés » ou « tous indisponibles ». Il manque un device/compte admissible réel pour ce critère. Aucune configuration Stripe/wallet/domaines modifiée.

Les quatre réussites PSP ci-dessus sont des objets Stripe test réels. Resend, stockage et effets marketing sont locaux/remplacés : leurs fournisseurs réels et la livraison client ne sont pas couverts. La matrice ne vaut pas tous produits/langues/devices. Les règles `unsafe-inline` des balises script restent une limite CSP documentée ; les protections existantes contre scripts externes/handlers non autorisés ne deviennent pas une preuve d’anti-XSS totale.

## FLOW-04 — migration et rollback

`tests/gift-language-migration.test.mjs` crée/arrête son propre cluster sur loopback, port différent de 5432. Une ancienne ligne garde montant/solde/utilisations et langue NULL ; double application, FR/EN, abort et rollback avec sauvegarde/restauration vérifiés. SQL actuel : text nullable sans CHECK ; aucune contrainte fictive ajoutée.

`tests/gift-language-migration-runbook.md` fournit identification explicite, transaction/lock_timeout, ordre migration avant code, readback et rollback recommandé conservant la colonne additive. Retrait éventuel uniquement sous maintenance/autorisation avec sauvegarde et restauration des langues. **Jamais appliqué en production** ; autorisation distincte toujours nécessaire.

## SEO-08 — données accessibles et limite restante

GSC de nouveau interrogé jusqu’au **2026-10-23**, fenêtres 28 et 90 jours pour les requêtes exactes des quatre articles. Les exports 90 jours globaux top pages et top requêtes ont réellement rendu **357 et 151 lignes**, limite demandée 25000 ; ce ne sont pas des totaux d’audience site (agrégations distinctes et requêtes anonymisées). Ne pas réutiliser les totaux du précédent lot comme s’ils provenaient de cette nouvelle collecte.

Sitemap www : dernière soumission et dernier téléchargement **2026-10-26**, **999 URL web soumises et 2200 images, 0 erreur/avertissement**. Trois anciennes entrées sitemap apex ont chacune une erreur : `/pages/html-sitemap.xml`, `/pages/html-sitemap`, et HTTP `/sitemap_index.xml` (cette dernière a aussi deux avertissements). Aucun retrait distant effectué. Le champ ancien `indexed:0` du Sitemaps API n’est PAS une mesure de couverture/indexation globale : l’inspection des URL donne des états individuels réels. Aucun accès simulé au rapport agrégé « Pages » de l’UI GSC.

Nouvelles tentatives gratuites : CrUX API sans clé **403** (`unregistered callers`), PSI API sans clé **429 quota**. UI publique PSI pour `/fr`, puis origine `/`, mobile : **Unable to resolve**. Dernier résultat conservé `pagespeed-browser-origin-final.json`. Aucun p75 mobile LCP/INP/CLS obtenu, aucune API activée/payante ni score labo substitué au terrain. Le blocage CWV reste réel et externe aux correctifs locaux.

## SEO-07 — diagnostic précis et correctif sûr

Lecture Vercel réelle : apex a redirect www/308 ; www ne redirige pas. Huit chaînes publiques documentées : HTTP apex 3 sauts, HTTPS apex 2, HTTP www 2, HTTPS www 1, sur racine et ancien chemin avec query.

Le test HTTP local a trouvé un défaut concret : affecter `URL.host` sans port conserve le port interne. `proxy.ts` retire maintenant explicitement ce port ; régression rouge/verte, build et cinq réponses HTTP finales vérifiés.

`tests/apex-redirect-change-plan.md` décrit la modification fournisseur **non appliquée**, schéma officiel API nullable, prérequis de publication du bon SHA, payload `redirect:null`, readback puis mesures et rollback vers redirect www/308. L’upgrade HTTPS Vercel peut conserver un saut : aucun gain public annoncé avant action autorisée et vérification distante.

## CRO-11 — mesure locale exploitable, pas gain supposé

`lib/giftGuideMeasurement.ts` et CLI `node scripts/measure-gift-guide.mjs <consented-joined-export.json>` mesurent uniquement un export déjà joint, consenti, par identifiants explicites. Sessions uniques/cohorte ; sessions avec achat payé distinctes (pas des clients uniques : aucun `customerId`) ; commandes distinctes. Refus des contradictions d’attribution ; pas de jointure email/IP/proximité temporelle, pas de clic CTA assimilé à un achat.

Après R1/R2 de `closure-followup-review.json`, la sortie JSON ajoute `cohorts` : une ligne pour **chaque cohorte consentie**, avec `sessions`, `paidSessions`, `paidOrders` et `conversion`, y compris zéro achat. Une session payée dans deux devises compte une seule fois dans cette conversion globale. Les sessions refusées/orphelines ne gonflent ni numérateur ni dénominateur ; les sessions et commandes répétées sont dédupliquées par leur identifiant.

`groups` conserve son contrat financier antérieur par cohorte/devise : revenu net/session, marge/session avec coûts réellement fournis, et conversion propre à cette devise. Son dénominateur reste **toutes les sessions consenties de la cohorte**, pas seulement celles acheteuses dans la devise. Ne pas sommer ces dénominateurs ou conversions entre devises : utiliser `cohorts` pour comparer les cohortes. Sans commande payée attribuée, `groups:[]` ne signifie pas absence de sessions : lire `cohorts`. Aucune ligne financière, devise ou coût n’est inventé pour une cohorte sans achat ; sans aucune session consentie, `cohorts:[]` aussi. La CLI sérialise déjà tout le résultat, sans filtrer les nouvelles lignes ; aucun changement de commande nécessaire.

Régressions R1 observées rouges puis vertes : témoin consenti sans achat et sessions non vides sans aucune commande (`r1-control-red.tap`, `r1-both-red.tap`, `r1-first-green.tap`). Ciblé final **7/7** (`r1-targeted-green.tap`) : déduplication, refus/impayés, consentement refusé, orphelins, coût inconnu, valeurs financières EUR/USD exactes et contrat CLI réel pour exports avec/sans commande. Les deux régressions et le test CLI ajoutent trois tests au précédent inventaire, pas de fichier supplémentaire. **Aucun nouvel événement live, aucun export client, aucune attribution causale ou marge réelle supposée.** Restent trafic consenti, rapprochement comptable réel, garde-fous erreurs/remboursements et comparaison cohorte/témoin ; la carte expérience ne devient pas clôturable par le seul calculateur.

## OPS-03 — garde automatique

CI lance désormais `node scripts/check-artifact-secrets.mjs` **avant npm ci**, avec test de régression. Réglage existant désactivant cache build Turbopack conservé ; aucun assouplissement pour Stripe. Le contrôle de valeurs privées exactes du banc reste nécessaire en plus du scan des fichiers suivis : la CI n’est pas une preuve magique de l’absence de tous secrets dans toute archive.

## Restes, sans ambiguïté

- Parent : revue indépendante de tous changements ; éventuelle correction locale avant commit.
- Autorisations distinctes : migration cible réelle, publication/push et réglage apex Vercel. Aucune demandée implicitement ni appliquée.
- SEO : approbation éditoriale, évolution GSC après publication, indexation article non indexé, p75 terrain indisponible et couverture globale non extraite.
- Paiement : wallet réellement enrôlé sur device admissible ; fournisseurs emails/stockage réels hors banc ; aucun paiement live nécessaire ni réalisé ici.
- CRO : expérience sur trafic réel consenti, coûts et remboursements réels avant toute conclusion de gain.
- Banc owned arrêté : ports PostgreSQL **38611**, application **41875** et TLS **38225** fermés ; répertoire et preuves conservés sans suppression irréversible. Site public FR relu en **200** après arrêt (`cleanup-final.json`).
- Aucune carte déplacée, clôturée ou écrite à distance par ce sous-agent.
