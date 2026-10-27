# SEO-07 — vérification de l'état publié existant

## Résultat

Le défaut de trois sauts est **déjà corrigé en production**, contrairement au dernier commentaire historique de la carte. Aucune configuration distante n'a été modifiée pendant cette intervention.

Lecture CLI Vercel réelle : `cartoonova.com` et `www.cartoonova.com` ont tous deux `redirect:null`. Dernière production READY/PROMOTED : `dpl_4vUcX42ywKTh4VTn4dbm34zX6NLQ`, SHA `0abc3ab8c237de665858f27ddd77d99214a9bc72`, cible production. Les contrôles HTTP suivants concernent directement l'alias public, pas seulement l'URL de déploiement.

## Contrôles réellement exécutés

- Huit chaînes HTTP/HTTPS, apex/www, racine et ancien chemin `/simpson` avec query : toutes aboutissent à HTTP 200 sans boucle.
- HTTP apex : deux sauts, contre trois dans l'ancienne preuve ; HTTPS apex : un saut, contre deux auparavant.
- Dix locales : 308 apex vers la même locale sur HTTPS www, query conservée ; destination 200 avec canonical HTTPS www de la bonne locale.
- Racine avec choix explicite FR/EN/DE : 307 vers la langue choisie et query conservée.
- Total des assertions locales/canonical/cookies : **23/23 réussies**. Huit chaînes vérifiées séparément, sans addition de compteurs de suites.

Un premier contrôle utilisait à tort `NEXT_LOCALE` ; le code déclare `cartoonova_langue`. La sonde corrigée utilise le vrai cookie et réussit. L'essai initial est conservé dans les preuves et n'est pas présenté comme un bug applicatif.

## Preuves et limites

Preuves privées du profil Cartoonova : `cache/priority-ten/apex-live-chains.json` et `cache/priority-ten/apex-locale-checks.json`. Aucun secret ni contenu client dans ces fichiers.

Le saut HTTP→HTTPS restant est normal ; ne pas promettre un seul saut HTTP ni un gain de classement ou de latence non mesuré. Le script ancien `scripts/vercel-redirection-apex.mjs` reconfigurerait une redirection www : il n'a pas été exécuté et ne doit pas être utilisé pour reproduire cette configuration. Aucune nouvelle interface visible n'a été modifiée, donc aucune capture de nouvelle interface n'est nécessaire pour cette carte.

Carte clôturable sur la base de ce comportement publié vérifié, après relecture finale Trello par le parent. Les autres cartes du lot ne sont pas clôturées par déduction.
