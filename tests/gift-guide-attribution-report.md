# CRO-11 — contrat local guide → cohorte → paiement

## Audit et portée

Le guide avait déjà des événements de vue/choix/clic ; `measureGiftGuide` et sa CLI calculaient déjà les conversions et marges d'un export **préalablement joint**. Il manquait une affectation stable avec témoin, une exposition distincte de la vue, le lien au paiement préparé, et un contrat explicite des remboursements et valeurs inconnues. Ces outils sont réutilisés, pas remplacés.

Cette implémentation n'active **aucune expérience ni collecte sur le site public**. Elle exige simultanément le flag de compilation `NEXT_PUBLIC_GIFT_GUIDE_LOCAL_MEASUREMENT=1` et un hostname `localhost`, `127.0.0.1` ou `[::1]`. Le flag n'est ajouté à aucun environnement. Aucun fournisseur nouveau, aucune API admin, aucun SQL/migration, aucune modification de la politique de consentement.

## Utilisation locale

1. Utiliser une copie de test sans `.env*`, un environnement minimal sans secrets fournisseurs et la base jetable du harnais existant. Ne pas lancer le serveur local avec les accès fournisseurs ou base réels. Le flag ci-dessus doit être présent **à la compilation** de cette copie seulement.
2. Ouvrir `/fr/cadeau` sur le serveur loopback. Le journal utilise `sessionStorage` et un UUID v4 aléatoire, sans URL, IP, adresse e-mail, texte libre ou secret client. L'armement suit `lireChoixMesure()` existant : `denied`/`pending`, erreurs de stockage et retrait empêchent le rattachement. Un retrait invalide irréversiblement la génération en mémoire et tente de supprimer sa copie Storage ; un échec de suppression peut laisser des octets lisibles, **mais ne les autorise plus**. Le tombstone **non autorisant** par onglet `\n[cartoonova-guide-revoked:v1]`, ajouté à `window.name` sans identifiant et sans écraser son contenu antérieur, maintient cette invalidation à la navigation de même origine, au changement d’ancre et au rechargement, même si toutes les écritures/suppressions Storage échouent. Aucun autre usage applicatif de `window.name` n’a été trouvé avant l’ajout. Le fragment historique `cn-guide-revoked=1` reste compatible mais n’est plus la condition de sûreté : sa lecture migre le retrait vers le tombstone d’onglet. Le signal Storage réel d’un autre onglet invalide également sa génération ; la reprise d’un onglet ne lève pas le tombstone d’un autre. Un nouvel accord exige une écriture réussie et relue d’une nouvelle session vide avant de retirer uniquement notre suffixe et de restituer le contenu antérieur exact de `window.name`. Stockage durablement bloqué, accès `window.name` impossible ou setter ignoré = aucun journal exporté/alloué et aucun rattachement. Ne pas modifier volontairement ce suffixe ; la garantie concerne les navigations de même origine, pas le remplacement manuel de `window.name`, une fermeture d’onglet ou un parcours inter-origines. Ce mécanisme est exclusivement local sous flag ; aucune modification de la politique de consentement publique.
3. L'affectation aléatoire 50/50 est retenue dans le journal. Dans un build local explicitement flaggé, le snapshot SSR/première hydratation reste vide jusqu'à la décision client : `control` ne reçoit jamais la section ; `guided-v1` la reçoit après affectation. Les autres entrées de la page restent présentes. **Le build normal sans flag conserve le guide public dans le HTML SSR.** Avec le flag activé accidentellement sur hostname public, le guide revient après hydratation sans collecte locale. Ce sont des **sessions**, pas des clients uniques. Aucun bras ne doit être choisi a posteriori selon achat/clic.
4. `viewed` = composant rendu ; `exposed` = au moins 25 % de la section dans le viewport via le véritable IntersectionObserver ; `clicked` = activation du lien recommandation disponible, seulement après exposition. Un clic n'est jamais un paiement. Les événements sont dédupliqués par session.
5. `CheckoutModal` capture `{sessionId, generation}` **avant** le départ de `/api/checkout`, puis fournit ce jeton à `attachCheckout` à la réponse. Le rattachement exige la même génération autorisée : retrait/réaccord et préparation commencée sans journal ne rattachent rien rétroactivement. Seul le `pi_…` extrait du secret déjà utilisé par le checkout est conservé. Ni le jeton mémoire, ni le secret, ni les données du formulaire ne sont stockés. Un intent préparé/abandonné/refusé n'est pas une conversion.
6. Dans DevTools **local uniquement**, `copy(JSON.stringify(window.cartoonovaGiftGuideExport()))` copie un instantané revalidé. Après retrait, la fonction renvoie `null`. Garder au plus un instantané final autorisé par session. La copie manuelle d'un ancien export n'est pas révoquée magiquement : supprimer les instantanés retirés avant analyse ; aucun export de navigateurs tiers n'est autorisé par ce document.
7. Constituer un fichier `{ "journals": [...], "payments": [...] }`, sans données clients supplémentaires, puis exécuter :

