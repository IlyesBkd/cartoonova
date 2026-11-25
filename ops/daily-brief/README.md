# Programme Cartoonova : recherche, relecture et rédaction IA

Sources locales uniquement, conformément à `docs/specs/2026-11-25-programme-enrichissement-actif.md` (suite du bilan vérifié du 24/11). **Aucune synchronisation runtime ni modification cron par ce chantier. Ne pas exécuter run.py ici pour une recette isolée** : ses états et transports restent ceux de la production, même en preview le verrou runtime serait ouvert.

## Circuit

1. `run.py` conserve collecte, finance, résolutions locales, exclusions support, calendrier et publication existants. Il insère `enrich(...)` avant `review(...)` pour le programme et les refresh.
2. `enrichment.py` fait planifier les lectures par gpt-6-luna : protocole JSON strict `requests: [{tool: inspect_dossier, candidateId: candidate-N}]`. Ce sont des **demandes d'outil effectivement exécutées par le processus de confiance**, pas un prompt prétendant avoir consulté des sources. Le modèle ne reçoit ni SQL, shell, URL, UUID ou coordonnées et ne peut choisir qu'un candidat de la collecte. Il n'a pas d'outil fournisseur natif : le petit driver assure la validation, les appels bornés et la transmission des preuves à la relecture finale. Une sortie malformée n'est jamais exécutée.
3. `inspect_dossier` relit les sources via le seul `python $HERMES_HOME/scripts/db-tool.py query`, transaction lecture seule imposée. Requête fixe : état, messages entrants/sortants, livraisons, retouches et réponses préparées explicitement reliées (target order ou frozen_order_id). Les brouillons locaux en attente sont relus sans modification. Si le brouillon n'a pas d'UUID, l'adresse exacte du brouillon original local peut rechercher une commande ; zéro résultat ou plusieurs résultats donne un blocage distinct. Un nom n'est jamais une clé de rapprochement ; un UUID mal formé n'est jamais réparé.
4. `lookup.mjs` réutilise `projectOrderContext` et le masquage partagé avant tout retour au modèle. Les échanges liés à une autre commande sont exclus ; un échange non assigné n'est utilisable que pour une adresse exacte avec une seule commande. Les brouillons associés restent des propositions, jamais des preuves d'envoi. Noms affichés masqués s'ils sont des coordonnées ; UUID, noms et finance exclus du payload IA.
5. La relecture indépendante conserve les veto déterministes : limitations, photos incomplètes non prouvées, impression non validée, portrait déjà envoyé, etc. Les nouveaux envois découverts par l'outil réappliquent les veto des brouillons et demandes photos. Un retrait sémantique IA reste visible, il ne supprime aucune source. Les exclusions sont uniquement locales/exactes ou état terminal.
6. La sortie optionnelle `finding` est un code fermé : action, awaiting_customer, draft_superseded, draft_update, refund_requested, unknown. Elle exige des références à des échanges, pas un état seul ; limitations => unknown. Une attente client exige un sortant sans entrant/retouche postérieur ; un brouillon dépassé exige un envoi postérieur à sa création ; un remboursement nécessite une preuve entrante et reste une **décision humaine**, aucun appel de remboursement. Ces constats sémantiques restent tributaires de la qualité du modèle ; ils n'autorisent jamais seuls un envoi.
7. `drafting.py` reprend les candidats relus et fait **rédiger la prose métier libre par l’agent**, via le même `hermes_inference.py --write` et le même modèle. Le script garde les trois titres « À faire / On attend le client / Une décision à prendre », les identités locales et la finance. Les phrases souci/prochaine étape proviennent réellement du modèle ; elles ne sont pas sélectionnées dans un catalogue. Les rappels support, brouillons du matin et Trello (lundi) passent aussi par la rédaction, après masquage commun. `presentation.py` ne sert plus que pour les explications prudentes du repli.
8. Le regroupement n'utilise qu'un UUID validé ; jamais un nom. Deux commandes de Tanguy restent deux groupes, avec leur brouillon lisible réinjecté localement. Un lien absent ou malformé reste séparé. Les noms, coordonnées, UUID, IDs de brouillons et finance ne sont pas ajoutés au payload de rédaction. Les textes source passent de nouveau par le masquage Node partagé. Les sources conservent leur date/état et leur statut de brouillon non envoyé.
9. La sortie est fermée : exactement une ligne par groupe connu, section imposée, 1 à 4 références aux sources de ce groupe, limitation obligatoirement citée si présente. Une attente ou action exige une preuve, pas uniquement le jugement IA. Les limitations, identité non reliée, veto locaux et incertitudes imposent une prochaine étape de vérification ; aucun envoi ou remboursement n’est autorisé. La prose est contrôlée (schéma, références, budget, HTML/coordonnées/jargon/finance, verbes opérationnels sur les lignes prudentes), puis échappée pour Telegram. Cela ne prouve pas la vérité sémantique de chaque phrase : la recette humaine reste nécessaire.

