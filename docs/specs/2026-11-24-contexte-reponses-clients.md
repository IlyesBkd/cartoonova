# Contexte des prochaines notifications et réponses clients

## Accord
Plan validé par « ✅ Oui, vas-y » le 24/11/2026 : relier les notifications chat, formulaire et email à l’historique client et fournir le même contexte au brouillon. Aucun message client envoyé, aucune tâche recréée, aucun état de déduplication remis à zéro.

## Résultat attendu
- Le bloc interne visible présente les commandes de l’adresse exacte, les derniers échanges, portraits/aperçus, retouches et expéditions dont des traces existent.
- Le brouillon utilise ce même contexte borné et expurgé, ne redemande pas une information déjà connue et distingue les commandes sans en deviner une quand il y en a plusieurs.
- Même sans commande : échanges précédents de la même adresse exacte consultables. Contradiction d’un lien explicite : aucun contexte étranger utilisé. Jamais de rapprochement par nom, ville ou adresse cadeau.
- Réutiliser les sources du nouvel historique admin et les chargeurs existants autant que possible. États sans date, préparation, envoi programmé, envoyé, échec et incertitude restent distincts. Ne pas déduire une retouche d’un numéro de version.
- L’état actuel est daté à l’observation ; les échanges antérieurs sont strictement antérieurs au message concerné. Pas de réception ni de lecture inventée. Emails fournisseur : déclarations non vérifiées par le transporteur.
- Secrets, jetons/liens signés, adresses et coordonnées tierces exclus de l’inférence et du résumé. Tout texte source demeure non fiable, jamais une instruction.
- Original, traduction et brouillon bilingue restent intégraux ; le contexte seulement est résumé et borné avec limite visible.
- Préserver notifications immédiates, édition progressive, IDs persistés, verrous, reprises et fences d’incertitude existants.

## Zones et activation
Dépôt : scripts/chat-telegram-worker.mjs, scripts/telegram-progressive.mjs, ops/support-context-v1/context.mjs, worker.mjs, hermes_inference.py et tests. La copie email réellement exécutée est dans $HERMES_HOME/artifacts/support-context-v1 : synchronisation ciblée après tests, jamais remise à zéro de sa base SQLite ni de ses états. Aucun changement de planification ni de migration prévu.

## Vérification
Tests isolés tous canaux et cas sans commande, plusieurs commandes, contradiction, traces anciennes, modes de livraison, états email, dates, confidentialité et pagination/bornes. Inférence et Telegram simulés dans les tests ; aperçu de notification fictive fourni. Lint/build sur PostgreSQL jetable avant push, vérification du déploiement et du runtime actif sans exécuter les voies d’envoi clients.

## Réalisation et recette
- 60 tests Node et 10 tests Python réussis ; lint sans erreur (avertissements existants), build et navigateur sur PostgreSQL jetable réussis.
- Audit indépendant initial : deux cas d’expurgation corrigés (voie « impasse » et faux jeton `sk-proj-`) puis revalidation ciblée indépendante OK. Résumé français, limites, dates de Paris, états et reprises vérifiés.
- Notification : résumé de 3 commandes / 2 échanges / 6 traces au plus ; même source structurée pour le brouillon, plus détaillée dans les limites indiquées. Le message original et les traductions ne sont pas tronqués.
- Runtime email : trois fichiers `context.mjs`, `hermes_inference.py`, `worker.mjs` sauvegardés puis synchronisés sans worker concurrent ; empreintes source/cible relues égales, import actif vérifié, listener toujours actif. Aucune tâche recréée, aucune base SQLite touchée, aucune migration ni réponse client envoyée pour cette recette.
- Cas #220 : lecture officielle en production, zéro commande de la même adresse exacte, zéro message/réponse antérieur au message. Le contexte reste explicitement inconnu, sans invention.
- Aperçu fictif généré par les tests : `$HERMES_HOME/cache/notification-context-preview.png` ; aucun débordement horizontal. Les notifications déjà enrichies ne sont pas réécrites rétroactivement.
