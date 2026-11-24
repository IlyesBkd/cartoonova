# Contexte client des notifications — validation locale

## Livraison préparée, non activée par ce sous-lot

- `scripts/customer-notification-context.mjs` : projection commune en lecture seule ; appelle **le vrai `lib/customerHistory.ts` via `tsx/esm/api.tsImport`**, sans modifier cet agrégateur. Les échanges support utilisent deux petites lectures exact-email, car l’admin autorise aussi les rattachements explicites à des commandes/tiers qui ne doivent pas étendre une identité en inférence.
- Chat/contact : `scripts/chat-telegram-worker.mjs` fournit `bodyText` = nouveau message seulement et `context` structuré séparé. L’ancien export `loadHistory` reste disponible, sans fenêtre 48 h.
- Email : `ops/support-context-v1/context.mjs`, `worker.mjs`, `hermes_inference.py` (schéma 2 strict, schéma 1 conservé).
- `scripts/telegram-progressive.mjs` affiche un résumé français de la même source structurée que celle envoyée à l’inférence : 3 commandes, 2 échanges et 6 traces au plus, dates de Paris. La limite et le nombre de traces réellement fournies au brouillon sont visibles. Les IDs, états, leases et fences ne sont pas changés.

## Choix et limites visibles

Identité = adresse exacte normalisée (casse et espaces), jamais nom ni destinataire cadeau. Toutes les commandes sont éligibles, payées ou non. Plusieurs commandes sans lien explicite : aucune choisie. Lien explicite étranger ou contradictoire : contexte fermé. Le lien explicite ancien est prioritaire sur la limite de commandes.

Contexte limité à 8 commandes, 12 échanges antérieurs (700 caractères chacun), 24 traces agrégées, 3 pages de 100 examinées au plus, 4 déclarations fournisseur au plus. La notification expose les bornes et l’historique non consulté. Les états actuels sont explicitement observés ; l’historique support utilise le cutoff SQL exact à la microseconde, pas l’heure actuelle. Les dates inconnues ne sont pas inventées. Les traces postérieures au message ne deviennent pas des échanges antérieurs. Les programmations sont des dates prévues, pas des envois.

La projection n’envoie ni payload fournisseur, ni détails de livraison cadeau, destinataire tiers, lien/jeton privé, ni corps d’email automatisé/journal en inférence. Les notes de retouche et extraits support sont expurgés (URLs, emails, téléphones, adresses usuelles, noms composés, secrets usuels). Comme toute expurgation de prose libre, elle n’est pas une reconnaissance sémantique exhaustive de toutes les formes possibles de données personnelles. Les titres/traces, états et données produit sont bornés/explicitement sélectionnés. Pas d’extension de l’identité à l’email d’une commande contradictoire.

Les anciennes données ou sources non disponibles ne sont pas reconstruites. Si l’agrégateur échoue (ou `tsx` est absent), les échanges exacts et commandes déjà chargés restent disponibles avec un avertissement. Les pièces/livraisons historiques sont décrites par leur trace, pas chargées depuis des URLs. Aucune retouche déduite d’un numéro de version.

## Commandes de recette (sans secrets, PostgreSQL et SQLite jetables)

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/notification-customer-context.test.mjs tests/chat-grouping.test.mjs tests/telegram-email.test.mjs tests/telegram-progressive.test.mjs tests/chat-context-fr.test.mjs tests/chat-context-cli.test.mjs tests/chat-telegram-worker.test.mjs tests/chat-draft.test.mjs tests/customer-history.test.mjs
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" python3 -B tests/notification-context-schema.test.py
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npx eslint scripts/customer-notification-context.mjs scripts/chat-telegram-worker.mjs scripts/telegram-progressive.mjs ops/support-context-v1/context.mjs ops/support-context-v1/worker.mjs tests/notification-customer-context.test.mjs
```

Inférence, fournisseur et Telegram simulés. L’aperçu fictif est produit par le test dans `/home/hermes/.hermes/profiles/cartoonova/cache/notification-context-preview.txt`, sans envoi.

## Activation à faire par le parent, après revue et ses vérifications

1. Garder les chemins de checkout des scripts chat/transport/projection et `lib/customerHistory.ts` ; garder `tsx` installé dans le checkout VPS (`node_modules` actuel). Aucun nouveau service ni migration n’est requis par cette projection.
2. Synchroniser les **trois fichiers email modifiés** dans la copie active, après sauvegarde des fichiers : `context.mjs`, `hermes_inference.py`, `worker.mjs`. Les autres fichiers du relais progressif (`inference.mjs`, `supplier.mjs`, `run.py`) doivent déjà être ceux décrits dans `PROGRESSIVE.md` ; sinon appliquer sa procédure de synchronisation complète. Préparer les fichiers puis remplacement atomique par fichier, dans une fenêtre sans exécution concurrente du worker pour éviter le mélange schéma 1/2 pendant le lot.
3. Exemple de copie ciblée à exécuter seulement par le parent :

```python
from pathlib import Path
import os, shutil
source=Path('/home/hermes/projects/cartoonova/ops/support-context-v1')
target=Path('/home/hermes/.hermes/profiles/cartoonova/artifacts/support-context-v1')
for name in ('context.mjs','hermes_inference.py','worker.mjs'):
    staged=target/(name+'.staged')
    shutil.copyfile(source/name,staged)
    staged.chmod(0o700 if name.endswith('.py') else 0o600)
    os.replace(staged,target/name)
```

4. Vérifier l’égalité des trois fichiers source/cible sans afficher leur environnement ; observer le prochain passage normal et son édition progressive. Ne pas forcer `--send` pour une preuve. Les entrées déjà `done` ne sont pas réécrites et les contenus `desired` déjà persistés restent les mêmes : seuls les enrichissements à venir prennent ce contexte.

Ne jamais copier/supprimer/réinitialiser une base SQLite, `items`, `meta`, les IDs, les anciens `sent`, ni un fence d’incertitude. Aucun commit/push/build, déploiement, changement cron/service ou envoi réel exécuté dans ce sous-lot.
