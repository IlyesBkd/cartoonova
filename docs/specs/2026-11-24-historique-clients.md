# Historique client — accord reçu le 24 novembre 2026

## Demande et accord
Ilyes demande un historique pour chaque client : portraits et retouches envoyés, retouches demandées, mails envoyés (dont colis), réponses reçues et autres actions. Il valide par « go » le plan : fiche client dans l’admin regroupant ses commandes, reprise des traces existantes sans inventer, ajout automatique des événements futurs, contenu des échanges consultable. Estimation annoncée : 2 à 4 h, modèle actuel. Aucun message client envoyé. Migration éventuelle répétée sur copie puis accord spécifique avant production.

## Critère de réussite
Depuis l’admin, consulter une chronologie datée du client, toutes ses commandes comprises, comprenant les événements enregistrés disponibles : commande/paiement, photos, aperçu/validation, retouches demandées et livrées, portraits livrés, emails sortants et réponses entrantes, chat si identifiable sans ambiguïté, fabrication/expédition/suivis et avis. Chaque entrée indique sa source/commande, son contenu utile si disponible ; aucune donnée d’un autre client n’est exposée. Distinguer un envoi réel d’un brouillon, d’une programmation et d’un état incertain. Absence de trace = pas d’événement inventé. Le premier envoi ne masque pas les retouches suivantes. Les données historiques partielles sont signalées. Les futures traces sont visibles automatiquement, sans manipulation par Ilyes. Accès admin seulement, rendu mobile utilisable, lecture seule sans contacter clients ni fournisseur.

## Périmètre et limites
Réutiliser les tables/journaux et composants existants. Favoriser une chronologie calculée à partir de traces persistantes si elle couvre correctement les événements, sans nouveau service ni tâche planifiée. Une trace dont l’état est écrasé nécessite une conservation durable, avec migration soumise à validation avant application. Identité client fondée sur email normalisé exact ou rattachement explicite existant, jamais nom seul ; ne pas fusionner automatiquement des adresses différentes. Ne pas toucher aux documents Optimalprint déjà non suivis par Git. Ne pas ajouter d’envoi automatique.

## Choix retenu après diagnostic
Une agrégation des traces existantes seule perdrait les aperçus/validations et changements d’état écrasés. Ajouter `customer_history_events` avec journal append-only des changements utiles de commande et des emails via l’adaptateur existant. Ne garder que les champs métier autorisés, jamais tokens ou secrets, ni octets des pièces jointes. Avant envoi, conserver la tentative ; après acceptation fournisseur, ajouter son résultat sans transformer une panne de journalisation tardive en nouvel envoi. Une panne du journal avant fournisseur empêche l’appel : migration avant activation du nouveau code impérative. Le journal ne déclenche lui-même aucun envoi.

Essai de migration `python "$HERMES_HOME/scripts/db-tool.py" migrate migrations/20261124_customer_history.sql` réussi sur copie restaurée le 24/11/2026. Après clic « ✅ Oui, vas-y » à la confirmation spécifique, migration appliquée le 24/11/2026 ; relecture production confirme table présente, capture des changements et journal immuable actifs. Sauvegarde restaurée/testée par l’outil avant application.

## Étapes (30 minutes au plus par étape)
1. Diagnostic des sources, identité et interface ; choix de conservation des événements.
2. Backend de lecture unifiée et tests sur base jetable ; journalisation seulement si nécessaire.
3. Interface admin : ouverture depuis commande/support, chronologie et contenus ; tests ciblés.
4. Validation indépendante à partir de la spec et du diff, corrections.
5. Lint/build sur base jetable, migration répétée et validation si requise, push main, déploiement et page vérifiés, capture et preuve construire.
