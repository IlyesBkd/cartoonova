/**
 * Occasions proposees a la caisse (« Pour quelle occasion ? », facultatif).
 *
 * Des cles stables plutot que du texte libre : elles se comptent dans
 * PostHog et se lisent dans l'admin quelle que soit la langue du client.
 * Libelles traduits sous `checkout.occasions.<cle>`.
 */
export const OCCASIONS = ["anniversaire", "noel", "couple", "mariage", "naissance", "moi", "autre"] as const;

export type Occasion = (typeof OCCASIONS)[number];

export function estOccasion(v: unknown): v is Occasion {
  return typeof v === "string" && (OCCASIONS as readonly string[]).includes(v);
}

/** Libelles francais, pour Discord et l'admin. */
export const OCCASION_FR: Record<Occasion, string> = {
  anniversaire: "Anniversaire",
  noel: "Noël",
  couple: "Couple / Saint-Valentin",
  mariage: "Mariage",
  naissance: "Naissance",
  moi: "Pour soi",
  autre: "Autre",
};
