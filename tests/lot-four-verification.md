# Lot CODE-08 / CODE-11 / CRO-07 / CODE-13 — validation locale

## État

Implémentation locale, non poussée et non publiée. CODE-06 conservée dans « Ne pas faire » ; CODE-02 exclue. Aucun changement cron, secret distant, paiement, fournisseur ou base de production.

## Exécution finale

- `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm test` : 28 fichiers attendus et exécutés, 269 tests réussis, 0 échec/skip/todo/annulation. Rapport scratch `tap-2RhoBc/summary.json` du profil Cartoonova.
- Build Next complet : exit 0, PostgreSQL 18 jetable contenant schéma et migrations email/upload/promos/webhook. Identifiants fournisseurs synthétiques ; aucune base de production.
- `npm run lint` isolé : exit 0, zéro erreur et 28 avertissements existants.
- Même artefact démarré par `next start` : `/fr/bon-cadeau`, `/en/bon-cadeau`, `/fr/cgv`, `/en/cgv`, `/fr/simpson` HTTP 200 ; webhook sans signature HTTP 401. Serveur et base jetable arrêtés.
- Revues indépendantes : CODE-08/CRO-07/CODE-13 approuvés ; CODE-11 initialement refusé pour ponctuations legacy puis correctif relu et approuvé, 86 tests photo/SEO ciblés réussis. Le total de 269 est celui de la campagne complète, pas la somme des réexécutions.

## Limites et prérequis de publication

- `RESEND_WEBHOOK_SECRET` absent de production lors du contrôle précédent des noms de variables. Il faut configurer le secret correspondant au fournisseur et appliquer `migrations/2026-10-resend-webhook.sql` avant publication, après accord explicite. Rien de cela n'est effectué ici.
- Déduplication Resend : au plus une tentative locale d'effets par événement ; pas une garantie de livraison distante ni exactly-once. Un crash après réservation peut perdre des effets.
- Photos checkout : cookie opaque HttpOnly/Secure/SameSite Strict, contextes propriétaires, quota IP indépendant. URL legacy exactement attachées à la même commande conservées après authentification, jamais au checkout.
- Tests de propriété sur vrais handlers/SQL et jars Chromium, transports Blob interceptés : ne prouvent ni existence ni pixels d'un objet chez Blob. Anciens dépôts checkout liés à une IP non réadoptés ; un client concerné devra redéposer ses photos.
- Un contrôle additionnel du cookie sur artefact compilé via proxy HTTPS local n'a pas été validé : `/api/upload/context` renvoie 403 « Origine invalide » dans cette topologie. Le proxy et la normalisation d'URL Next locale ne reproduisent pas Vercel. Ce résultat n'est pas présenté comme un succès HTTPS ; les contrôles HTTP ci-dessus et les tests de cookies sur handlers restent distincts. Aucune validation HTTPS production réalisée.
- La CI vérifie tests/types/lint mais ne bloque pas automatiquement les déploiements Vercel. Workflow distant et Node 24 non exécutés ici.
- CRO-07 rend explicites devise, supplément et exemple de solde : le minimum natif n'est pas supprimé. Dix langues et EUR/GBP/USD testées ; autres devises et relecture native non couvertes.

## Corrections pendant intégration

- Quatre anciennes assertions SEO attendaient le montant sans suffixe devise. Mise à jour des seuls textes attendus, parité montants/devises conservée ; 12/12 tests SEO navigateur passent.
- Legacy : RED sur les deux routes pour +/virgule/apostrophe et sur query/fragment vides, puis GREEN. Aucun assouplissement global d'URL.
