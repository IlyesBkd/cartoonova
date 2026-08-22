# Notes manuelles — actions que je ne peux pas faire à ta place

Ce fichier liste toutes les actions du backlog qui nécessitent une décision, un compte, une clé API, ou un accès dont je ne dispose pas. Je le complète au fur et à mesure que j'avance dans le backlog.

> **Les sections datées d'avant le 2026-08-22 sont partiellement obsolètes.** La section « Automatisation des canaux » ci-dessous fait foi : elle décrit ce qui reste manuel après le passage du 2026-08-22.

---

## 🔁 Automatisation des canaux — état au 2026-08-22

Ce qui reste à faire de ton côté, par ordre de blocage :

- [ ] **Deux secrets GitHub** (Settings → Secrets and variables → Actions) pour le moteur de contenu. Le workflow `.github/workflows/contenu.yml` tourne toutes les trois heures et reste inerte sans eux. `DATABASE_URL` est déjà en place.
  - `AI_API_KEY` : une clé `OPENAI_API_KEY` **existe déjà dans ton Vercel** (elle sert à la classification du support). La recopier ici suffit, inutile d'en créer une. Je n'ai pas pu la lire moi-même : le déchiffrement d'un secret Vercel est refusé par la politique de sécurité de mon environnement, même avec ton autorisation explicite.
  - `SERPAPI_API_KEY` : aucune valeur n'existe nulle part, il faut ouvrir un compte. La découverte tourne sur 10 marchés, plafonnée à 2 amorces par langue hors français, mise en cache 24 h → environ **30 recherches par jour** (≈900/mois). À confronter au palier que tu choisis ; le plafond se baisse dans `config/project.json` (`sources.maxSeedsPerLocale`).
- [ ] **Compte Google Merchant Center** : création, validation du domaine, puis ajout des flux programmés `https://www.cartoonova.com/api/feed/google/{langue}` (une source par pays/devise). Le flux déclare désormais la livraison, le type de produit, les étiquettes et jusqu'à 10 visuels par fiche — plus rien ne bloque côté technique.
- [ ] **Compte Pinterest business** + revendication du domaine, puis branchement du catalogue sur `/api/feed/pinterest/{langue}`.
- [ ] **Comptes sociaux** (`NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_TIKTOK_URL`) — inchangé.

Fait le 2026-08-22, sans action de ta part : commits poussés et déployés, les trois variables `GSC_*` ajoutées dans Vercel (production), le secret GitHub `DATABASE_URL` créé, et les 794 URL du site soumises à IndexNow.

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

