# Notes manuelles — actions que je ne peux pas faire à ta place

Ce fichier liste toutes les actions du backlog qui nécessitent une décision, un compte, une clé API, ou un accès dont je ne dispose pas. Je le complète au fur et à mesure que j'avance dans le backlog.

> **Les sections datées d'avant le 2026-08-22 sont partiellement obsolètes.** La section « Automatisation des canaux » ci-dessous fait foi : elle décrit ce qui reste manuel après le passage du 2026-08-22.

---

## 📈 Mesure d'audience (PostHog) — état au 2026-08-23

Le tracking a été repris de fond en comble : 15 événements émis → 38, dont 4 côté serveur. Rapport
d'audit complet séparé. Rien ne bloque le déploiement ; ce qui suit est ce que je ne peux pas faire
à ta place.

- [ ] **Vérifier l'ingestion après déploiement.** Les événements passent maintenant par
  `www.cartoonova.com/ingest/…` au lieu de `eu.i.posthog.com`, qui est dans EasyPrivacy et donc
  bloqué par défaut chez uBlock Origin et Brave. Ouvre le site en production **avec uBlock actif**
  et vérifie dans l'onglet réseau que les appels `/ingest/` répondent en 200. Testé en local, mais
  seule la production prouve que la faille est fermée.
- [ ] **Pare-feu PostHog.** Si la liste des domaines autorisés du projet est renseignée, y ajouter
  `www.cartoonova.com` — sinon l'ingestion proxifiée sera refusée.
