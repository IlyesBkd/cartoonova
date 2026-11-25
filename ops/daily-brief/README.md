# Programme Cartoonova : recherche active avant relecture

Sources locales uniquement, conformément à `docs/specs/2026-11-25-programme-enrichissement-actif.md` (suite du bilan vérifié du 24/11). **Aucune synchronisation runtime ni modification cron par ce chantier. Ne pas exécuter run.py ici pour une recette isolée** : ses états et transports restent ceux de la production, même en preview le verrou runtime serait ouvert.

## Circuit

1. `run.py` conserve collecte, finance, résolutions locales, exclusions support, calendrier et publication existants. Il insère `enrich(...)` avant `review(...)` pour le programme et les refresh.
2. `enrichment.py` fait planifier les lectures par gpt-6-luna : protocole JSON strict `requests: [{tool: inspect_dossier, candidateId: candidate-N}]`. Ce sont des **demandes d'outil effectivement exécutées par le processus de confiance**, pas un prompt prétendant avoir consulté des sources. Le modèle ne reçoit ni SQL, shell, URL, UUID ou coordonnées et ne peut choisir qu'un candidat de la collecte. Il n'a pas d'outil fournisseur natif : le petit driver assure la validation, les appels bornés et la transmission des preuves à la relecture finale. Une sortie malformée n'est jamais exécutée.
3. `inspect_dossier` relit les sources via le seul `python $HERMES_HOME/scripts/db-tool.py query`, transaction lecture seule imposée. Requête fixe : état, messages entrants/sortants, livraisons, retouches et réponses préparées explicitement reliées (target order ou frozen_order_id). Les brouillons locaux en attente sont relus sans modification. Si le brouillon n'a pas d'UUID, l'adresse exacte du brouillon original local peut rechercher une commande ; zéro résultat ou plusieurs résultats donne un blocage distinct. Un nom n'est jamais une clé de rapprochement ; un UUID mal formé n'est jamais réparé.
4. `lookup.mjs` réutilise `projectOrderContext` et le masquage partagé avant tout retour au modèle. Les échanges liés à une autre commande sont exclus ; un échange non assigné n'est utilisable que pour une adresse exacte avec une seule commande. Les brouillons associés restent des propositions, jamais des preuves d'envoi. Noms affichés masqués s'ils sont des coordonnées ; UUID, noms et finance exclus du payload IA.
5. La relecture indépendante conserve les veto déterministes : limitations, photos incomplètes non prouvées, impression non validée, portrait déjà envoyé, etc. Les nouveaux envois découverts par l'outil réappliquent les veto des brouillons et demandes photos. Un retrait sémantique IA reste visible, il ne supprime aucune source. Les exclusions sont uniquement locales/exactes ou état terminal.
6. La sortie optionnelle `finding` est un code fermé : action, awaiting_customer, draft_superseded, draft_update, refund_requested, unknown. Elle exige des références à des échanges, pas un état seul ; limitations => unknown. Une attente client exige un sortant sans entrant/retouche postérieur ; un brouillon dépassé exige un envoi postérieur à sa création ; un remboursement nécessite une preuve entrante et reste une **décision humaine**, aucun appel de remboursement. Ces constats sémantiques restent tributaires de la qualité du modèle ; ils n'autorisent jamais seuls un envoi.
7. `presentation.py` rend des libellés fixes, sans prose libre IA et avec regroupement strict par UUID. Plusieurs commandes d'une personne restent distinctes. Une commande non liée ne fusionne jamais avec une autre. Les blocages indiquent la source, l'attribution ou le budget réellement en cause, pas « preuves limitées ».

## Bornes et repli

- Collecte initiale inchangée : 40 commandes, 3 pages de 100 traces, 24 événements + état, texte 700 caractères.
- Agent : 2 tours au plus, 8 demandes par tour, une lecture de dossier au plus par UUID et par enrichissement, cache partagé entre candidats (résultats et erreurs). Avant toute lecture, `resolve_order_id` valide le lien connu ou exécute seulement la requête fixe d'identité par adresse exacte du brouillon original ; cette résolution peut être répétée sans relire le dossier. Aucun rapprochement par nom ni cache persistant. 150 s de budget de recherche, 45 s par sous-processus IA, chaque outil limité globalement à 20 s (résolution incluse ; SQL au plus 15 s, projection au plus 5 s). Les dossiers restant hors budget ne sont pas confirmés.
- Outil : 25 lignes par source (125 maximum), 262 144 octets bruts au plus, 200 brouillons locaux / 1 Mio, 24 événements retenus. Une source qui atteint 25 lignes reste limitée, même si elle pourrait être complète. Texte de recherche approfondie jusqu'à 6 000 caractères par preuve ; un body email stocké de 5 000 caractères est signalé tronqué. Cette lecture approfondie peut lever le simple tronquage initial à 700 caractères ; elle ne lève pas un brouillon lui-même tronqué, une ambiguïté ou une source réellement tronquée.
- Payload final toujours 60 000 octets / 40 candidats ; sortie 20 000 octets, 4 preuves par décision ; 20 brouillons associés par candidat. Le dépassement donne une relecture indisponible, jamais une confirmation partielle. Modèle actuel gpt-6-luna ; aucune dépendance nouvelle.
- Ni boîte IMAP complète, ni suivi transporteur/fournisseur externe : une preuve enregistrée dans la base ne prouve pas ces systèmes. Aucune mutation métier, client, email, remboursement, état local ou brouillon dans l'outil.
- Le masquage partagé reste heuristique, pas une garantie universelle d'anonymisation de toute prose obfusquée. Les tests d'injection prouvent la fermeture du protocole et des références, pas la résistance sémantique absolue du modèle.

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
run.py
```

Sauvegarder les anciennes sources ; copier `run.py` en dernier ; ne pas laisser un mélange de versions. Le worker, les helpers partagés et les dépendances restent aux chemins existants. Le Python doit être celui d'Hermes (adapter importable). Vérifier les imports runpy depuis `/` et l'aperçu contrôlé avant publication. Ne copier ni tests, spec, états, `state.json`, `resolved-alerts.json`, `excluded-support.json`, lock, ni fichiers sous `state/`. Ne pas lancer la tâche et ne pas toucher au planning dans cette opération. Si le timeout de la tâche existante est trop court pour collecte + recherche (150 s) + relecture (45 s) + finance, le parent doit ajuster cette tâche via le registre, pas créer une nouvelle tâche. Revenir aux sources sauvegardées ensemble en cas de régression, sans restaurer d'anciens états d'envoi.
