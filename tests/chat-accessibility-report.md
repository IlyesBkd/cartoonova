# QA-01 — chat clavier invisible

## Résultat local

Correction limitée à `components/ChatWidget.tsx` et ajout de `tests/chat-accessibility-browser.test.mjs`. Aucun style, catalogue, SEO, autre test ou dépendance modifié. Aucun commit, push ou déploiement.

- Fermé : panneau `inert` en plus de `aria-hidden`, donc aucun descendant atteignable par Tab, Shift+Tab ou `.focus()`.
- Ouvert : vrai dialogue nommé non modal, focus sur « démarrer » à l’accueil, email ou saisie selon l’écran ; relation `aria-controls`/id.
- Fermeture : retour au déclencheur réel (lanceur ou bouton Aide), y compris Échap, croix et historique ; réouverture conservant email et brouillon.
- Tab peut quitter le dialogue et rejoindre l’arrière-plan ; pas de piège clavier imposé.

## Preuves TDD, dans l’ordre

Commande identique à chaque cycle :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node --test tests/chat-accessibility-browser.test.mjs
```

1. RED initial desktop/mobile : **0/2 réussis**, assertion `Tab must skip every invisible panel control`, `false !== true`.
2. GREEN après `inert` : **2/2 réussis**. Une exécution intermédiaire a révélé les requêtes de polices locales du CSS ; le harnais les sert maintenant depuis `public/polices`, sans réseau réel.
3. RED focus initial desktop/mobile : **2/4 réussis**, `opening focuses Start conversation`, `false !== true`.
4. GREEN après focus de l’action principale et association du lanceur : **4/4 réussis**.
5. RED restitution Échap desktop/mobile : **4/6 réussis**, `Escape restores the control that opened the chat`, `false !== true`.
6. GREEN après mémorisation/restitution du déclencheur : **6/6 réussis**.
7. Couverture étendue sans nouvelle fonctionnalité : **10/10 réussis**, zéro échec, `QA01_TEST_EXIT=0`, durée finale environ 13,7 s.

## Périmètre des dix tests finaux

Cinq scénarios exécutés chacun en Chromium desktop 1280×900 et mobile tactile émulé 390×844 : ouverture pointeur/tactile et fermeture ; parcours email/fil/réouvertures avec brouillons, Tab sortant et Shift+Tab entrant, bouton retour interne, croix et retour navigateur ; Échap avec alternance lanceur/Aide/lanceur ; focus initial et sémantique non modale ; exclusion clavier et programmatique du panneau fermé.

La règle axe-core **`aria-hidden-focus`** s’exécute fermé, ouvert et refermé : aucune violation et aucun résultat incomplet. Les tests exigent aussi zéro erreur d’exécution navigateur et zéro requête imprévue.

Harnais : vrai composant React, vrais messages français, vrai `useRetourFerme`, CSS global réellement compilé par Tailwind. Document et polices servis exclusivement par interception locale. Analytics neutralisé à sa frontière ; aucun envoi de message, fournisseur réel, DB ou secret.

## Autres vérifications

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm run lint
```

Première exécution : code 0, 0 erreur et 29 warnings, dont un nouveau warning de ref capturée dans le cleanup. Ce dernier a été corrigé en capturant le lanceur dans l’effet ; contrôle final ciblé ci-dessous sans warning :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" npm run lint -- components/ChatWidget.tsx tests/chat-accessibility-browser.test.mjs
git diff --check
```

Les deux contrôles finaux terminent avec code 0. Scripts `typecheck`, `test` et `test:unit` non déclarés dans le projet.

## Stabilisation Échap — course commit/effets passifs

Une intégration ultérieure a révélé un échec intermittent du scénario Échap original à la fermeture (ligne 133). Reproduction **avant correction**, avec `env -i` : le scénario ciblé original échoue sur mobile avec le même timeout de 30 s ; desktop passe. Ce n'est donc pas une erreur constante ni un problème propre au desktop.

**Cause confirmée :** le lien Aide déclenche une mise à jour depuis un événement natif. Le DOM peut déjà annoncer `aria-expanded=true` avant que l'effet passif dépendant de `[ouvert]` installe l'écouteur `window.keydown`. Un Échap dans cet intervalle est perdu. Attendre seulement l'attribut est légitime pour tester cette fenêtre ; attendre le focus ou ajouter un délai aurait masqué le défaut produit.

**Régression déterministe ajoutée :** un `MutationObserver` sur `aria-expanded` envoie un `KeyboardEvent` Échap bouillonnant au premier commit d'ouverture depuis Aide, sans attendre les effets passifs. La promesse du harnais se résout seulement après cette observation et cet envoi, pour éviter un faux succès sur l'état fermé initial. Avant correction : **0/2**, desktop et mobile échouent tous deux à la fermeture (`qa01-escape-red.log`). Le vrai clavier Playwright demeure couvert par tous les tests originaux, inchangés.

**Correction minimale :** écouteur Échap stable pendant la durée de montage, sans dépendance à `ouvert`. `setOuvert(false)` est sans effet sur un panneau déjà fermé ; le cleanup retire toujours l'écouteur au démontage. Aucun changement au focus, à l'historique ou aux assertions existantes ; aucun timeout augmenté, aucun délai arbitraire.

Vérifications après correction, toutes sous `env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR"`, interception réseau locale inchangée :

- Régression déterministe : **2/2**, code 0 (`qa01-escape-green.log`).
- Suite chat entière : **cinq exécutions consécutives de 12/12**, zéro échec ; logs `qa01-escape-full-1.log` à `qa01-escape-full-5.log` et index `qa01-escape-repeated.json` dans `/home/hermes/.hermes/profiles/cartoonova/cache/scratch/`.
- `npm run lint -- components/ChatWidget.tsx tests/chat-accessibility-browser.test.mjs` : code 0, aucune erreur ni warning.
- `git diff --check` : code 0.

Cette suite comporte désormais **12 scénarios** (les dix originaux et deux régressions de course). Modifications de cette stabilisation limitées à `components/ChatWidget.tsx`, `tests/chat-accessibility-browser.test.mjs` et ce rapport. Pas de commit/push. Le build réussi précédemment par le parent précède la correction du composant : il ne valide pas cet arbre final et doit être réexécuté au contrôle global. La suite globale n'a pas été réexécutée dans cette sous-tâche ciblée.

## Limites

Pas de build Next global ni de suite exhaustive exécutés dans cette sous-tâche ciblée et parallèle ; à intégrer au contrôle global de l’état final avec PostgreSQL jetable si demandé. Pas de DB démarrée/consultée. Pas de preuve Safari/Firefox, appareil physique, lecteur d’écran ou interaction avec les autres panneaux de l’application complète. La règle axe testée est ciblée, pas un audit WCAG complet. Aucune vérification de livraison de message au support.
