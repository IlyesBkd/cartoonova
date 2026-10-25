# CODE11 — session de photos checkout, validation locale

## Résultat et périmètre

Chaîne locale vérifiée : contexte checkout → cookie opaque → réservation Blob liée à la session → vérification de propriété avant devis Stripe et avant création SQL de la commande. Aucun changement à `success`, à l'autorisation des PaymentIntent ou au contrat de paiement CODE02. Aucun commit, push, déploiement, service externe, achat ou envoi réel.

Le contrôle existant après paiement (`depot:<orderId>` / `poster:<orderId>`) et la conservation d'une ancienne URL exactement attachée à la même commande restent en place. Les nouveaux contrôles checkout ne contiennent aucune exception legacy.

## Contrat de sécurité

- `/api/upload/context` émet/réutilise `__Host-cartoonova-photo`, aléatoire (32 octets), HttpOnly, Secure, SameSite=Strict, Path=/, sans Domain. Cookie de session, non exposé dans le JSON. HTTPS requis hors contexte local sécurisé.
- `upload_contexts.subject` vaut `checkout:SHA256(session)`. La session brute n'est pas stockée en SQL. Aucun nouveau schéma/migration nécessaire.
- Le mint checkout exige simultanément son contexte opaque, l'IP liée au contexte et le cookie propriétaire. Connaître le contexte ou l'URL ne suffit pas.
- Checkout/create vérifient chaque pathname exact dans la jointure `upload_reservations` / `upload_contexts`, purpose checkout et subject de session, après le parseur d'URL strict et avant devis/création. Absence ou non-appartenance : 403 ; panne SQL : échec fermé (500 existant des routes).
- L'expiration du contexte borne le mint, pas l'utilisation ultérieure d'un objet déjà réservé. Cela conserve les retries sans devoir redéposer après 15 minutes.
- `ip_hash`, son en-tête d'origine fiable, les limites de quota, les débits IP/global et leurs transactions restent inchangés. Changer de cookie ne change jamais le bucket IP. Le quota subject est désormais propre à la session, distinct du quota IP.
- Les objets checkout de l'ancien scope IP, les objets sans réservation et les fichiers legacy non attachés sont refusés. Un nouveau dépôt sera nécessaire pour les paniers historiques concernés ; aucune adoption par simple URL ou IP.
- Une commande sans photo fonctionne sans cookie, sans configuration Blob et même si le ledger est indisponible.
- Le client sérialise les mints checkout entre produits pour éviter deux cookies initiaux concurrents ; Web Locks étend cette sérialisation aux onglets sur navigateurs compatibles. Une erreur ne bloque pas la file.

## TDD observé

1. Test contexte/session écrit puis exécuté sur l'ancien code : échec attendu `checkout must establish a browser-specific session` (absence de Set-Cookie). Après implémentation cookie + binding SQL/mint : GREEN.
2. Test refus croisé checkout/create écrit puis exécuté : échec attendu `200 !== 403`. Après intégration du helper de propriété aux deux routes : GREEN.
3. Test concurrence client entre deux produits écrit puis exécuté : échec attendu `2 !== 1`, le deuxième mint partait avant le premier Set-Cookie. Après sérialisation : GREEN.

## Preuves exécutées

Commande finale, environnement vierge :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test \
  tests/upload.test.mjs tests/upload-quota.test.mjs \
  tests/order-create.test.mjs tests/photo-validation.test.mjs \
  tests/photo-validation-routes.test.mjs tests/delivery-copy.test.mjs \
  tests/promo-reservations.test.mjs
```

Résultat réel : **68 tests, 68 réussis, 0 échec, 0 skipped/cancelled**. Journal TAP : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/code11-final-tests.tap`.

- PostgreSQL 18 jetable, ports locaux aléatoires, migration CODE04 réelle ; pas de connexion à la base production. Transport fournisseur bloqué (`MockAgent.disableNetConnect`, fetch interdit) ; effets remplacés aux frontières.
- Deux contextes Chromium séparés : vraies jarres de cookies, valeur différente, attributs HttpOnly/Secure/Strict, `document.cookie` vide. Même IP SQL, subjects distincts. Le navigateur B reçoit 403 sur mint, checkout et create pour la photo A ; A réussit la chaîne entière et le retry retourne la même commande. Persistance SQL exacte relue.
- Le transport navigateur est intercepté localement et appelle les vrais handlers, pas un serveur Next compilé. Ce test ne remplace pas le smoke HTTP de l'artefact final.
- Douze créations concurrentes avec photos propriétaires : une seule commande, mêmes identifiants, une seule mesure de création ; retry sans changement SQL. Expiration du contexte et déduplication vérifiées.
- Mauvaise session, cookie absent/forgé, mauvais purpose, ancien scope IP, legacy non attaché et objet moderne non réservé : refus avant nouveau paiement, insertion ou effets de création.
- Rotation de huit sessions puis concurrence à 63/64 objets IP : un seul succès, quota IP final 64 objets, seulement deux réservations globales réellement débitées (seed + succès). Rotation de 24 sessions : toujours 12 émissions maximum par IP.
- Replay/mint concurrent : une seule réservation, 409 pour les autres, pas de double débit ; contrat SDK exact pathname/no overwrite conservé.
- Les régressions dépôt signé, poster, cadeaux/promos, devis figé, copie de livraison et commande sans photo restent vertes.

ESLint ciblé exécuté via `env -i ... node node_modules/eslint/bin/eslint.js` sur les sept fichiers de production et quatre fichiers de tests modifiés : **exit 0**. `git diff --check` : **exit 0**. Une invocation initiale du wrapper eslint a été bloquée par le budget du garde de scan ; l'appel explicite au script JS a ensuite fonctionné.

## Fichiers de cette intervention

Production :
- Nouveau `lib/checkoutPhotoSession.ts`.
- Complété `lib/photoOwnership.ts` (helper checkout ; helpers après paiement conservés).
- Modifiés `lib/uploadPolicy.ts`, `lib/uploadClient.ts`.
- Modifiés `app/api/upload/context/route.ts`, `app/api/checkout/route.ts`, `app/api/order/create/route.ts`.

Tests :
- Complétés `tests/photo-validation-routes.test.mjs`, `tests/order-create.test.mjs`, `tests/upload.test.mjs`, `tests/upload-quota.test.mjs`.
- Les anciennes fixtures quota fournissent désormais un cookie synthétique stable parce que le mint checkout l'exige ; aucune assertion existante retirée ni affaiblie.
- Nouveau présent rapport `tests/photo-validation-report.md`.

La référence du skill Cartoonova `references/photo-validation-testing.md` a été mise à jour pour documenter la session, l'indépendance des quotas et la distinction navigateur intercepté / HTTP compilé.

## Limites et suite à la charge du parent

- Build complet, revue indépendante et smoke HTTP de l'artefact Next final : confiés au parent ; non déclarés réussis ici.
- Les tests prouvent le ledger et la propriété des réservations, pas l'existence ni le décodage des pixels chez Vercel Blob. Aucun transport fournisseur réel utilisé.
- Perdre la session cookie invalide la réutilisation prépaiement des photos de cette session ; nouveau dépôt requis. Le cookie n'est ni une authentification utilisateur ni une autorisation PaymentIntent.
- La sérialisation multi-onglets utilise Web Locks lorsque disponible ; le fallback sérialise dans l'instance du module. Le serveur reste fail-closed si des clients non coopérants lancent plusieurs premiers mints sans cookie en parallèle.
- Les autres modifications déjà présentes dans le dépôt ont été préservées ; aucun install ni remplacement de node_modules.
