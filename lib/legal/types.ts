/* Pages legales (CGV, mentions legales, confidentialite) dans les dix langues.

   Le texte etait ecrit en francais dans le JSX des trois pages, et servi tel
   quel aux visiteurs allemands ou polonais, qui acceptaient en payant des CGV
   qu'ils ne pouvaient pas lire. Il vit maintenant ici, sous forme de donnees :
   une langue par fichier (`fr.ts`, `en.ts`…), un seul composant pour l'afficher
   (`components/PageLegale.tsx`).

   Mise en forme dans les chaines, volontairement minimale :
   - **texte** pour le gras ;
   - [texte](url) pour un lien ; une url qui commence par « / » est prefixee
     par la langue de la page ;
   - support@cartoonova.com devient un lien mailto tout seul ;
   - {raison}, {siege}, {siret}, {rcs}, {capital}, {tva}, {tel}, {directeur}
     sont remplaces par l'identite de la societe (`entreprise.ts`), commune a
     toutes les langues : la corriger une fois la corrige partout. */

export type Bloc =
  | string
  | { liste: string[] }
  | { sousTitre: string }
  /** Lignes courtes empilees (adresse, coordonnees). */
  | { lignes: string[] };

export interface Section {
  titre: string;
  blocs: Bloc[];
}

export interface DocumentLegal {
  titre: string;
  /** « Derniere mise a jour : … », deja formate dans la langue. */
  miseAJour: string;
  sections: Section[];
}

export interface PagesLegales {
  /**
   * Phrase placee en tete des traductions : la version francaise fait foi.
   * Vide en francais.
   */
  avertissement: string;
  cgv: DocumentLegal;
  mentions: DocumentLegal;
  confidentialite: DocumentLegal;
  /** Ligne de la caisse : « En commandant, vous acceptez les [CGV](/cgv). » */
  accepterCgv: string;
}