## Bornes et repli

- Collecte initiale inchangée : 40 commandes, 3 pages de 100 traces, 24 événements + état, texte 700 caractères.
- Agent : 2 tours au plus, 8 demandes par tour, une lecture de dossier au plus par UUID et par enrichissement, cache partagé entre candidats (résultats et erreurs). Avant toute lecture, `resolve_order_id` valide le lien connu ou exécute seulement la requête fixe d'identité par adresse exacte du brouillon original ; cette résolution peut être répétée sans relire le dossier. Aucun rapprochement par nom ni cache persistant. 150 s de budget de recherche, 45 s par sous-processus IA, chaque outil limité globalement à 20 s (résolution incluse ; SQL au plus 15 s, projection au plus 5 s). Les dossiers restant hors budget ne sont pas confirmés.
- Outil : 25 lignes par source (125 maximum), 262 144 octets bruts au plus, 200 brouillons locaux / 1 Mio, 24 événements retenus. Une source qui atteint 25 lignes reste limitée, même si elle pourrait être complète. Texte de recherche approfondie jusqu'à 6 000 caractères par preuve ; un body email stocké de 5 000 caractères est signalé tronqué. Cette lecture approfondie peut lever le simple tronquage initial à 700 caractères ; elle ne lève pas un brouillon lui-même tronqué, une ambiguïté ou une source réellement tronquée.
- Payload final toujours 60 000 octets / 40 candidats ; sortie 20 000 octets, 4 preuves par décision ; 20 brouillons associés par candidat. Le dépassement donne une relecture indisponible, jamais une confirmation partielle. Modèle actuel gpt-6-luna ; aucune dépendance nouvelle.
- Ni boîte IMAP complète, ni suivi transporteur/fournisseur externe : une preuve enregistrée dans la base ne prouve pas ces systèmes. Aucune mutation métier, client, email, remboursement, état local ou brouillon dans l'outil.
- Le masquage partagé reste heuristique, pas une garantie universelle d'anonymisation de toute prose obfusquée. Les tests d'injection prouvent la fermeture du protocole et des références, pas la résistance sémantique absolue du modèle.
- Rédaction : un seul appel supplémentaire (45 s processus, 35 s adapter, 4 000 tokens), 60 000 octets d'entrée, 16 000 de sortie, huit groupes maximum et compteur local des éléments non affichés. Chaque souci/suite est limité à 220 caractères (cible 150) et leur total à 2 100 unités UTF-16 ; budget de rendu HTML puis plafond final 3 900 unités, réservant la place au suffixe du refresh. Un groupe trop volumineux ou une sortie invalide fait échouer tout le lot, sans acceptation partielle, réparation automatique ou cache de prose périmée.
- Indisponibilité : mention explicite « repli automatique, pas un texte rédigé par l’agent », vérifications uniquement, sans token « oui b… » ni nouvelle autorisation. La finance calculée reste affichée si disponible. Une panne de rédaction n'est pas décrite à tort comme une panne de relecture.

## Tests hors connexion

Depuis `/home/hermes/projects/cartoonova` :

```sh
env -i PATH=/usr/bin:/bin HOME=/nonexistent TMPDIR="$TMPDIR" node --test ops/daily-brief/tests/*.test.mjs
env -i PATH=/usr/bin:/bin HOME=/nonexistent TMPDIR="$TMPDIR" PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 -m unittest discover -s ops/daily-brief/tests -p 'test_*.py' -v
```

