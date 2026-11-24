# Envoi support : enregistrer l'historique après acceptation sans renvoi

## Accord
24 novembre 2026 : utilisateur « et faut plus que ce probleme arrive », plan court validé via « ✅ Oui, vas-y ». Chercher pourquoi le mail est parti sans ajout à l'historique ; corriger l'enregistrement et une nouvelle tentative sans renvoi ; tester pannes/doubles clics ; déployer après tests, aucun message client pendant les tests. Estimation45min–1h30, modèle actuel + audit indépendant.

## Incident et preuve
Message chat218, brouillon397b8c67-a0ec-4e85-850f-f4b8055c5791 : réponse fournisseur acceptée, status sent et provider_sent_at24nov2026 22:56UTC, mais reply_id NULL. Route prepared-send a retourné envoi incertain(sent), sans renvoi. Réparation explicitement approuvée ensuite via prepared-repair, reply24. Relecture DB : texte identique, même provider_id, support_message_id218, message lu. Aucun deuxième email envoyé. La cause exacte reste à reproduire, ne pas confondre symptôme et cause.

## Critères
- Cause concrète reproduite sur base PostgreSQL jetable si possible ; distinguer les hypothèses si journaux production insuffisants.
- Acceptation fournisseur durable et anti-double-envoi conservés. Toute nouvelle tentative automatique concerne exclusivement la réconciliation sans appel fournisseur, idempotente sur le même brouillon.
- Requêtes simultanées/doubles clics, pertes de réponse, checkpoint tardif, verrous, transaction avortée : pas de second appel au fournisseur, pas de doublon d'historique ou pièce jointe. Ne jamais présenter un envoi incertain comme refus certain ou livré au client.
- Un défaut d'historique après envoi confirmé est distingué dans le retour API ; récupération sûre dans le circuit existant, sans nouvelle tâche, sans reset états, sans changement de secrets/config sécurité ni migration production.
- Tests transports simulés/données jetables, aucune relance réelle de Nils ni autre client. Préserver les changements étrangers Optimalprint et les fichiers partagés hermes-ops/ops-kit.
- Lint + build scripts/verify-ten-cards-local.py base jetable avant push sur main ; audit indépendant après code ; déploiement READY + routes/page concernées vérifiées sans POST d'envoi réel ; preuve construire.

## Étapes <=30min
1. Diagnostic et reproduction, correction ciblée et tests pannes/concurrence PostgreSQL.
2. Audit séparé selon spec et correction des écarts, lint/build isolés.
3. Push/déploiement vérifié, preuve et bilan simple sans promesse zéro panne.
