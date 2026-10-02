/* Identite de la societe, reprise telle quelle dans les pages legales des dix
   langues.

   A VERIFIER (backlog P0-2) : ces valeurs viennent des anciennes pages et
   ressemblent a des valeurs d'exemple (adresse du Faubourg Saint-Honore, SIRET
   912 345 678…). Une fois les vraies informations connues, c'est le seul
   endroit a modifier. */

export const ENTREPRISE = {
  raison: "Cartoonova SAS",
  siege: "42 rue du Faubourg Saint-Honoré, 75008 Paris, France",
  siret: "912 345 678 00014",
  rcs: "Paris B 912 345 678",
  capital: "10 000 €",
  tva: "FR 76 912345678",
  tel: "01 42 68 93 17",
  directeur: "M. Antoine Lefèvre",
} as const;

export type CleEntreprise = keyof typeof ENTREPRISE;
