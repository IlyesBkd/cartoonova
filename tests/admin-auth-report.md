# CODE-09 — preuve locale et prérequis de mise en service

## Réalisé

- `requireAdmin(req)` et alias `refuserSiPasAdmin(req)` : **Promise<NextResponse | null>**, à attendre avant toute lecture/écriture protégée. `x-admin-password` ne donne plus accès aux routes métier.
- Connexion : POST `/api/admin/auth`, JSON `{password}` et Origin même origine obligatoire. GET vérifie la session ; DELETE révoque son enregistrement SQL avant de vider le cookie.
- Jeton aléatoire de 256 bits, cookie `cartoonova-admin` HttpOnly / SameSite=Strict / Path=/, Secure en production. Durée absolue 15 minutes, sans renouvellement à la lecture. PostgreSQL ne garde que SHA-256 du jeton et une empreinte HMAC liée au jeton et au mot de passe, pas un hash réutilisable du mot de passe. Changer/supprimer ADMIN_PASSWORD invalide l'accès aux sessions existantes.
- Origin obligatoire sur les mutations protégées. Absence de configuration ou indisponibilité SQL : 503 générique, pas d'accès de secours.
- Limite PostgreSQL atomique, partagée entre instances : 5 connexions (succès compris) par client sur une fenêtre de 15 minutes ; 100 globalement. Aucun reset local exploitable en parallèle ; Retry-After conservateur de 900 secondes. Une session active ne consomme pas de tentative lors des appels métier.
- Par défaut tous les clients partagent le même quota : les en-têtes proxy sont ignorés. `ADMIN_TRUST_PROXY=vercel` **et** `VERCEL=1` activent uniquement `x-vercel-forwarded-for` contenant une IP valide unique. Ne configurer cette confiance que si l'ingress réel écrase effectivement cet en-tête. Ni X-Forwarded-For ni un autre reverse proxy ne sont implicitement fiables.
- UI : mot de passe envoyé uniquement dans la connexion puis effacé de l'état React ; aucun stockage local/session. Reprise de session par GET ; retour à la connexion sur 401, vérification au focus et toutes les 30 s ; vrai logout serveur. Les panneaux et dépôts admin utilisent les cookies, sans propager de mot de passe.

## Preuves TDD

Cycles RED constatés avant production, puis GREEN :

1. L'ancien header donnait accès (`undefined !== 401`) ; suppression de ce chemin.
2. Connexion sans session (`401 !== 204`) ; session SQL/cookie court.
3. Endpoint logout absent (`undefined` au lieu de fonction) ; révocation réelle puis refus du cookie copié.
4. Connexion étrangère acceptée (`204 !== 403`) ; vérification Origin.
5. Vingt essais concurrents tous acceptés comme essais (`20 !== 5` réponses 401) ; quota partagé SQL, puis cinq 401 et quinze 429.
6. Aucun quota par client explicitement fiable (`429 !== 401` pour le second client) ; confiance Vercel opt-in, quota global conservé.
7. Mutation avec cookie et origine étrangère autorisée (guard `null`) ; garde Origin sur mutations et logout.
8. Stockage SHA-256 réutilisable du mot de passe détecté ; remplacement par HMAC lié au jeton.
9. Quota global atteint créait encore une entrée par nouvelle IP (`4 !== 3`) ; arrêt avant création du bucket client.
10. Vrai composant admin envoyait encore l'ancien header, sans JSON ; parcours Chromium corrigé. Régression GET orders avec un body détectée par timeout d'attente de requête puis corrigée.
11. Inventaire AST des callers : appels non attendus détectés ; adaptations hors orders effectuées. Les adaptations orders sont attribuées à FLOW-03 (voir intégration ci-dessous).

Des tests de caractérisation supplémentaires couvrent expiration, rotation/absence du mot de passe, panne SQL, cookie Secure et absence de renouvellement, réouverture des quotas après expiration.

Dernière commande de régression réussie (environnement nettoyé, PostgreSQL neuf sur port aléatoire, données synthétiques, transports externes neutralisés) :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node --test tests/admin-auth.test.mjs tests/admin-auth-browser.test.mjs tests/upload-quota.test.mjs tests/upload.test.mjs tests/final-image-security.test.mjs tests/gift-delivery.test.mjs
```

Résultat réel : **52 tests, 52 pass, 0 fail**. Avertissement MockTimers expérimental dans la suite cadeau ; diagnostics de refus attendus dans les tests de sécurité.

ESLint ciblé : succès (0 erreur, 3 avertissements `<img>` existants de la page admin).

## Intégration et déploiement — rien appliqué en production

- Appliquer **avant publication** `migrations/20261025_admin_sessions.sql` par la procédure autorisée, sur la base partagée par toutes les instances. Migration additive, seulement exécutée sur des PostgreSQL jetables pendant ce travail. Sans les tables, le système reste fermé en 503.
- Garder ADMIN_PASSWORD fort et privé ; HTTPS et NODE_ENV=production requis pour la mise en service. Aucun secret nouveau de fournisseur requis. Aucune configuration distante modifiée.
- Prévoir une purge opérationnelle des lignes expirées (`admin_sessions.expires_at`, `admin_login_buckets.expires_at`) ; les index sont fournis. Aucun cron ni permission de production ajouté. L'expiration de l'autorisation est contrôlée immédiatement par SQL, indépendamment de cette purge.
- Les API appelées par des scripts avec l'ancien header devront ouvrir une session par le même endpoint et conserver le cookie, en fournissant Origin sur les mutations. Aucune compatibilité permanente avec le mot de passe brut.
- Intégration finale : les cinq appels sans await initialement détectés dans `app/api/orders/route.ts` (deux), `app/api/orders/expedition/route.ts` (deux), `app/api/orders/extras/route.ts` (un) ont été corrigés par le coordinateur. Le test AST et les vérifications d'authentification ont ensuite été relus/exécutés indépendamment avec succès. La validation globale et le build doivent rester liés à l'arbre final ; ce rapport ciblé ne remplace pas leur résultat.
- Aucun build partagé lancé, aucun commit, push, déploiement ou contact tiers.

## Comptes nominatifs / MFA : évaluation, non implémentation

La solution reste un compte administrateur partagé : **ni comptes nominatifs, ni MFA, ni journal nominatif ne sont implémentés**. Les sessions courtes/révocables réduisent l'exposition mais ne fournissent pas ces garanties.

Option sans fournisseur payant : gérer des comptes PostgreSQL individuels avec mots de passe hachés par un KDF adapté, révocation par compte et journal d'audit, puis ajouter WebAuthn/passkeys (préférable contre le phishing) ou TOTP. Une bibliothèque maintenue est préférable à une implémentation cryptographique maison ; le choix et ses dépendances doivent faire l'objet d'une revue distincte. TOTP impose chiffrement des secrets, fenêtre bornée et anti-rejeu, enrôlement authentifié, codes de secours hachés et récupération/révocation documentées. WebAuthn impose RP ID/origines exactes, challenges à usage unique avec expiration et plusieurs moyens de récupération. Un IdP auto-hébergé évite un abonnement fournisseur mais ajoute hébergement, correctifs et sauvegardes ; ce n'est pas gratuit en exploitation.

Choix recommandé : comptes nominatifs et WebAuthn dans une tâche séparée avec décision explicite sur l'enrôlement et la récupération, sans ajout silencieux d'un fournisseur ou modification d'autorisations de production.
