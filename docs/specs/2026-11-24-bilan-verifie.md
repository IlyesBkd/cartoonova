# Bilan quotidien : faits recoupés et agent de relecture

## Accord et périmètre
Le 24 novembre 2026 Ilyes a validé par « oui » : vérifier chaque priorité avec la commande et son historique récent ; écarter relances dépassées et doublons ; ne pas déduire de photos manquantes du nombre de fichiers ; ajouter une relecture IA indépendante avec preuves datées et doutes visibles ; en cas d'échec afficher « à vérifier ». Modifier et activer le bilan existant, sans nouvelle tâche ni envoi client. Estimation annoncée 1–2 heures, modèle léger pour la relecture.

## Critères de réussite
- Les anciens brouillons sont des propositions, jamais une preuve que leur action est toujours utile. Recouper avant affichage avec la commande actuelle et les derniers échanges enregistrés, exact email normalisé et liens explicites seulement, sans fusion transitive de commandes/clients.
- Un nombre de fichiers inférieur au nombre de personnes n'établit jamais un manque. Un aperçu/portrait/correction déjà envoyé rend une ancienne demande de photos obsolète, sauf demande récente explicite prouvée. En cas de doute : vérifier, ne pas relancer.
- Cas Tiffany : cinq photos, aperçu et correction envoyés, ancienne relance photos ; ne doit plus remonter comme demande de photos validable. Cas Tanguy : dédoublonner les brouillons identiques pour la même commande/action sans supprimer ni envoyer les sources ; conserver séparément b3/b5 qui concernent en réalité deux commandes différentes.
- IA légère de relecture indépendante : reçoit uniquement des faits datés bornés et expurgés, sans secrets, URLs privées/signées ni coordonnées tierces ; sources libres non fiables et séparées des instructions ; aucune capacité d'outil/action/envoi. Sortie strictement validée, décisions restreintes à confirmer/retirer/à vérifier sur candidats existants, preuves issues du contexte. L'IA n'invente ni action, ni date, ni statut et ne peut pas réhabiliter une action rejetée par les contrôles déterministes.
- Échec d'historique, modèle indisponible, sortie invalide, contradiction ou données limitées : marquer à vérifier (jamais confirmer silencieusement). Relecture couvre les actions exposées, y compris portraits et impressions hors alertes ; les messages support non lus ne sont pas présentés comme prouvés sans réponse hors site.
- Pas de changement de finance, planning, destinations Telegram, secrets, données de commande, états d'envoi/déduplication, fichiers partagés ou métiers étrangers. Aucune nouvelle notification ; aucune publication de test ni message client/fournisseur.
- Tests sur données jetables avec transports simulés : régressions Tiffany/Tanguy, multi-commandes, photos groupées, rappel récent, état complété, dates, sources contradictoires, injection, masquage, délais/échec IA, budget, conservation des états et idempotence.
- Recette réelle en lecture seule avant activation puis --preview après activation, avec relecture IA réelle ; comparaison des empreintes runtime/source, aucun envoi de test. Capture d'un aperçu fictif pour le résultat visuel.

## Étapes <=30 min
1. Reprendre le runtime daily-brief existant dans ops/daily-brief pour versionner les seules évolutions utiles, intégrer preuves et contrôles, puis IA de relecture sans outils. Préserver les autres artifacts.
2. Tests unitaires/intégration et relecture indépendante de la spec et du diff ; corriger les écarts. Lint + build sur base jetable avant push.
3. Sauvegarder/synchroniser uniquement les sources runtime, sans exécution concurrente et sans toucher aux états ; vérifier --preview, déploiement et preuve construire.

## Résultat de la recette
- Deux audits indépendants : premier refusé (confirmations contredites, suppressions trop larges, troncatures, masquage et dates), puis contre-audit ciblé OK après corrections. Les retraits sémantiques du modèle restent visibles « à vérifier », pas supprimés ; les exclusions locales prouvées sont seules masquées.
- 31 tests Node et 28 Python sur données fictives/jetables ; launcher runpy et imports runtime relocalisé testés. Lint et build sur base jetable réussis.
- Recette active en lecture seule : neuf candidats, tous « à vérifier » à cause des limites d'historique ou de preuve. Tiffany n'est plus présentée comme une relance photos validable ; b3/b5 Tanguy restent séparés. Aucun de ces résultats ne vaut feu vert d'envoi.
- Appel réel au modèle léger via le runtime : schéma valide, confirmation contradictoire photos présentes bloquée. Aucun transport client ni finance interrogée dans ces sondes.
- Activation avec sauvegarde sous cache/daily-brief-before-review-*, sept sources relues identiques, états/brouillons/planning inchangés. Un défaut d'import du masque relatif au runtime a été détecté immédiatement après copie et corrigé ; la résolution de tsx est ancrée au projet. Nouvelle sonde active et import launcher OK.
- Capture fictive cache/verified-brief-fiction.png sans débordement horizontal. Le masquage reste heuristique ; l'IA ne garantit pas zéro erreur et n'agit jamais sur une commande ou un envoi.
