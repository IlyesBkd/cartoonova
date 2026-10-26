# SEO-07 — modification fournisseur préparée, non appliquée

## Lecture réelle (26 octobre 2026)

Projet Vercel `cartoonova`, scope `ilyes-projects-6e11cf25`. Domaines vérifiés. L’apex est configuré avec `redirect: "www.cartoonova.com"`, `redirectStatusCode: 308`. `www` n’a aucune redirection de domaine. Le déploiement public lu correspond à `2528120e70c8e61720211eebbc5994319c9595d6`, pas au HEAD local `e613645a5a6a24a0a6114e097c6edbbbbe82e2e6` ni aux changements non commités.

`cache/closure-followup/http-chains-live.json` conserve 8 chaînes, lecture seule, sans cookies :

| Départ | Redirections | Destination |
|---|---:|---|
| HTTP apex `/` | 3 | HTTPS www `/en` |
| HTTP apex `/simpson?utm_source=closure-fixture` | 3 | HTTPS www `/fr/simpson?utm_source=closure-fixture` |
| HTTP www `/` ou `/simpson?...` | 2 | même destination finale |
| HTTPS apex `/` ou `/simpson?...` | 2 | même destination finale |
| HTTPS www `/` ou `/simpson?...` | 1 | même destination finale |

La première normalisation HTTP→HTTPS et la redirection de domaine sont exécutées en amont. Un changement de `proxy.ts` seul ne les retire pas.

## Correction locale effectivement exercée

La branche apex combine hôte HTTPS et locale/chemin ; la racine reste **307** car elle négocie pays/cookie. Les chemins fixes restent **308** et la query est conservée.

Le test HTTP du vrai build a révélé un défaut supplémentaire : `URL.host = "www.cartoonova.com"` conserve le port interne déjà présent dans l’URL. Correction locale : `cible.port = ""`. Test rouge puis vert avec et sans port, et contrôle HTTP du build final sur FR, US, cookie DE, chemin sans locale et chemin EN. Les API sont exclues du matcher : ne pas prétendre y avoir testé une redirection de page.

Preuves : `apex-port-red.tap`, `apex-port-green.tap`, `redirect-local-http.json`, `final-build-http.json` dans le cache du profil. Le test local contourne naturellement la redirection Vercel ; il ne simule pas une mutation de compte.

## Plan fournisseur réversible — nécessite un oui distinct

1. Publier d’abord le code approuvé et vérifier le bon SHA, l’alias et le repli apex. Garder le snapshot des domaines et les chaînes HTTP. **Aucune de ces opérations n’a été réalisée ici.**
2. Après autorisation de configuration distante, retirer seulement la redirection du domaine apex, sans supprimer le domaine, son certificat, son DNS ou le domaine www. Objectif : laisser la branche apex du proxy recevoir les requêtes HTTPS et combiner hôte + chemin/locale.
3. Payload préparé pour l’API `PATCH /v9/projects/cartoonova/domains/cartoonova.com`, scope connu :

```json
{"redirect": null}
```

Relire le domaine immédiatement : `redirect` doit être NULL ; ne pas se fier au seul code HTTP de PATCH. Conserver les autres champs. Le schéma officiel confirme `redirect` nullable : https://vercel.com/docs/rest-api/projects/update-a-project-domain (consulté en lecture seule). Le script ancien `scripts/vercel-redirection-apex.mjs` ne fait PAS cette opération : il rétablit/configure une redirection vers www et lit `.env.local`. Ne pas l’exécuter pour ce plan.
4. Rejouer les 8 chaînes avec et sans cookie et avec pays FR/US ; vérifier les 10 locales préfixées, conservation des queries, absence de boucles, 200 final. Attendu pour HTTPS apex : 1 saut au lieu de 2. Pour HTTP apex : 2 au lieu de 3 **si** l’upgrade HTTPS Vercel reste séparé comme observé. Ne pas promettre un saut unique HTTP sans preuve fournisseur ; le maintien de HTTPS et de la négociation linguistique prime.
5. Vérifier les canonical/hreflang/sitemap : toujours HTTPS www, chaque locale autonome, aucune négociation permanente de la racine.

### Retour immédiat à la configuration lue

Si une boucle, mauvaise langue, perte de query ou certificat apparaît : remettre sur le même endpoint et scope le payload exact suivant, puis relire le domaine ET les chaînes :

```json
{"redirect":"www.cartoonova.com","redirectStatusCode":308}
```

C’est un rollback de configuration, pas une suppression DNS ni une republication. Le plan réduit les sauts redondants ; il n’affirme aucun gain SEO/latence mesuré avant son application et sa vérification.
