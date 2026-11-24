# Support préparé : diagnostic local et correction sans renvoi

## Établi / hypothèse

L'incident fourni (brouillon `397b8c67-a0ec-4e85-850f-f4b8055c5791`, fournisseur `01a20fc6-54a7-7ad9-aaab-1dba3981e674`, réparation reply24 déjà effectuée) prouve un checkpoint fournisseur durable sans projection support initiale. Aucune nouvelle lecture/écriture production n'a été faite dans cette investigation.

Trois défaillances concrètes sont reproduites avec le code HEAD 0c2ee5c sur PostgreSQL 18 jetable :

1. Une erreur transactionnelle transitoire d'historique (SQLSTATE 40001 ; également véritable attente de verrou au-delà de 3 s dans la suite corrigée) annule l'insertion, sans nouvelle tentative automatique. Le fournisseur reste accepté ; l'erreur originale était remplacée par un message générique, sans code de diagnostic.
2. La lecture du brouillon par la réconciliation utilisait encore le pool global à une connexion, avant les timeouts de la transaction fraîche. Une occupation indépendante de ce pool bloque donc l'historique après acceptation.
3. La perte de la connexion portant le lease peut rejeter `begin()` alors que le checkpoint indépendant est validé ou encore en cours. Le code précédent sort avant d'appeler la réconciliation. Une vraie terminaison `pg_terminate_backend` du lease après validation du checkpoint reproduit cet état.

Ces mécanismes sont établis comme défauts du code, **pas comme cause historique certaine de l'incident réel** : aucune erreur brute/code SQLSTATE de cet incident n'est disponible ici. Verrou, tunnel/connexion et saturation restent des hypothèses d'origine. La migration customer_history n'ajoute aucun trigger sur support_replies ; son trigger orders ne journalise pas last_outbound_message_id. Son schéma et ses triggers ont été chargés dans les nouvelles fixtures sans défaut systématique. Aucun élément n'accuse ce trigger.

## Correction

- Réessayer uniquement la persistance après acceptation : checkpoint et transaction complète de réconciliation, trois tentatives au plus avec pauses de 100 puis 300 ms, erreurs transitoires explicitement sélectionnées. Jamais de répétition du transport ou du claim.
- Lire et vérifier le snapshot dans la même connexion fraîche/transaction bornée que l'historique (lock_timeout 3 s, statement_timeout 5 s).
- Après perte d'accusé du checkpoint, reconnaître exclusivement le même provider_id déjà confirmé, sans changer sa date.
- Après perte du lease, attendre le checkpoint indépendant déjà démarré, puis réparer l'historique seulement. Si aucun checkpoint accepté n'existe, l'exception reste incertaine et aucun renvoi n'est tenté.
- Conserver le verrou global, le claim durable, l'approbation figée, le CAS du marqueur outbound, l'idempotence reply_id/pièces jointes, les protections SQL et les routes existantes. Diagnostics phase/tentative/code seulement, aucune donnée client.
- Pas de modification du journal email central, de schéma ou de migration. L'ajustement ciblé de la route prepared-send à la suite de l'audit est décrit ci-dessous.

## Commandes et résultats

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --import tsx --test --test-concurrency=1 tests/support-history-retry.test.mjs tests/support-prepared-replies.test.mjs tests/support-provider-recovery-isolated.test.mjs tests/customer-history.test.mjs
```

Résultat final : **63 tests réussis, 0 échec**, incluant 9 nouveaux tests PostgreSQL/pannes. Couverture : transactions réellement annulées, verrou réellement observé dans pg_stat_activity, panne persistante bornée puis quatre réparations concurrentes, double clic pendant retry, perte simulée d'accusé après vrais commits checkpoint/historique, véritable terminaison du lease, pool à une connexion occupé, fournisseur tardif et crash de processus (régressions existantes). Un seul appel fournisseur simulé, une réponse et une pièce jointe aux scénarios concernés ; texte/octet/provider/date vérifiés.

Contre-épreuves sur le code HEAD, sans modifier les fichiers :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" SUPPORT_HISTORY_BASELINE=1 node --import tsx --test --test-name-pattern='real PostgreSQL aborted' tests/support-history-retry.test.mjs
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" SUPPORT_HISTORY_BASELINE=1 node --import tsx --test --test-name-pattern='shared single-connection pool saturation' tests/support-history-retry.test.mjs
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" SUPPORT_HISTORY_BASELINE=1 node --import tsx --test --test-name-pattern='real lease connection termination' tests/support-history-retry.test.mjs
```

