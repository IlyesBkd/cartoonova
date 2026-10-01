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
  /** Options payantes (1er octobre 2026). Absentes = non choisies. */
  banner?: boolean;
  extraDecor?: boolean;
  express?: boolean;
}

/** Les options payantes, dans l'ordre d'affichage. */
export const OPTIONS_PAYANTES = ["banner", "extraDecor", "express"] as const;
export type OptionPayante = (typeof OPTIONS_PAYANTES)[number];

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

  // Strictement `true` : une chaine "false" ou un 1 ne doivent rien facturer.
  return {
    format,
    people,
    animals,
    printKey,
    banner: cfg.banner === true,
    extraDecor: cfg.extraDecor === true,
    express: cfg.express === true,
  };
}

/**
 * Le forfait de livraison : les impressions seulement, le fichier numerique
 * n'a rien a expedier. Pur, comme `computeOrderSubtotal`, pour que la fiche, le
 * devis serveur et le paiement donnent le meme montant.
 */
export function computeShipping(prices: PriceSet, printKey: PrintKey): number {
  return printKey === "digital" ? 0 : Math.round((prices.shipping ?? 0) * 100) / 100;
}

/**
 * Le prix d'une configuration, hors livraison. Appele par le serveur (`lib/orderQuote.ts`) ET
 * par la fiche produit : la formule n'existe qu'ici. Elle etait recopiee dans
 * la fiche, avec un commentaire demandant de garder les deux alignees — la
 * premiere option ajoutee d'un seul cote aurait affiche un prix et facture
 * un autre.
 */
export function computeOrderSubtotal(prices: PriceSet, input: OrderPricingInput): number {
  const total =
    prices.base +
    (input.format === "fullbody" ? prices.fullbodyExtra : 0) +
    (input.people - 1) * prices.extraPerson +
    input.animals * prices.extraAnimal +
    prices[PRINT_PRICE_FIELD[input.printKey]] +
    (input.banner ? prices.banner : 0) +
    (input.extraDecor ? prices.extraDecor : 0) +
    (input.express ? prices.express : 0);

  return Math.round(total * 100) / 100;
}