- [ ] **Décider du bandeau de consentement.** Il est écrit, traduit en 10 langues, et **éteint** :
  il ne s'affiche que si tu poses `NEXT_PUBLIC_CONSENT_BANNER=1` dans Vercel. Le site est donc
  strictement inchangé tant que tu ne la poses pas. Deux choses à savoir :
  - Ta politique de confidentialité promet déjà « notre bandeau de consentement » (qui n'existe
    pas) et cite Google Analytics (qui n'est pas installé). Ces deux phrases sont à corriger quoi
    qu'il arrive.
  - Un refus n'éteint pas la mesure : il bascule en mode sans cookie, donc tu gardes le volume de
    trafic. Mais ce mode **doit aussi être activé dans les réglages du projet PostHog**, sinon ces
    événements sont ignorés silencieusement à l'arrivée. Inutile d'y toucher tant que le bandeau
    est éteint.
- [ ] **Construire les deux entonnoirs.** `product_viewed → checkout_started →
  checkout_info_completed → purchase_completed` segmenté par `locale` répond à la question de la
  campagne UK/Canada. `photo_upload_started → photo_uploaded` donne le taux de perte de l'étape
  obligatoire. Ni l'un ni l'autre n'était calculable avant.
- [ ] **Trancher sur le webhook Stripe.** Voir la section « Paiement » plus bas : c'est le seul
  point où de l'argent encaissé peut ne jamais donner lieu à une livraison. Hors périmètre de ce
  travail, dis-moi si je m'en occupe.

Ce qui n'est **plus** manuel ou cassé, sans action de ta part : le chiffre d'affaires est mesuré
côté serveur (donc plus perdu quand l'onglet se ferme), les profils personne existent enfin
(`identify()` n'était appelé nulle part, donc `person_profiles: "identified_only"` n'en créait
aucun), les montants sont convertis en euros avant sommation (neuf devises étaient additionnées
telles quelles), et langue/devise/pays accompagnent tous les événements. Le catalogue des
événements vit dans `lib/evenementsMesure.ts` : `mesure()` n'accepte que ces noms-là.

Constats d'audit **non corrigés**, hors mesure : le formulaire de contact n'envoie toujours rien ;
44 `console.log` subsistent en production, dont plusieurs journalisent des adresses e-mail clients
(`CheckoutModal.tsx`, `success/page.tsx`) ; `proxy.ts` journalise chaque requête.

---

## 🔁 Automatisation des canaux — état au 2026-08-22

Ce qui reste à faire de ton côté, par ordre de blocage :

- [ ] **Deux secrets GitHub** (Settings → Secrets and variables → Actions) pour le moteur de contenu. Le workflow `.github/workflows/contenu.yml` tourne toutes les trois heures et reste inerte sans eux. `DATABASE_URL` est déjà en place.
  - `AI_API_KEY` : une clé `OPENAI_API_KEY` **existe déjà dans ton Vercel** (elle sert à la classification du support). La recopier ici suffit, inutile d'en créer une. Je n'ai pas pu la lire moi-même : le déchiffrement d'un secret Vercel est refusé par la politique de sécurité de mon environnement, même avec ton autorisation explicite.
  - `SERPAPI_API_KEY` : aucune valeur n'existe nulle part, il faut ouvrir un compte. La découverte tourne sur 10 marchés, plafonnée à 2 amorces par langue hors français, mise en cache 24 h → environ **30 recherches par jour** (≈900/mois). À confronter au palier que tu choisis ; le plafond se baisse dans `config/project.json` (`sources.maxSeedsPerLocale`).
- [ ] **Vérifier les prix en francs suisses.** Aucun jeu de prix n'existe en base pour le CHF : les montants sont convertis depuis l'euro au taux fixe de `lib/currency.ts` (0,94), soit 15 CHF pour un portrait à 15 €. Si tu veux des prix suisses décidés plutôt que calculés, ils se saisissent dans l'administration, onglet « Gestion des Prix ». Même remarque pour toutes les devises hors euro : la table de taux est saisie à la main et dérivera.
- [ ] **Suisse alémanique, si tu la veux.** La source suisse sert le catalogue en français. Le suisse allemand est la première langue du pays ; une seconde source `de` ciblant `CH` la couvrirait. Dis-moi si tu la veux, c'est cinq minutes.
- [ ] **Compte Pinterest business** + revendication du domaine, puis branchement du catalogue sur `/api/feed/pinterest/{langue}`.
- [ ] **Comptes sociaux** (`NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_TIKTOK_URL`) — inchangé.

Fait le 2026-08-22, sans action de ta part : commits poussés et déployés, les trois variables `GSC_*` ajoutées dans Vercel (production), le secret GitHub `DATABASE_URL` créé, et les 794 URL du site soumises à IndexNow.

**Le franc suisse est en service.** `CH` et `LI` basculent sur le CHF, la Suisse est sortie de la source française (qui ne cible plus que `BE, FR`) et dispose de sa propre source alimentée par `/api/feed/google/fr?currency=CHF`. Le pays de livraison déclaré dans le flux suit désormais la devise et non la langue — il annonçait la France sur le flux suisse, ce qui laissait la Suisse sans livraison déclarée.

**Merchant Center est branché.** Le projet Cloud `613195191815` est enregistré auprès du compte `5625945937` (par API, au nom de `info.cartoonova@gmail.com` — Google refuse cet enregistrement à un compte de service). Les 5 langues manquantes (nl, pl, sv, da, pt) ont leur source de données, soit **10 sources pour 350 fiches**, toutes tirées de `/api/feed/google/{langue}` une fois par jour. La vigie quotidienne lit désormais les problèmes de compte et le taux de refus, et alerte sur Discord au-delà de 10 %.

Ce qui n'est **plus** manuel :

- Les avis clients ne passent plus par `messages/*.json`. L'e-mail envoyé 10 jours après la livraison pointe vers un formulaire dont le lien prouve l'achat ; l'avis est publié directement, et `aggregateRating` s'active seul à partir de 3 avis. Un onglet « Avis » de l'administration reste disponible pour les dépôts sans preuve d'achat.
- Le sitemap se régénère toutes les heures au lieu d'être figé au build, et est resoumis chaque jour à Search Console.
- IndexNow signale les nouveautés à Bing/Yandex sans aucun compte.
- Une vigie quotidienne prévient sur Discord si le flux marchand, le sitemap ou le blog décroche.
- La séquence de bienvenue couvre les 10 langues au lieu de 5.

## 🚀 Déploiement

- [ ] **Pousser les commits vers `origin/main`** (`git push`). Je committe au fur et à mesure mais je ne push pas automatiquement — c'est une action visible/irréversible que je te laisse déclencher. Si Vercel est branché sur `main`, un simple `git push` suffira à déployer tout ce que j'aurai corrigé, y compris le blog (actuellement 404 en prod faute d'avoir été commité jusqu'ici).

---

## 🌟 Avis clients

- [ ] **Collecter de vrais avis dès que possible.** J'ai remplacé les faux avis (signés des noms des personnages eux-mêmes comme "Luffy D." ou "Goku S.") par des avis génériques neutres, et j'ai retiré le "4.9/5" et le "+2,500 portraits" affichés en dur — aucune donnée ne les soutient. Ce n'est qu'un pansement : dès que tu as de vrais clients satisfaits, demande-leur un avis (par email après réception) et remplace le contenu dans `messages/{fr,en,es,de,it}.json` (namespaces `home`, `product`, `onepiece`, `dbz`, `ghibli`, `rickandmorty`, `disney` → clés `review1Name`...`review6Text`).
- [ ] Une fois que tu as au moins quelques avis vérifiables, on pourra aussi activer le JSON-LD `aggregateRating` déjà prêt dans `components/structured-data.tsx` (actuellement inutilisé volontairement).

---

## 💳 Paiement

- [ ] **Poser `STRIPE_WEBHOOK_SECRET` dans Vercel** (Settings → Environment Variables, les trois
  environnements). C'est la seule chose qui manque pour que le webhook fonctionne : sans elle, la
  route répond 503 et Stripe réessaiera pendant trois jours. La valeur est le *signing secret*
  (`whsec_…`) de l'endpoint créé le 2026-08-23 dans le dashboard Stripe. Attention, celui du mode
  test et celui du mode réel sont différents ; pour un essai en local, c'est encore un troisième
  secret, celui qu'affiche `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- [ ] **Vérifier la version d'API de l'endpoint.** Le formulaire proposait `2025-08-27.basil` alors
  que le code épingle `2026-02-25.clover` à quatre endroits. Pas bloquant pour les champs utilisés
  (`id`, `amount`, `currency`, `status`, `metadata` n'ont pas bougé), mais aligner les deux évite
  une divergence silencieuse plus tard.
- [ ] **Surveiller la propriété `source` sur `purchase_completed`** les premiers jours. Elle vaut
  `webhook` ou `page_succes` selon qui a gagné la course. Si elle vaut *toujours* `page_succes`,
  c'est que le webhook n'arrive pas — et rien d'autre ne le signalerait.

Fait le 2026-08-23, le webhook est **en place** : `app/api/stripe/webhook/route.ts` traite
`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` et
`charge.dispute.created`. Le passage en PAID, l'e-mail client, la notification Discord et la mesure
vivent maintenant dans `lib/finaliserCommande.ts`, appelé par trois chemins (webhook, page de
succès, cron de rattrapage) et protégé contre le double déclenchement par une requête SQL atomique
(`marquerPayee` dans `lib/db.ts`). Le bloc « à rattraper à la main » du cron répare désormais au
lieu de journaliser. Les six branches de la route ont été testées en local.
- [ ] **Activer Klarna/iDEAL/Bancontact/paiement en plusieurs fois dans le Dashboard Stripe** (Paramètres → Moyens de paiement) si tu veux les proposer. J'ai retiré la restriction `paymentMethodOrder: ['card']` dans le code, mais en creusant je me suis rendu compte que ce paramètre ne fait qu'ordonner l'affichage — il ne bloquait pas les autres moyens de paiement. Ce qui décide réellement ce qui s'affiche, c'est ce qui est activé dans ton compte Stripe.

---

## 📱 Réseaux sociaux

- [ ] **Créer de vrais comptes Facebook/Instagram/TikTok** puis renseigner `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_TIKTOK_URL` dans les variables d'environnement (Vercel). Les icônes n'apparaîtront dans le footer qu'une fois ces variables renseignées — j'ai retiré les liens morts `href="#"` en attendant.

---

## 📊 Meta Pixel

- [ ] **Créer un pixel Meta** (business.facebook.com/events_manager) et renseigner `NEXT_PUBLIC_META_PIXEL_ID` dans Vercel. Le code est prêt et suit exactement le même pattern que Google Ads — tant que la variable n'est pas définie, rien ne se charge (aucun impact perf/vie privée en attendant).

---

## 📝 Pipeline de contenu (`portable-content-publisher`)

- [ ] **Clé API IA réelle** (`AI_API_KEY`, `AI_ADAPTER` dans `.env`) — actuellement `mock`. Vu la recherche faite plus tôt dans la conversation, Gemini 3.1 Pro ou Gemini 3 Flash sont un bon rapport qualité/coût pour du SEO multilingue — mais vérifie l'identifiant exact du modèle sur la doc API de Google au moment où tu configures ça, je n'ai pas voulu deviner un nom de modèle et risquer de casser silencieusement la génération.
- [ ] **Clé SerpAPI réelle** (`SERPAPI_API_KEY`, `SEARCH_ADAPTER=serpapi`) — actuellement `fixture` (données inventées).
- [ ] Une fois les deux clés en place : `cd portable-content-publisher && npm install && npm run migrate` puis démarrer les workers (`pm2 start ecosystem.config.cjs` ou `node --import tsx src/app/cli.ts worker generate` etc.).
- [ ] **Limite technique trouvée en lisant le code** (pas corrigée, à traiter avec plus de tests) : `src/adapters/serpapi.ts:103-111`, la fonction `discover()` ne cherche les sujets qu'avec la locale par défaut (français) — même si j'ai ajouté des seeds pour d'autres occasions, la découverte de sujets tournera uniquement en français tant que ce n'est pas corrigé. Une vraie correction demanderait de boucler sur les 5 locales et d'avoir des seeds par langue, ce qui a un coût direct (multiplie les appels SerpAPI par ~5) et je n'ai pas pu tester le pipeline en conditions réelles (adaptateurs encore en mock) — je préfère te signaler précisément le problème plutôt que de le corriger à l'aveugle.

---

## 🔍 FAQ structurée (SEO/GEO) — bloqué par tes changements en cours

- [ ] **Ajouter `<FAQJsonLd>` sur les 6 pages produit une fois que tu auras commité ton propre travail en cours.** J'ai vérifié : 5 des 6 styles (onepiece, dbz, ghibli, rickandmorty, disney) ont déjà un FAQ complet (5 questions/réponses) affiché visuellement, mais **aucune page produit n'émet les données structurées FAQ** (`FAQJsonLd`, déjà prêt dans `components/structured-data.tsx`) — seule `portrait-personnalise-cartoon/page.tsx` l'utilise. C'est exactement le genre de contenu que Google et les IA (ChatGPT, Perplexity) citent facilement.
  J'ai commencé à l'ajouter, mais **ces 6 fichiers ont déjà des centaines de lignes modifiées non commitées** (une refonte visible en cours, probablement la tienne) — impossible de séparer proprement mes 2 lignes de ton travail sans risquer de mélanger les deux dans un même commit. J'ai donc annulé mon ajout pour ne pas perturber ton travail en cours.
  Une fois que tu as commité tes changements sur ces pages, il suffit d'ajouter, dans chacune de `app/[locale]/{simpson,dbz,disney,ghibli,onepiece,rickandmorty}/page.tsx` :
  1. `import { FAQJsonLd } from "@/components/structured-data";`
  2. `<FAQJsonLd faq={faqData.map((f) => ({ question: f.q, answer: f.a }))} />` juste après le `<>` d'ouverture du JSX retourné (même endroit que dans `portrait-personnalise-cartoon/page.tsx:152`).
  Simpson n'a pas encore son propre jeu de questions (`simpson.faqQ1`... absent de `messages/*.json`, il réutilise actuellement le namespace `product`) — envisage d'en écrire un dédié comme les 5 autres styles si tu veux un contenu plus spécifique.

---

## ⚠️ Changements déjà en attente dans le repo, non liés à ce travail

En démarrant, le repo avait déjà des fichiers modifiés/non commités qui ne font pas partie du backlog (probablement ton propre travail en cours) : `app/[locale]/{dbz,disney,ghibli,onepiece,page,rickandmorty,simpson}.tsx`, `components/{Navbar,LayoutShell}.tsx`, `next.config.ts`, `campagne-simpson-uk-canada.md`, `app/robots.ts`, `.claude/settings.local.json`, et le dossier `app/[locale]/simpson-mockups/`. Je n'y touche pas et je ne les inclus dans aucun de mes commits — je committe uniquement les fichiers précis que je modifie pour chaque tâche du backlog. Si certains de ces fichiers devaient être commités, c'est à toi de le faire (ou de me le demander explicitement).

---

