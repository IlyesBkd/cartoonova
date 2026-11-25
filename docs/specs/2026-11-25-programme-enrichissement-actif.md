# Programme quotidien : enrichissement actif IA (accord déjà reçu)

## But et périmètre validés
Avant chaque programme et chaque rafraîchissement, un agent consulte réellement les commandes, échanges et brouillons concernés avant la relecture finale. Il regroupe les doublons dans la vue, présente les actions utiles, l'attente client et les blocages précis. Aucun envoi client, remboursement ou mutation métier. Modèle actuel gpt-6-luna, tâche existante conservée. Livraison locale uniquement : aucun push, runtime ou cron modifié ; activation et test indépendant au parent.

## Diagnostic des sources
Le collecteur charge déjà un historique projeté, mais `hermes_inference.py` fait une complétion unique sans outils. `verification.py` ne peut compléter les preuves ; le rendu remplace toutes les incertitudes par « commande avant toute action », « brouillon non vérifié », « preuves limitées ». Les doublons entre alerte et brouillon de la même commande restent affichés séparément.

## Architecture retenue
Conserver le collecteur, la projection/masquage et la validation finale existants. Ajouter avant la relecture un court protocole d'agent : l'IA demande `inspect_dossier` pour des identifiants locaux de candidats, le processus de confiance traduit vers les UUID autorisés et lit effectivement via `python $HERMES_HOME/scripts/db-tool.py query` (transaction lecture seule imposée). Aucun SQL libre, shell, URL ou destinataire ne vient du modèle. Lecture bornée des états, échanges entrants/sortants, livraisons, retouches et réponses préparées ; lecture locale des brouillons en attente en mode lecture seule. Réutiliser `projectOrderContext` et `redact` avant tout retour au modèle. Un dossier est relu au plus une fois ; deux tours, huit dossiers par tour, quarante candidats et délai global borné. Les sources non consultées ou indisponibles restent des blocages explicites ; le modèle ne peut inventer de preuve ou lever une ambiguïté multi-commandes.

Les décisions finales restent validées par les veto existants. Ajouter une classification fermée action / attente client / blocage sans texte libre du modèle dans le rendu. Les regroupements restent strictement par UUID, pas par nom ; ne jamais fusionner deux commandes d'une personne. Ne pas supprimer de sources ni de brouillons. Les chiffres financiers, calendrier, destinataire Telegram et mécanismes de publication restent inchangés.

## Étapes (chacune <30 minutes)
1. Spec et lecture sources ; implémenter outil borné et protocole de recherche.
2. Intégrer préparation et rendu simple, conserver les garde-fous et budgets.
3. Tests hors connexion (outils réellement exécutés avec sources simulées, injections, erreurs, limites, identités, finance), recette réelle lecture seule si disponible ; documentation de synchronisation sans l'exécuter.

## Critères de réussite
- Une demande IA déclenche réellement l'outil borné ; le modèle de relecture reçoit les nouvelles preuves masquées. Aucun secret métier dans le processus IA.
- L'agent ne peut élargir les UUID ni exécuter de SQL/action arbitraire ; les coordonnées sont masquées, références datées et locales contrôlées.
- Erreur, timeout, ambiguïté ou données tronquées donnent un blocage concret, jamais une confirmation par défaut. Dépassements et dossiers non inspectés explicités.
- Doublons d'une même commande regroupés sans perdre plusieurs commandes d'un même client ni autoriser automatiquement des brouillons.
- Tests de non-régression finance/publication/imports et tests nouveaux réussis ; aucun runtime/cron modifié.
- Kerly Lopez, Tiffany Fuchs, Tanguy Courson, Nils : état réel à découvrir uniquement via les lectures autorisées, sans inventer leur situation. Les fixtures nommées sont fictives et ne valent pas recette réelle.

## Ajustements constatés pendant l’implémentation
- La lecture approfondie porte les textes des preuves à 6 000 caractères, tout en conservant 60 000 octets par payload. Cela permet de résoudre le simple tronquage initial à 700 ; une source email stockée à 5 000 reste signalée tronquée. Les brouillons eux-mêmes restent bornés à 700 et non confirmables s'ils sont tronqués.
- Le lien absent d'un brouillon est recherché uniquement par l'adresse exacte du fichier original local, jamais par une identité fournie par l'IA ; zéro et plusieurs commandes sont des blocages distincts. Nils a effectivement donné zéro commande à cette recherche.
- Les constats sémantiques sont des codes `finding` fermés, validés avec références et veto, jamais de prose libre IA. Ils ne retirent pas de candidat ni n'autorisent un envoi ou remboursement. Les blocages de lecture restent prioritaires.
- Recette IA réelle effectuée sans le lanceur runtime : b1 consulté/attente client, b3 et b5 consultés séparément/brouillons à adapter, b7 consulté/attente client (brouillon dépassé lors d’une recette précédente, jamais supprimé), b17 recherche exacte sans commande. Voir README pour la variabilité sémantique et les commandes de tests.

## Activation (parent)
Relecture indépendante du diff et des tests, recette réelle lecture seule des dossiers cités, sauvegarde et copie des sources sous les verrous existants avec run.py en dernier. Aucun fichier d'état/brouillon ni cron n'est à copier. Si un changement de planning est nécessaire, passer par le registre. Aucun changement de modèle ni dépendance nouvelle.
