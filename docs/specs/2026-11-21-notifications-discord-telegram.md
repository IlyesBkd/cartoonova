# Notifications Discord et finalisation Telegram

Plan validé par Ilyes le 21/11/2026 : reprendre les cinq fichiers de chat existants, finaliser puis déployer ; couper sur Discord CSP, messages chat, contact et emails support entrants. Maintenir les notifications Telegram dans la conversation actuelle.

## Périmètre
- Finaliser contexte commande, traduction française sans perte de l'original, regroupement des messages rapprochés et historique utilisé par le brouillon.
- Retirer uniquement les sorties Discord des routes CSP/chat/contact et de la synchronisation IMAP support.
- Conserver protection CSP, collecte des signalements filtrés, stockage des messages, emails aux clients et toutes les autres alertes.
- Vérifier destination et traces des notifications Telegram chat et support. Raccorder les nouveaux formulaires contact à la file Telegram existante (ils étaient exclus du relais email et absents de la file chat), atomiquement avec leur sauvegarde. Pas de message à un client, pas de migration de production.

## Critère de réussite
Tests ciblés incluant messages successifs et absence de doublons ; lint et build sur base jetable ; vérification indépendante ; commit main poussé, déploiement READY et routes vérifiées sans message réel client ; preuve construire. Destination Telegram vérifiée et états d'envoi rapportés sans divulgation de coordonnées clients.

## Étapes
1. Audit/finalisation chat par délégation, coupure Discord ciblée et vérification Telegram en parallèle.
2. Test indépendant et corrections éventuelles.
3. Lint, build jetable, push, vérification déploiement et preuve.

Durée estimée : 30–45 minutes. Modèle actuel. Aucun changement visible du site public.
