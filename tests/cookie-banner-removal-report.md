# Suppression locale du bandeau cookies

## Décision finale et périmètre

- Bandeau automatique supprimé, y compris son composant et son chargement dans le provider global.
- Selon la dernière instruction utilisateur, PostHog navigateur est activé par défaut pour un nouveau visiteur sans choix enregistré, si une clé publique est configurée. Aucun accord explicite n'est artificiellement écrit dans Storage pour ces visiteurs.
- Les choix `denied` et `pending`, retraits en mémoire/fragment et erreurs de Storage restent bloquants. Les accords explicites existants sont conservés. Le filtre trafic interne/robots, Do Not Track et les refus propres au SDK restent en place : « tous » ne signifie pas contourner ces protections.
- Dans les pages légales accessibles par le pied de page, « Modifier mes préférences cookies » ouvre uniquement sur demande les commandes Accepter / Refuser. Ouvrir ce panneau ne modifie pas le choix.
- Retrait via le vrai SDK : opt-out, suppression des files batch/retry, puis rechargement contrôlé. Le retrait reste testé entre deux vrais onglets et avec Storage en échec ; supprimer le choix dans un autre onglet reste un retrait, pas une nouvelle visite.
- Scrubbing, masquage des identités privées et désactivation du replay conservés. Pixel publicitaire ChatGPT toujours désactivé. Attribution serveur, facturation, paiement et transport email non modifiés.
- Notices cookies mises à jour dans dix langues et retrait des anciennes affirmations contradictoires sur l'opt-in des cookies / ChatGPT Ads actif dans les documents légaux.

**Aucune validation juridique ou de conformité.** L'activation par défaut d'une mesure d'audience non essentielle sans opt-in présente un risque de conformité ; la demande du propriétaire ne constitue pas le consentement des visiteurs. Aucune exemption n'est revendiquée. Travail local uniquement, aucun push ni publication.

## Vérifications réellement exécutées

- TDD Chromium : échec attendu sur l'absence initiale d'interface de préférences utilisable ; après changement de demande, échec attendu `0 !== 1` sur le chargement par défaut ; échec `granted !== pending` sur le retrait inter-onglets par suppression Storage. Corrections puis tests verts.
- Tests ciblés :
  `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --import ./scripts/test-network.mjs --test tests/ten-cards-consent.test.mjs tests/ten-cards-consent-ui.test.mjs tests/ten-cards-consent-adversarial.test.mjs`
  → **11 tests réussis**, zéro échec/skip.
- `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm test` : inventaire complet de **48 fichiers**. Premier passage sorti 1 sur deux doublures analytics devenues incomplètes dans les suites cadeau/contraste (exports Accepter/Refuser manquants), puis adaptation des seules doublures et réexécution complète de ces deux fichiers avec `node --import ./scripts/test-network.mjs --test …`.
- Bilan consolidé, sans doubles comptes : **450 tests réussis dans 48 fichiers**, zéro échec/annulation/skip/todo. Les 46 autres résultats restent applicables, les suites consentement/privacy ayant lu les modules finaux. Preuve : `/home/hermes/.hermes/profiles/cartoonova/cache/cookie-removal-local/consolidated-tests.json`. Ne pas présenter le premier `npm test` comme un code de sortie 0.
- `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm run lint` final : **code 0**, 28 avertissements existants hors périmètre, aucune erreur.
- `npm run build` en environnement minimal, clés exclusivement synthétiques et PostgreSQL 18 jetable avec schéma/migrations applicables : **code 0**, compilation et vérification TypeScript réussies. Build refait après le dernier changement du helper ; présence du garde de retrait vérifiée dans les chunks finaux.
- Démarrage du même artefact avec `next start` local : **20 routes HTTP 200** (collections et confidentialité, dix langues), sans balisage du bandeau.
- Vrai Chromium sur cet artefact, desktop 1440×1000 et mobile 390×844, hostname synthétique non filtré comme robot/local : aucun bandeau ; vrai transport PostHog par défaut détecté puis intercepté localement ; Refuser persiste et bloque toute ingestion après rechargement/navigation ; aucun pixel publicitaire ; aucune requête externe non interceptée. Serveur et PostgreSQL jetable arrêtés dans `finally`.
- `git diff --check` : réussi.

## Preuves et limites

Répertoire : `/home/hermes/.hermes/profiles/cartoonova/cache/cookie-removal-local/` : `build.log`, `lint-final.log`, `smoke.json`, `browser-results.json`, `browser.log`, `consolidated-tests.json`, journaux TAP des deux réexécutions.

Captures inspectées visuellement :
- `collections-desktop.png`
- `collections-mobile.png`

Harnais de build : `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/cookie-removal-build.py` ; pilote Chromium : `cookie-removal-compiled.cjs` dans le même scratch. Le SDK et le transport sont réels, les réponses fournisseur et les identifiants sont synthétiques/interceptés : aucune ingestion réelle en production n'a été réalisée ou validée. Aucun accès DB production, email, paiement ou déploiement. Les artefacts préexistants `cache/` et `tests/ten-cards-delivery-evidence/` restent intacts et non ajoutés. Aucune mémoire ni skill modifié.
