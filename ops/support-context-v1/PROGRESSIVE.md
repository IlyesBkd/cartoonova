# Relais Telegram progressif — source et activation

## Source testée

- Chat/contact : `scripts/chat-telegram-worker.mjs`.
- Journal/transport/pagination commun : `scripts/telegram-progressive.mjs`.
- Réponse bilingue : `scripts/telegram-bilingual.mjs`.
- Email : `ops/support-context-v1/{worker,context,inference,supplier}.mjs` et `hermes_inference.py`.
- Wrapper email proposé : `ops/support-context-v1/run.py`.

Les fichiers email de ce répertoire sont les sources à synchroniser, pas une seconde tâche planifiée. Les tests importent ces sources. Les wrappers et destinations restent ceux existants. Aucun secret dans ce répertoire.

## État durable

La table additive `telegram_progressive_v1` est ajoutée au fichier SQLite existant. Pour chat : `CHAT_NOTIFY_TRANSLATION_STATE` ou `state/chat-translation-followups/queue.sqlite` du profil Cartoonova. Pour email : connexion SQLite existante `SUPPORT_NOTIFY_STATE` (donc pas de bascule WAL/DELETE entre connexions). `items`, `meta`, `chat_followups` et les anciens `sent` restent conservés. Les anciens followups sans identifiants Telegram ne sont jamais envoyés.

Original : claim PostgreSQL pour chat ; claim `items` pour email ; fence locale avant Telegram ; chaque `message_id` confirmé est persisté immédiatement, avant contexte/inférence. Premier envoi ambigu ou continuation ambiguë : pas de nouvel envoi automatique. Une référence entièrement persistée permet la reprise après crash entre accusé Telegram et statut final. L'édition conserve le texte désiré et les identifiants ; lease propriétaire renouvelée par partie, expiration récupérable, `message is not modified` idempotent. Échec d'inférence : reprise ultérieure et rotation vers les autres entrées.

`TELEGRAM_RECEIVE_ONLY=1` ne fait que réception/persistance, sans contexte, cache de traduction ni inférence. Le listener gère les deux lanes ; mode normal reçoit d'abord tous les originaux éligibles, puis enrichit une entrée. CLI chat `settleSeconds=0`. Regroupement ancien reste injectable aux tests, et historique exact-expéditeur reste disponible au brouillon.

Adaptateur : ancien plafond silencieux 2000 supprimé. Nouveau plafond explicite 100000 caractères, enveloppe entrée/sortie 1 MiB. Au-delà, original intégral notifié mais enrichissement non inventé. JSON obligatoire `language/messageFR/draftClient/draftFR`, langue du nouveau message distincte de celle de la commande. Un brouillon est seulement proposé, aucun envoi client possible.

## Activation contrôlée par le parent, après revue

Les fichiers du runtime email ont été restaurés à leur version initiale après préparation ; aucune activation email définitive effectuée. La CLI chat pointe déjà vers le nouveau code du dépôt (les crons existants utilisent ce chemin). Ne pas lancer de vrai `--send` pour tester.

Après sauvegarde des fichiers runtime et avant observation de la prochaine exécution normale, copier **atomiquement** chacun des fichiers source ci-dessous vers le même nom dans `/home/hermes/.hermes/profiles/cartoonova/artifacts/support-context-v1/` :

```
worker.mjs context.mjs inference.mjs supplier.mjs hermes_inference.py run.py
```

Commande de synchronisation, depuis le dépôt (à exécuter par le parent après revue uniquement) :

```python
from pathlib import Path
import os, shutil
source = Path('/home/hermes/projects/cartoonova/ops/support-context-v1')
target = Path('/home/hermes/.hermes/profiles/cartoonova/artifacts/support-context-v1')
for name in ('context.mjs', 'supplier.mjs', 'inference.mjs', 'hermes_inference.py', 'worker.mjs', 'run.py'):
    staged = target / (name + '.staged')
    shutil.copyfile(source / name, staged)
    staged.chmod(0o700 if name.endswith('.py') else 0o600)
    os.replace(staged, target / name)
```

Ne pas remplacer/supprimer SQLite, ne pas réinitialiser `meta`, ne pas réinsérer les anciens messages `sent`. Aucun changement cron/service/secrets n'est nécessaire dans ce sous-lot. Le parent installe/observe le listener et vérifie de vrais passages cron après revue.

## Vérification isolée

```
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/chat-telegram-worker.test.mjs tests/chat-grouping.test.mjs tests/chat-context-fr.test.mjs tests/chat-context-cli.test.mjs tests/chat-draft.test.mjs tests/telegram-progressive.test.mjs tests/telegram-email.test.mjs
```

PostgreSQL jetable, SQLite jetable, fetch/inférence simulés. Le test CLI exécute réellement le point d'entrée ; le test crash termine réellement deux processus après persistance d'IDs puis pendant édition. Aucune connexion à la base ou au transport réels.
