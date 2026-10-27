# OPS-04 — campagne réelle de `npm test`, corrections après revue

## Résultat vérifié

Implémenté localement, non commité, non poussé et non publié. **16/16 tests ciblés réussis**, sans échec, skip, todo ou annulation : dix tests de campagne et six du runner. ESLint ciblé sur les six sources : code 0, sortie vide. Aucun build, lint global ou campagne globale lancé pour ces corrections.

Preuve reproductible : `tests/priority-ten-operations-report.json` contient le TAP complet, résultats réels, empreintes SHA-256 des six sources, correspondance avec les constats de revue et **14 observations détaillées**. Les cinq observations CLI contiennent manifeste, summary, registre, bilan local et codes de sortie. Le chemin CLI est réellement copié avec ses modules dans un dépôt jetable à une seule suite, sans récursivité de la campagne globale.

## Constats OPS corrigés

### OPS-REVIEW-01 — réservation exclusive avant démarrage

`beginAttempt` examine la dernière tentative sous le verrou de campagne. Une tentative réservée sans processus bloque immédiatement une autre réservation de la même tâche. Une tentative avec processus actif bloque également. La réservation ne peut donc plus être rendue obsolète avant son propre `startProcess` par un autre appelant.

Régression réelle : cinq processus Node indépendants tentent de réserver la même tâche, sans démarrer de processus entre les réservations. **RED observé : cinq gagnants au lieu d'un. GREEN : un gagnant et quatre rejets**, une seule tentative, exécution réelle du gagnant puis finalisation réussie. Les réservations échouées ne modifient pas le registre.

### OPS-REVIEW-02 — reprise après arrêt et assessment seulement

Une reprise exige désormais un résultat système et `stopped:true` pour le précédent processus. Pour une campagne `assessmentRequired:true`, elle exige aussi `assessed:true`, persisté seulement par `assessProcess`. Le résultat de sortie seul ne permet plus une reprise pendant le nettoyage TAP/PostgreSQL.

Deux régressions multiprocessus :

- Après `finishProcess(..., false)`, cinq repreneurs sont refusés. **RED : un gagnant indûment autorisé ; GREEN : zéro**, registre inchangé et finalisation toujours bloquée.
- Après sortie réelle avec code 7 et arrêt du groupe vérifié, cinq repreneurs sont refusés tant que l'assessment requis reste pending. **RED : un gagnant indûment autorisé ; GREEN : zéro**. Après assessment négatif mais nettoyage vérifié, une seule nouvelle réservation est autorisée ; la reprise réelle réussit, reçoit son assessment et produit le bilan passé attendu.

### OPS-REVIEW-A1 — aucun bilan de suite avant assessment

`CampaignStore.create(id, {assessmentRequired:true})` persiste le contrat de campagne. `finalize` refuse désormais tout processus non évalué pour ces campagnes, même si son code est zéro et son groupe arrêté. `claimFinal` reste impossible tant que ce verrou logique n'est pas levé. Le vrai `scripts/test.mjs` active explicitement ce flag ; les doublures CLI copient ce vrai fichier et les vrais modules, puis vérifient le flag et l'assessment persistés dans les cinq variantes.

Régression réelle : cinq finaliseurs Node indépendants, lancés après la sortie réelle du processus mais avant assessment. **RED : les cinq obtiennent un bilan passé ; GREEN : les cinq sont refusés**. Ensuite :

- assessment TAP négatif avec nettoyage vérifié → les finaliseurs ne peuvent obtenir qu'un bilan `failed`, dont un seul claim concurrent réussit ;
- assessment de nettoyage avec service non vérifié → bilan et claim restent bloqués, reprise également refusée.

Le test d'intégration CLI a lui-même été exécuté en RED avant activation du flag (`false !== true`), puis en GREEN sur les cinq variantes. Les commandes brutes restent compatibles : `assessmentRequired:false` par défaut, tests OPS existants conservés sans obligation artificielle d'assessment. Ce mode n'est pas adapté aux campagnes de suites.

## Intégration et régressions conservées

