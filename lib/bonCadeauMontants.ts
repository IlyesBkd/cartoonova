import { convertPrice, currencies, type Currency } from "./currency";

/* Montants des bons cadeaux. Module pur, utilisable par la page d'achat
   (navigateur) comme par la route qui cree le paiement (serveur) : les deux
   doivent proposer et accepter exactement les memes montants. */

/** Montants proposes, en euros ; convertis et arrondis pour les autres devises. */
const MONTANTS_EUR = [20, 40, 60] as const;

/** Un montant « rond » dans la devise : 20 € donne 25 $ plutot que 22 $. */
function arrondir(montant: number): number {
  const pas = montant < 100 ? 5 : montant < 1000 ? 50 : 100;
  return Math.max(pas, Math.round(montant / pas) * pas);
}

export function montantsBon(devise: Currency): number[] {
  return MONTANTS_EUR.map((m) => (devise === "EUR" ? m : arrondir(convertPrice(m, devise))));
}

export function deviseValide(brut: unknown): Currency | null {
  const d = typeof brut === "string" ? brut.toUpperCase() : "";
  return (currencies as string[]).includes(d) ? (d as Currency) : null;
}