Les régressions adverses couvrent le brouillon de 400 emojis projeté par le vrai Node puis relecture simulée trop confiante (veto `draft_text_limit`, distinct du tronquage d’historique), et toutes les permutations de candidats liés/non liés à A avec une commande B distincte, dont deux brouillons sans UUID résolus vers A. Les requêtes d'identité et les lectures de dossier sont comptées séparément via un db-tool jetable réellement exécuté, avec projection Node réelle, au même tour et entre deux tours : une seule lecture A et une seule lecture B. Le cache des erreurs et sa remise à zéro entre enrichissements sont également testés. Un brouillon exactement à 700 unités UTF-16 non tronqué reste admissible.

Les nouveaux tests font réellement passer un faux db-tool jetable par un sous-processus puis le vrai projecteur Node. Ils couvrent masquage avant IA, lecture approfondie >700 caractères, dates SQL à six décimales, protocole et modèle simulés, budget/tours/deadlines, environnement sans secrets métier, erreurs, SQL/outil/IDs injectés, recherche exacte sans UUID, plusieurs commandes, veto après découverte de nouvelles livraisons, constats sémantiques sans autorisation et conservation byte-identique des brouillons. Régressions finance/publication/preview/import runpy conservées.

## Recette réelle réalisée en lecture seule

Le 25/11/2026, les cinq brouillons en attente des dossiers cités ont été projetés localement puis réellement traités par l'agent gpt-6-luna, son outil db-tool et la relecture finale. Aucun appel à run.main, aucun envoi ni écriture de runtime.

Dernier résultat observé (instantané, les décisions IA peuvent varier) :
- Kerly, b1 : dossier consulté, 4 preuves, attente de réponse client selon l'échange cité ; aucune validation d'envoi affichée.
- Tanguy, b3 et b5 : deux dossiers distincts consultés, 2 preuves chacun ; adapter les brouillons aux échanges, sans fusion entre commandes.
- Tiffany, b7 : dossier consulté, 8 preuves ; tronquage initial levé par la lecture approfondie ; dernière recette : attente de réponse client, recette précédente : brouillon dépassé. Aucune suppression ni validation d’envoi. Cette variation confirme qu’un constat sémantique IA n’est pas une vérité métier indépendante.
- Nils, b17 : recherche effectuée par l'adresse exacte du brouillon original ; aucune commande trouvée. Blocage « aucune commande trouvée pour l’adresse exacte du brouillon », pas attribution par nom. La base ne permet pas de conclure qu'il n'existe pas d'échange ailleurs.

Vérification finale : 49 tests Python et 31 tests Node réussis ; `git diff --check` réussi. La relecture indépendante du diff et la validation d'activation restent au parent. Les résultats IA sont une aide, pas une attestation indépendante de tous les faits métier.

## Recette rédaction réelle — locale, non activée

Spec : `docs/specs/2026-11-25-programme-redaction-agent.md`. Tests : 75 Python et 33 Node réussis, imports runtime relocalisé et `git diff --check` compris. Les tests de publication utilisent uniquement une API simulée ; aucun transport réel n’est appelé.

La recette lecture seule a utilisé les cinq brouillons réels b1/b3/b5/b7/b17 : projection Node réelle, recherche agent avec `db-tool.py query`, relecture indépendante puis rédaction réelle gpt-6-luna. Le dernier appel de rédaction utilise le vrai sous-processus `hermes_inference.py --write` sur les preuves réelles venant de cette recherche, réutilisées dans le scratch ; ce n’est pas une seconde collecte exhaustive du site.

