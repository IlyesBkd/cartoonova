# Lot CRO-05 / CODE-09 / FLOW-03 / CRO-08 / EXT-SEO-01

## Livraison locale, non publiée

- CRO-05 : notices et documents dix langues cohérents ; aucune publication promotionnelle sans autorisation séparée explicite révocable. Aucun faux opt-in ajouté. Les anciennes promesses de purge à 30/90 jours ne correspondaient pas à un mécanisme identifié et ont été retirées. Validation juridique non réalisée ; procédures effectives de conservation, sauvegarde et droits sur les visuels historiques non audités.
- CODE-09 : sessions SQL de quinze minutes, cookie HttpOnly/Secure en production, révocation au logout, origine contrôlée sur mutations, quotas partagés. Compte partagé conservé : comptes nominatifs et MFA non implémentés. Pas de nouveau fournisseur payant. Par défaut les clients partagent le quota ; confiance Vercel seulement après vérification de l'ingress et configuration explicite.
- FLOW-03 : destinataire/langue/portrait relus dans la commande ; invitation versionnée ; changement d'image invalide l'ancienne invitation, approbation et programmation. UI rechargée depuis la commande canonique. Programmation automatique conditionnelle à l'image, email, options et approbation physique courants. Tests à barrière et navigateur réels.
- CRO-08 : occasion propre à la page, bandeau global neutralisé sur cadeaux/Noël, bon envoyé après paiement distinct du portrait à réaliser. Pas de changement des constantes métier. Calendrier sans jours fériés ; repères Noël indicatifs, pas de garantie transport par pays vérifiée.
- EXT-SEO-01 : liens pertinents localisés vers les vingt pages à-propos/portfolio et vers la landing française. Graphe de 360 pages cadeaux réellement rendues en tests ; aucune nouvelle indexation Google revendiquée.

## Vérifications

- `npm run lint` : succès, zéro erreur, 28 avertissements existants.
- Build final via le harnais `cache/scratch/five-cards-build.py` du profil : succès sur PostgreSQL jetable avec schéma et six migrations applicables, environnement minimal et identifiants fournisseurs synthétiques.
- Ce même build a été démarré localement : dix pages contrôlées en HTTP 200 ; commandes et état de connexion non authentifiés refusés en 401. Chromium a confirmé la notice photos et l'absence d'Halloween sur la page Noël ; captures locales conservées dans `cache/five-cards-local/` du profil. Serveur et base arrêtés dans un finally.
- Revue indépendante contenu/navigation : aucun bloqueur. Revue sécurité initiale : deux bloqueurs FLOW-03 détectés puis corrigés en RED/GREEN et relus indépendamment ; 23 tests de cohérence notification réussis sur le correctif final.
- Suite globale finale après les deux corrections : **321 tests sur 34 fichiers, 321 réussis, zéro échec, zéro ignoré**. Inventaire attendu et exécuté réconcilié automatiquement. Reçu final : `cache/five-cards-local/test-summary-final.json` du profil.
- Aucun achat, email client, stockage fournisseur réel ou accès à la base de production dans ces vérifications. Pas de push ni déploiement.

## Prérequis avant une éventuelle publication autorisée

1. Appliquer `migrations/20261025_admin_sessions.sql` sur la base partagée avant de déployer le code : sans les tables, l'admin reste fermé en 503. Les scripts utilisant l'ancien header de mot de passe devront ouvrir une session et conserver son cookie ; aucune compatibilité permanente n'est maintenue.
2. Examiner et autoriser explicitement `migrations/20261025_order_notification_versions.sql` : elle ajoute les champs de version et invalide les anciens liens d'invitation dont l'image/email envoyés ne sont pas prouvés. Ils nécessiteront une nouvelle invitation. Les réponses/notes/photos historiques sont conservées. Le garde de schéma existant du code fait aussi cette invalidation à sa première utilisation : ne pas publier en omettant cette conséquence.
3. Aucune de ces migrations n'a été exécutée en production. Pas de rotation de secret, révocation de production, crontab système ou configuration distante modifiée.
4. Le stockage des photos reste public par lien ; une vraie purge automatique et les comptes nominatifs/MFA restent des évolutions distinctes, non réalisées par ce lot.

Les cartes Trello restent non terminées jusqu'à publication autorisée et comportement vérifié en production.
