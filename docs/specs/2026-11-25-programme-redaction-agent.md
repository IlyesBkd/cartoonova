# Programme privé Cartoonova — rédaction réelle par agent IA

Accord utilisateur : « go », 25/11/2026. Étape locale uniquement, sources `ops/daily-brief`, sans synchronisation runtime, cron, commit ni push.

## But et périmètre

Après la collecte, la recherche active et la relecture existantes, l’agent rédige réellement la prose métier du message épinglé privé pour Ilyes, en français simple, ton pote. Le script garde le calcul financier, la mise en forme sûre et la publication existante. Aucun message client, remboursement, mutation métier ou changement d’état.

Le programme comporte **À faire / On attend le client / Une décision à prendre**. Chaque ligne précise le souci et la prochaine action, sans jargon, « Dossier c3 », ni invention de fait ou d’action. La finance reste calculée par script, jamais envoyée au modèle. Les compléments support/Trello restent des données non fiables, masquées et ne donnent aucune preuve d’absence de réponse hors site.

## Sécurité et critères de réussite

- Réutiliser `hermes_inference.py`, avec budgets explicites d’entrée, sortie, délai et taille Telegram. L’IA rédige du texte libre métier, pas un choix de phrases fixes.
- Protocole fermé : chaque ligne référence uniquement un dossier et des preuves connus ; HTML interdit dans la prose. Les identités structurées sont exclues du payload et les labels lisibles réinjectés localement ; la prose doit employer des mentions neutres, contrôlées par des filtres lexicaux prudents et bornés (voir limites ci-dessous), pas par une garantie universelle de reconnaissance d’entités. Regrouper uniquement par UUID, jamais par nom ; commandes distinctes préservées, non-liés séparés.
- Les limitations et veto existants restent prioritaires. Une absence de commande signifie « commande non retrouvée », jamais absence de client. Les sources partielles n’autorisent pas une action commerciale. Les décisions commerciales restent humaines.
- Échec, indisponibilité ou sortie invalide : repli explicitement annoncé comme non rédigé par l’agent, sans ancien texte périmé réutilisé ni confirmation nouvelle.
- Tests hors réseau adverses et intégration rendu, finance/publication/imports inchangés. Recette réelle lecture seule avec agent, dossiers réels et aperçu local masqué avant toute activation. Ne pas exécuter `run.main`, ne pas utiliser de transport Telegram. Lectures métier uniquement via `db-tool.py query`.

## Étape (30 minutes maximum)

1. Lire les sources et préserver le chantier enrichissement existant.
2. Ajouter projection rédaction, validation des références, appel IA et rendu sûr ; brancher après recherche/relecture.
3. Tests adverses et régressions hors connexion ; recette réelle lecture seule ; documenter les chemins et la procédure d’activation destinée au parent.

## Validation et activation

Le parent effectue une validation indépendante du diff et de l’aperçu réel. Puis seulement sauvegarde/synchronisation des sources sous les verrous existants, import depuis `/`, aperçu contrôlé et validation de l’épingle. Aucune activation par ce chantier. Les références fermées ancrent la prose mais ne prouvent pas sa vérité sémantique : la recette humaine reste nécessaire.

## Corrections de la revue bloquante (locales, non activées)

- Sur `inspect` et `wait`, contrôler **souci et suite**, pas seulement le préfixe de la suite. Rejeter les infinitifs/impératifs opérationnels et indices directifs courants ; conserver les descriptions factuelles (« portrait envoyé », « demande de remboursement »). La suite conserve son filtre plus strict. Le contrôle reste lexical : ce n’est pas un analyseur sémantique universel du français.
- Réinjecter **toutes les limitations concrètes connues** de chaque groupe affiché depuis les tables du script, sans dépendre des `sourceIds` ou d’une reformulation du modèle. Le repli les conserve aussi ; si elles ne tiennent pas, omettre le dossier entier avec compteur explicite plutôt que tronquer ses limites. Budgéter le rendu réel, limitations comprises. Rejeter les assertions usuelles de complétude/couverture exhaustive et d’accès à la boîte mail/fournisseur ; un identifiant de source ne lève jamais une limitation.
- Demander des mentions neutres dans la prose ; rejeter les capitales suspectes (noms, lieux, marques), y compris au début d’une phrase, sauf mots neutres usuels. Les noms lisibles restent exclusivement ajoutés depuis les labels locaux. Ce filtre peut rejeter des phrases pourtant légitimes ; des noms tout en minuscules/obfusqués et des paraphrases opérationnelles ou de complétude peuvent lui échapper. Ni ce filtre ni une seconde IA n’attestent la vérité de la prose libre. La recette indépendante humaine et l’absence de pouvoir d’exécution restent nécessaires ; aucune autorisation métier n’est déduite du texte.
- Régressions par les **vrais `write` / masquage Node / `run.render`**, modèle simulé : « Envoie le portrait au client maintenant. » avec suite de vérification, « Toutes les informations sont complètes. » citant pourtant une limitation, « Paul Martin attend son portrait. ». Tester aussi leurs variantes dans les deux champs, `inspect`/`wait`, descriptions factuelles légitimes, rédaction neutre libre conservée, réinjection locale des noms et dépassement du budget des limites.
- Validation après correctifs : **79 tests Python et 33 tests Node réussis**, `git diff --check` réussi. Finance, publication et imports relocalisés couverts par les suites ; build/lint laissés au parent, non relancés ici.
- Nouvelle recette `preview-agent-redaction.py --reuse` : **vrai sous-processus `hermes_inference.py --write`, statut `agent`**, preuves réelles déjà présentes dans le scratch (pas une nouvelle collecte). Aperçu remplacé au même chemin privé, **1 718 unités UTF-16**, avec les limites b17 visibles depuis le script. Aucune publication ni interrogation financière ; aucune modification runtime/cron/état métier.

## Résultat de l’étape locale

- Ajout de `drafting.py`, branchement après recherche/relecture dans `run.collect`, mode `--write` du wrapper Hermes existant. Prose libre avec souci/suite, références fermées et budget ; finance et publication non modifiées.
- Validation finale hors réseau : **75 tests Python, 33 tests Node, `git diff --check` réussis**. Tests adverses, vraie projection/masquage Node, rendu intégré et imports relocalisés inclus.
- Recherche réelle sur b1/b3/b5/b7/b17 en lecture seule via l’outil fixe. Dernière rédaction réelle via sous-processus Hermes sur ces preuves réutilisées : b1 en attente, b3/b5 séparés, b7 à recouper, b17 commande non retrouvée sans conclusion sur l’existence du client. Aucun envoi Telegram ; finance non interrogée dans cette recette.
- Aperçu privé : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/programme-agent-apercu.html`, **1 586 unités UTF-16, mode 0600**, sans coordonnées/UUID/liens privés. Le label local b7 distingue commande liée et nom non affichable.
- Replis réels observés sur sortie trop longue/références non conformes ; prompt précisé et plafond par champ fixé à 220 (cible 150), sans élargir le total de 2 100 unités. Une panne de relecture a également été exposée sans autorisation commerciale. Vérifier qualité et fréquence des replis à la validation indépendante, avant activation.
- Aucune synchronisation runtime, modification cron, mutation métier, commit ou push. Liste de copie et retour arrière dans le README ; prendre en compte le budget supplémentaire de rédaction de 45 s. Fichiers du chantier précédent préservés et fichiers Optimalprint non touchés.

