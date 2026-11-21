# Notifications Telegram progressives — plan validé

Accord utilisateur : « ✅ Oui, vas-y », après aperçu du périmètre.

## But
Notifier Ilyes dès l'enregistrement d'un message chat/contact/email support, sans attendre l'inférence, puis enrichir la notification Telegram d'origine. Les emails restent dépendants de la relève IMAP existante, ce n'est pas un remplacement de la réception Gmail.

## Format accepté
Date et heure de réception, client/expéditeur, canal et objet email, contexte commande s'il est retrouvé sans ambiguïté. Original intégral conservé. Traduction française du message si langue étrangère ; brouillon dans la langue du client et version française pour Ilyes. Présentation explicite « brouillon, rien envoyé ». Première version avec préparation en cours, puis modification du même message. Corps dépassant la limite Telegram : parties numérotées liées, sans troncature, mises à jour sans renvoyer le message de base.

## Déclenchement et sécurité
Réutiliser stockage/file existants, sans migration de production ni nouveau secret ; déclenchement rapide avec signal non bloquant après sauvegarde. Travailleur sur VPS, crons existants en secours. Sauvegarde du message jamais bloquée par Telegram. Pas de rejeu de l'historique déjà envoyé. Résultats de premier envoi ambigus non rejoués automatiquement ; mises à jour éditent seulement les identifiants Telegram enregistrés et dans la destination confirmée. Garder isolation par expéditeur, historique utile et rapprochement commande prudent. Aucun envoi client, retour Discord, paiement ni changement de sécurité.

## Critères de réussite
Tests sur PostgreSQL jetable et SQLite de test, transport Telegram et inférence simulés : réception avant inférence, édition même message, redémarrage/reprise, concurrence, absence de doublons, panne Telegram/inférence, langues FR/IT/EN, longs messages/emoji, arrivée rapprochée, dates et données non interprétées. Déclenchement rapide démontré avec secours périodique conservé. Revue indépendante. Lint et build jetable. Push main et production READY puis routes vérifiées. Travailleur local réellement activé et état vérifié. Preuve construire. Aucun vrai message client utilisé pour un test d'envoi.
