import type { Currency } from "./currency";
import { convertedPricingFallback } from "./pricingFallback";

export interface Order {
  id: string;
  createdAt: string;
  /* Statut de paiement (PENDING / PAID). Les autres valeurs sont d'anciens
     suivis saisis a la main, plus ecrits : le suivi se calcule desormais
     (lib/statutCommande.ts), qui ne relit que les anciens « completed » et
     « shipped » comme commandes closes. Pour savoir si une commande est payee, lire
     `paid_at` (lib/db.ts), pas ce champ. */
  status: "PENDING" | "PAID" | "new" | "in_progress" | "completed" | "shipped";
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
  /** Options payantes du configurateur (1er octobre 2026). */
  banner: number;
  extraDecor: number;
  express: number;
  /** Options numeriques de saison (F-6/F-7) : carte de voeux et calendrier 2027 en PDF. */
  carteVoeux: number;
  calendrier: number;
  /** Forfait de livraison des impressions (2 octobre 2026). Le numerique n'en paie pas. */
  shipping: number;
}

export type Prices = PriceSet;

export type PricesByCurrency = Record<Currency, PriceSet>;

/* Repli versionne depuis la configuration publique approuvee (E2E-03,
   relue le 27 octobre 2026). Ne modifie aucune grille active en base.
   Toute revision metier doit mettre a jour cette reference et ses tests. */
export const DEFAULT_PRICE_SET: PriceSet = {
  base: 5,
  fullbodyExtra: 5,
  extraPerson: 5,
  extraAnimal: 5,
  digital: 0,
  canvas: 39,
  poster: 59,
  posterSimple: 19,
  banner: 3,
  extraDecor: 5,
  express: 7,
  carteVoeux: 4,
  calendrier: 9,
  shipping: 4.9,
};

export const DEFAULT_PRICES: Prices = DEFAULT_PRICE_SET;

export const DEFAULT_PRICES_BY_CURRENCY: PricesByCurrency = {
  EUR: { ...DEFAULT_PRICE_SET },
  /* Les quatre premieres reprennent la grille reellement saisie en base. */
  USD: { base: 6, fullbodyExtra: 6, extraPerson: 6, extraAnimal: 6, digital: 0, canvas: 43, poster: 64, posterSimple: 21, banner: 4, extraDecor: 6, express: 8, carteVoeux: 5, calendrier: 10, shipping: 5.9 },
  GBP: { base: 5, fullbodyExtra: 5, extraPerson: 5, extraAnimal: 5, digital: 0, canvas: 34, poster: 51, posterSimple: 17, banner: 3, extraDecor: 5, express: 6, carteVoeux: 4, calendrier: 8, shipping: 4.2 },
  CAD: { base: 8, fullbodyExtra: 8, extraPerson: 8, extraAnimal: 8, digital: 0, canvas: 58, poster: 88, posterSimple: 29, banner: 5, extraDecor: 8, express: 10, carteVoeux: 6, calendrier: 13, shipping: 7.9 },
  AUD: { base: 9, fullbodyExtra: 9, extraPerson: 9, extraAnimal: 9, digital: 0, canvas: 65, poster: 98, posterSimple: 32, banner: 5, extraDecor: 8, express: 11, carteVoeux: 7, calendrier: 14, shipping: 8.5 },
  /* Sans grille propre : meme conversion que la lecture de la grille EUR
     en base, sans seconde copie de montants arrondis devenue perimee. */
  PLN: convertedPricingFallback(DEFAULT_PRICE_SET, "PLN"),
  SEK: convertedPricingFallback(DEFAULT_PRICE_SET, "SEK"),
  DKK: convertedPricingFallback(DEFAULT_PRICE_SET, "DKK"),
  CHF: convertedPricingFallback(DEFAULT_PRICE_SET, "CHF"),
};
