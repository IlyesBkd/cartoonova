import type { Currency } from "./currency";

export interface Order {
  id: string;
  createdAt: string;
  status: "new" | "in_progress" | "completed" | "shipped";
  // Client info
  email: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  // Product config
  format: "portrait" | "fullbody";
  people: number;
  animals: number;
  background: string;
  printOption: string;
  total: number;
  description: string;
  // Files
  photoUrls: string[];
  // Payment
  stripePaymentId?: string;
}

export interface PriceSet {
  base: number;
  fullbodyExtra: number;
  extraPerson: number;
  extraAnimal: number;
  digital: number;
  canvas: number;
  poster: number;
  posterSimple: number;
}

export type Prices = PriceSet;

export type PricesByCurrency = Record<Currency, PriceSet>;

export const DEFAULT_PRICE_SET: PriceSet = {
  base: 49,
  fullbodyExtra: 20,
  extraPerson: 15,
  extraAnimal: 15,
  digital: 0,
  canvas: 89,
  poster: 79,
  posterSimple: 19,
};

export const DEFAULT_PRICES: Prices = DEFAULT_PRICE_SET;

export const DEFAULT_PRICES_BY_CURRENCY: PricesByCurrency = {
  EUR: { ...DEFAULT_PRICE_SET },
  USD: { base: 55, fullbodyExtra: 22, extraPerson: 17, extraAnimal: 17, digital: 0, canvas: 99, poster: 89, posterSimple: 22 },
  GBP: { base: 45, fullbodyExtra: 18, extraPerson: 14, extraAnimal: 14, digital: 0, canvas: 79, poster: 69, posterSimple: 17 },
  CAD: { base: 75, fullbodyExtra: 30, extraPerson: 22, extraAnimal: 22, digital: 0, canvas: 135, poster: 119, posterSimple: 29 },
  AUD: { base: 85, fullbodyExtra: 35, extraPerson: 25, extraAnimal: 25, digital: 0, canvas: 149, poster: 135, posterSimple: 33 },
  /* Repli seulement : des qu'un jeu de prix existe en base, il l'emporte, et
     s'il n'y en a pas pour le zloty c'est l'euro reel qui est converti au
     taux. Ces montants ne servent donc que si la base est vide. */
  PLN: { base: 209, fullbodyExtra: 89, extraPerson: 65, extraAnimal: 65, digital: 0, canvas: 379, poster: 339, posterSimple: 85 },
  SEK: { base: 549, fullbodyExtra: 229, extraPerson: 169, extraAnimal: 169, digital: 0, canvas: 999, poster: 899, posterSimple: 219 },
  DKK: { base: 369, fullbodyExtra: 149, extraPerson: 115, extraAnimal: 115, digital: 0, canvas: 669, poster: 595, posterSimple: 145 },
};
