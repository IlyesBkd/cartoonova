import type { PriceSet } from "./types";

export const PRINT_KEYS = ["digital", "posterSimple", "canvas", "framed"] as const;
export type PrintKey = (typeof PRINT_KEYS)[number];

// Correspondance entre l'option choisie sur la page produit et le champ de prix.
const PRINT_PRICE_FIELD: Record<PrintKey, keyof PriceSet> = {
  digital: "digital",
  posterSimple: "posterSimple",
  canvas: "canvas",
  framed: "poster",
};

export const MAX_PEOPLE = 10;
export const MAX_ANIMALS = 10;

export interface OrderPricingInput {
  format: "portrait" | "fullbody";
  people: number;
  animals: number;
  printKey: PrintKey;
}

/**
 * Valide une configuration de commande venue du client. Tout ce qui influence
 * le prix passe par ici : le montant n'est jamais repris tel quel du navigateur.
 */
export function parseOrderPricingInput(raw: unknown): OrderPricingInput | null {
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as Record<string, unknown>;

  const format = cfg.format === "fullbody" ? "fullbody" : cfg.format === "portrait" ? "portrait" : null;
  if (!format) return null;

  const people = Number(cfg.people);
  if (!Number.isInteger(people) || people < 1 || people > MAX_PEOPLE) return null;

  const animals = Number(cfg.animals ?? 0);
  if (!Number.isInteger(animals) || animals < 0 || animals > MAX_ANIMALS) return null;

  const printKey = cfg.printKey as PrintKey;
  if (!PRINT_KEYS.includes(printKey)) return null;

  return { format, people, animals, printKey };
}

/** Meme formule que la page produit — les deux doivent rester alignees. */
export function computeOrderSubtotal(prices: PriceSet, input: OrderPricingInput): number {
  const total =
    prices.base +
    (input.format === "fullbody" ? prices.fullbodyExtra : 0) +
    (input.people - 1) * prices.extraPerson +
    input.animals * prices.extraAnimal +
    prices[PRINT_PRICE_FIELD[input.printKey]];

  return Math.round(total * 100) / 100;
}