Aperçu privé en mode 0600 : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/programme-agent-apercu.html`. Il contient la prose réellement produite et validée ; seule la réinjection locale du label b7 a été corrigée en « Commande liée » pour ne pas faire croire qu’un nom non affichable signifie commande introuvable. Aucun email, téléphone, UUID ou lien privé n’est affiché. Les noms structurés locaux restent destinés à Ilyes, pas au modèle.

Résultats observés : b1 dans l’attente client ; b3 et b5 dans deux lignes distinctes avec leurs difficultés propres ; b7 lié mais sans nom affichable, dernier retour à vérifier ; b17 non relié, sans conclure à un client inexistant. La finance n’a volontairement pas été interrogée dans cette recette : elle apparaît indisponible, son calcul et son isolation de l’IA sont testés sur fixtures. Le dernier aperçu contient les trois parties et reste sous la limite Telegram.

Une recette réelle a aussi rencontré une relecture indisponible : l’agent a rédigé des vérifications uniquement et conservé cette limite. Une autre sortie de rédaction a été rejetée (longueur puis références) et a réellement déclenché le repli clair. Le prompt a été précisé (IDs exacts, quatre références max) et le plafond individuel fixé à 220 sans relever le budget global de 2 100 unités. Ces contrôles restent volontairement fermés : un futur texte non conforme donnera le repli, pas une correction opaque. La qualité sémantique et la fréquence des replis doivent être vérifiées par le parent avant activation.

Pour reproduire localement, le harness privé jetable `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/preview-agent-redaction.py` lance les fonctions sans `run.main` et sauvegarde l’aperçu. Sans option : nouvelles lectures réelles ; `--reuse` : preuves du scratch, pas une nouvelle collecte ; `--reuse --rereview` : relecture réelle supplémentaire avant rédaction. Il ne doit pas être copié au runtime ; il ne lit que les brouillons sources locaux et les requêtes fixes de l’outil. Les fichiers du scratch sont temporaires et privés.

## Correctifs après revue rédaction

Les trois contre-exemples bloquants sont couverts par `test_review_regression_*` : instruction cachée dans le souci, complétude contredisant une limitation pourtant citée, identité inventée. Ils passent par `write`, le vrai masquage Node puis `run.render`, avec sorties du modèle simulées ; les descriptions factuelles et la prose neutre libre restent acceptées. Un quatrième test couvre le budget des limites. Validation après correctifs : **79 tests Python / 33 tests Node réussis**, `git diff --check` réussi.

Chaque groupe affiché conserve désormais toutes ses limitations concrètes réinjectées depuis le script, y compris en repli ; si le budget ne suffit pas en repli, le groupe entier est explicitement omis, pas ses limites seulement. Contrôles lexicaux sur les deux champs prudents, rejet des affirmations usuelles de couverture complète/accès externe, majuscules limitées aux débuts de phrase neutres : ces filtres sont conservateurs et non universels. Des noms minuscules/obfusqués ou une paraphrase peuvent les contourner ; une seconde IA ne constitue pas une garantie sémantique. Voir les limites détaillées dans la spec.

Nouvel appel réel `--reuse` sur les preuves réelles déjà en scratch, sans nouvelle collecte : rédaction **agent**, aperçu **1 718 unités UTF-16**, mode **0600**, au même chemin. Les limites b17 sont visibles indépendamment des phrases de l’agent. Finance non interrogée, aucune publication. Correctifs locaux uniquement, pas d’activation.

## Synchronisation contrôlée — à effectuer par le parent seulement

Sources à copier ensemble sous les **verrous existants** :

```
collect.mjs
evidence.mjs
redaction.mjs
verification.py
hermes_inference.py
finance.mjs
enrichment.py
lookup.mjs
presentation.py
drafting.py
run.py
```

Sauvegarder les anciennes sources ; copier `run.py` en dernier ; ne pas laisser un mélange de versions. Le worker, les helpers partagés et les dépendances restent aux chemins existants. Le Python doit être celui d'Hermes (adapter importable). Vérifier les imports runpy depuis `/` et l'aperçu contrôlé avant publication. Ne copier ni tests, spec, états, `state.json`, `resolved-alerts.json`, `excluded-support.json`, lock, ni fichiers sous `state/`. Ne pas lancer la tâche et ne pas toucher au planning dans cette opération. Si le timeout de la tâche existante est trop court pour collecte + recherche (150 s) + relecture (45 s) + rédaction (45 s) + finance, le parent doit ajuster cette tâche via le registre, pas créer une nouvelle tâche. Revenir aux sources sauvegardées ensemble en cas de régression, sans restaurer d'anciens états d'envoi.