```sh
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" node scripts/measure-gift-guide.mjs /chemin/absolu/export-local.json
```

Le format historique `{sessions, orders}` reste accepté. Aucune lecture de production ou API Stripe n'est effectuée par cette CLI.

## Règlement autoritatif requis

Chaque ligne `payments` suit ce schéma (valeurs ci-dessous **synthétiques**, pas un résultat commercial) :

```json
{
  "source": "authoritative-payment-export",
  "paymentIntentId": "pi_synthetic",
  "orderId": "order_synthetic",
  "status": "succeeded",
  "paidAt": "2026-10-27T12:00:00Z",
  "currency": "EUR",
  "receivedMinor": 3000,
  "refundedMinor": 500,
  "taxNetMinor": 400,
  "variableCostMinor": 700
}
```

`source` est une assertion de provenance fournie par l'opérateur, **pas une authentification d'export**. L'opérateur doit obtenir les états/montants du journal de paiement et de remboursements autoritatif, pas d'une page succès, d'un événement analytics ou du montant de panier. Les tests utilisent exclusivement des règlements synthétiques ; ils ne prouvent aucun achat fournisseur réel. Pour un essai local sans transaction, utiliser `payments: []` et ne revendiquer aucune vente.

- `status`: `succeeded`, `pending` ou `failed`. Seul `succeeded` avec date valide compte comme paiement historique.
- Montants : entiers sûrs en unités mineures ; devise ISO majuscule séparée, sans conversion de change implicite.
- `refundedMinor`: cumul des remboursements effectifs pour ce paiement à la date de l'export, `null` si inconnu (jamais déduire zéro d'une absence d'information).
- `taxNetMinor`: taxe restant due **après** remboursement, `null` si inconnue.
- `variableCostMinor`: ensemble des coûts variables effectifs (frais paiement non récupérés, fabrication, livraison, main-d'œuvre et autres coûts pertinents), `null` si incomplet. Aucun tarif fournisseur ni coût zéro n'est supposé. Le résultat est une **marge contributive**, pas un bénéfice comptable après charges fixes.
- Net = encaissé − remboursé − taxe nette ; marge = net − coûts variables. Toute valeur nécessaire inconnue propage `null` jusque dans la métrique par session. Une marge négative après remboursement complet est possible.
- Un paiement remboursé intégralement reste un paiement historique dans la conversion ; le tableau `refunds` expose séparément montant, nombre/taux de commandes remboursées et compteurs d'inconnues. Ce taux inclut remboursements partiels et complets ; il n'est pas une conversion conservée nette de remboursements.
- Jointure exclusivement par l'identifiant exact du paiement préparé. Les règlements orphelins sont dénombrés sans attribution devinée. Les devises ne sont pas sommées. Cohortes zéro achat et sessions seules sont conservées. Les doublons identiques sont dédupliqués ; instantanés contradictoires, rattachements ambigus, montants invalides et journals non autorisés sont rejetés sans sortie partielle ni contenu privé dans les erreurs.

## Preuves et limites

Les tests ciblés exercent le journal réel, la CLI réelle, le véritable composant guide dans Chromium (vue hors écran puis exposition, témoin), le véritable `CheckoutModal` (préparation capturée localement et retrait pendant réponse en vol), les Storage de deux onglets, et les calculs remboursement/marge. Les frontières Stripe/analytics/prix sont simulées ; aucun vrai achat ou transport fournisseur n'est revendiqué. La régression checkout existante utilise aussi PostgreSQL jetable et Chromium.

Aucun gain commercial, durée de recul, volume d'échantillon ou significativité n'est inventé. Aucun mécanisme de collecte public/durable n'est livré ni activé implicitement ; un essai public nécessiterait une autorisation séparée, une revue de confidentialité et un contrat de conservation/retrait. Le critère d'effet commercial de CRO-11 reste ouvert faute de sessions réelles autorisées et de règlements/coûts/remboursements complets.