Les trois échouent comme attendu sur HEAD : historique à réparer, lecture bloquée derrière le pool, CONNECTION_CLOSED respectivement. Les mêmes scénarios passent après correction.

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm run lint
git diff --check
```

Lint : 0 erreur, 30 avertissements hors fichiers modifiés. Diff check réussi. Un premier lancement multi-fichiers parallèle a rendu le test historique de crash/délai instable ; le lancement séquentiel ci-dessus est passé à plusieurs reprises. Le test ajouté a aussi été corrigé avant le résultat final (injection initiale sur phase vide).

Tentative `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" ./node_modules/.bin/tsc --noEmit --incremental false` bloquée par le garde de cycle de vie (fichier TypeScript > plafond de scan) : **aucune validation TypeScript complète revendiquée**. Aucun contournement du garde.

Aucun envoi réel, aucune opération production, aucun build, migration production, commit ou push. Audit indépendant et build isolé sont laissés au parent avant publication. La correction ne garantit pas la réparation d'une panne persistante ni la survie à un arrêt définitif du processus ; la réparation explicite sans renvoi reste nécessaire dans ces cas.

## Correction du bloquant API après audit

L'audit avait raison : malgré la correction de la bibliothèque, le catch de `prepared-send` relisait encore le pool partagé. Les contre-épreuves sur la route HEAD reproduisent les trois écarts : pool fermé après acceptation → faux « Envoi refusé » et état unknown ; pool occupé → dépassement de la deadline ; pool fermé avant toute preuve → unknown présenté comme refus certain.

- `PreparedSupportAcceptedError` transporte exclusivement `state: sent` et `needsHistoryRepair: true`, avec un message fixe, sans cause brute, donnée client ni provider_id. Elle est levée après acceptation si checkpoint ou réconciliation échoue. Elle ne prouve jamais la livraison dans la boîte du client.
- La route ne relit plus aucune base dans son catch. Erreur typée acceptée → HTTP409, état `sent`, `needsHistoryRepair: true`, message exact `Email accepté : l'historique doit être réparé sans renvoi.` ; toute autre exception → HTTP409, état `unknown`, message exact `Envoi incertain : vérification obligatoire, ne pas renvoyer.` La validation syntaxique explicite conserve son HTTP400. Aucune erreur brute n'est exposée, même si ses propriétés ressemblent à l'erreur typée.
- Sept nouveaux tests exécutent le vrai handler Next, la bibliothèque et PostgreSQL18 jetable ; seuls l'authentification, le fournisseur et la création des connexions sont injectés. Ils couvrent pools réellement fermé/occupé après épuisement de trois tentatives d'historique, panne initiale sans preuve, succès, approbation syntaxiquement invalide, exception fournisseur ambiguë avec pool occupé et double clic, puis trois transactions de checkpoint avortées après acceptation. Les délais des réponses sont bornés à 1800ms dans ces injections SQL immédiates ; cela ne prétend pas borner à 1800ms une véritable attente de verrou/connexion production.
- Deux attentes d'anciens tests API sont adaptées au contrat prudent unknown, avec vérification séparée des états PostgreSQL prepared/sending inchangés et de l'absence de second transport.

Commandes vérifiées :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" SUPPORT_SEND_ROUTE_BASELINE=1 node --import tsx --test --test-name-pattern='real prepared-send route: (exhausted history|closed pool before)' tests/support-history-retry.test.mjs
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --import tsx --test --test-concurrency=1 tests/support-history-retry.test.mjs tests/support-prepared-replies.test.mjs tests/support-provider-recovery-isolated.test.mjs tests/customer-history.test.mjs
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm run lint
```

Contre-épreuve HEAD : **3 échecs attendus**, dont la deadline pool occupé. Suite finale : **70 tests réussis, 0 échec** (63 existants +7 nouveaux). Premier passage : 68/70, les deux écarts étaient les anciennes attentes prepared/sending dans les réponses API ; aucun changement des assertions de sécurité PostgreSQL pour les faire passer. Lint : 0 erreur, 30 avertissements hors fichiers concernés.

Limites : si le fournisseur a accepté mais les trois checkpoints échouent, l'API conserve cette acceptation en mémoire dans sa réponse, tandis que la base reste sending sans provider_id. Une simple réconciliation ne suffit alors pas : la récupération existante avec preuve fournisseur reste nécessaire, jamais un renvoi. Après arrêt du processus, aucune preuve uniquement en mémoire ne survit. Tests par invocation du vrai handler et vraies réponses NextResponse, sans serveur HTTP Next démarré ; pas de build ni validation TypeScript complète dans cette tranche. Aucun fichier support.py partagé, autre métier, service actif ou système production touché.