- `scripts/test.mjs`, utilisé par `npm test`, crée une campagne `tests-<UUID>` dans ses artefacts exclusifs. Identifiant dans `manifest.json`, `summary.json`, `campaign/<id>.json` et `campaign-final.json`.
- Chaque suite utilise réellement `beginAttempt` puis `runCampaignChild`. Le registre conserve tâche, tentative, processus, PID, résultat, état d'arrêt, assessment, fichier/log/TAP et nettoyage. Les notifications restent internes, jamais des alertes externes.
- Un bilan est finalisé après les contrôles puis consommé au plus une fois localement par `claimFinal`. Un arrêt non vérifié laisse la campagne non finalisée/non réclamée, écrit `blocked` et force l'échec.
- PostgreSQL : `pg_ctl stop` si PID présent, puis `pg_ctl status` code 3, absence du PID, conservation des codes/signaux/erreurs. Suppression seulement après arrêt vérifié. Cibles limitées aux nouveaux répertoires sous la racine courte exclusive de l'invocation ; aucune `DATABASE_URL` utilisée.
- Manifeste, partition disjointe, compteurs TAP, summary, lignes PASS/FAIL et codes de sortie sont conservés. Les observations imbriquées ne sont pas ajoutées aux compteurs globaux.
- Finalisation refusée pour une tentative sans processus ; `code:0` avec signal est un échec. Dernière tentative par tâche, résultat système et assessment sont pris en compte ; inventaire incomplet/interruption interdisent un bilan passé dans le CLI.

## Exercices existants rejoués

1. Démarrage raté réel (code 7), reprise réussie, événement tardif `obsolete-attempt`, huit claims concurrents et un gagnant ; aucune deuxième remise après finalisation.
2. Campagnes distinctes avec identifiants techniques identiques sans contamination ; événements dédupliqués ; cinq processus OS se disputant un claim avec un seul gagnant.
3. Descendant réel ouvrant un serveur TCP local et ignorant SIGTERM ; fin normale puis timeout ; zéro membre vivant du groupe vérifié dans `/proc`.
4. Refus de finaliser sans processus, avec processus actif ou arrêt non vérifié, et après nettoyage échoué. Refus de doublon de processus et traversée de chemin. Signal non nul interdit le succès.
5. Vrai CLI borné : succès → exit 0 ; skip → exit 1 ; assertion échouée → exit 1. Campagnes distinctes, manifeste/summary cohérents, flag requis et assessment persistés, claim unique.
6. Même CLI avec PostgreSQL 18 jetable réellement démarré sur socket Unix privé puis laissé par la suite : arrêt réel code 0, status 3, absence du PID et suppression vérifiés.
7. Même CLI avec fixture à PID périmé sans serveur réel : TAP passé, nettoyage non vérifiable, exit 1, `cleanupFailed:true`, aucun bilan réclamable, bilan local `blocked`. Fixture synthétique retirée par le test.
8. Runner : secrets/injection Node non hérités, logs bornés, timeout, codes non nuls, gardes Node/fetch/Chromium, comptabilité TAP stricte et partition exhaustive.

## Reproduction et comptage

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node scripts/operations-report.mjs
```

Le générateur lance uniquement `tests/operations-campaign.test.mjs` et `tests/test-runner.test.mjs`, puis ESLint ciblé. Ces fichiers seront découverts par la campagne globale : **ne pas ajouter ces 16 tests ciblés une seconde fois au total global**. Les suites synthétiques ne sont pas des fichiers supplémentaires du manifeste global.

## Limites et périmètre

- Pas de changement passerelle/configuration/cron Hermes, message Telegram/email, commit/push/Trello. `scripts/__pycache__` préservé. Aucun fichier build/CSP de l'autre agent touché.
- L'avis non OPS `OPS-REVIEW-A2` relatif au guide cadeau est hors de la propriété de cet agent ; aucune correction de ce fichier n'est revendiquée ici.
- Une réservation sans démarrage après crash reste bloquée volontairement et exige inspection manuelle ; aucun abandon automatique ne peut concurrencer un propriétaire actif. Même principe pour un verrou abandonné.
- Le contrat requis est persistant et lu par tous les consommateurs ; les anciens registres/commandes brutes sans flag restent en mode brut. Il faut créer une nouvelle campagne de suites avec `assessmentRequired:true`, pas réutiliser un ancien registre sans ce contrat.
- Remise locale au plus une fois, pas livraison distante exactement une fois. Un crash après claim avant écriture du bilan exige réconciliation manuelle ; aucune relance aveugle.
- Vérification Linux des groupes hors zombies, sans garantie face à un `setsid` délibéré ; PostgreSQL vérifié séparément selon la convention des fixtures `pg`.
- Écriture atomique pour reprise après redémarrage de processus, sans promesse de durabilité électrique sans fsync.
