# Emails Cartoonova — Pop & clair

## Base commune

`lib/emailTemplate.ts` fournit le logo officiel sur fond violet, l'en-tête crème,
le fond clair et le pied de page dans les dix langues du site. La mise en page
utilise des tableaux de présentation et des styles intégrés, sans JavaScript,
police distante, pixel de suivi ou dépendance à React.

Les blocs sont composables, indépendants de l'envoi :

- `emailLayout({ lang, title, preheader?, bodyHtml, footerHtml? })` : enveloppe.
- `emailParagraph(texte)` : texte échappé, sauts de ligne conservés.
- `emailButton(libelle, url)` : action et lien de secours copiable.
- `emailNotice(texte)` : encadré d'information.
- `emailImage(url, alt)` : image responsive avec texte alternatif.
- `escapeEmailHtml(texte)` : échappement d'une donnée dans du HTML éditorial.
- `emailText(html)` : alternative texte sans styles.

**Sécurité :** `bodyHtml` et `footerHtml` sont des fragments HTML de confiance,
pas du texte utilisateur. Passer les données client/admin par les helpers ou
l'échappement. Les URL doivent être absolues HTTP(S), sans identifiant/mot de
passe ni caractères de contrôle. Ne pas reconstruire ni normaliser les liens
signés. Les aides de rendu n'accèdent ni à la base ni au service d'envoi.

`lib/envoiEmail.ts` ajoute l'alternative texte si elle manque ; un texte déjà
fourni est conservé à l'identique. Ne pas modifier sujets, destinataires,
en-têtes de conversation/désinscription, pièces jointes, clés d'idempotence ou
conditions métier pour une modification de présentation.

## Adapter au message

- Confirmation : récapitulatif et lien vers la commande.
- Portrait/validation/retouche : informations utiles et action existante.
- Expédition : transporteur et suivi enregistré, sans statut inventé.
- Support : message approuvé tel quel, sans bouton ajouté automatiquement.
- Remboursement : le cadre support peut présenter une confirmation approuvée ;
  aucun remboursement ni envoi automatique de remboursement n'est créé ici.
- Relances/bienvenue : conserver les liens et en-têtes de désinscription.

## Aperçus sans envoi

```sh
node --import tsx scripts/preview-emails.mjs "$TMPDIR/email-previews"
```

Six scénarios **fictifs** sont générés en HTML et texte, avec un manifeste
indiquant `sent: false`. Les liens `example.invalid` sont volontairement
inactifs. Aucun accès client ou fournisseur n'est nécessaire. Ces exemples
montrent les blocs communs ; ils ne remplacent pas les tests des véritables
constructeurs d'emails et ne constituent pas une promesse de remboursement,
d'expédition ou de délai à un client réel.

Un rendu navigateur sur ordinateur/mobile ne garantit pas le rendu dans tous
les clients mail, notamment Outlook. Les essais réels nécessitent une
validation explicite des destinataires, des contenus et du nombre de messages.
Une modification locale n'est ni publiée ni activée en production.
