import type { Currency } from "./currency";

export interface Order {
  id: string;
  createdAt: string;
  /* La meme colonne porte le statut de paiement (PENDING / PAID, pose par le
     paiement) et le suivi saisi par l'admin. Pour savoir si une commande est
     payee, lire `paid_at` (lib/db.ts), pas ce champ. */
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

/* Repli servi quand la base est injoignable. Il avait ete fige a l'ouverture du
   site et n'avait jamais suivi : il annoncait 49 EUR de base la ou la grille
   reelle en dit 5, soit dix fois trop. Un visiteur tombant dessus pendant une
   panne aurait vu des prix sans rapport avec ceux du panier. A realigner a
   chaque revision de tarif — c'est le seul endroit ou les prix sont ecrits en
   dur. */
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
  /* Les quatre suivantes n'ont pas de grille propre : le site convertit l'euro
     reel au taux. Les montants ci-dessous reprennent cette conversion, pour que
     le repli ne dise pas autre chose que le fonctionnement normal. */
  PLN: { base: 22, fullbodyExtra: 22, extraPerson: 22, extraAnimal: 22, digital: 0, canvas: 168, poster: 254, posterSimple: 82, banner: 13, extraDecor: 22, express: 30, carteVoeux: 17, calendrier: 39, shipping: 21 },
  SEK: { base: 57, fullbodyExtra: 57, extraPerson: 57, extraAnimal: 57, digital: 0, canvas: 441, poster: 667, posterSimple: 215, banner: 35, extraDecor: 57, express: 80, carteVoeux: 46, calendrier: 103, shipping: 55 },
  DKK: { base: 38, fullbodyExtra: 38, extraPerson: 38, extraAnimal: 38, digital: 0, canvas: 291, poster: 441, posterSimple: 142, banner: 23, extraDecor: 38, express: 53, carteVoeux: 30, calendrier: 68, shipping: 36 },
  CHF: { base: 5, fullbodyExtra: 5, extraPerson: 5, extraAnimal: 5, digital: 0, canvas: 37, poster: 56, posterSimple: 18, banner: 3, extraDecor: 5, express: 7, carteVoeux: 4, calendrier: 9, shipping: 4.7 },
};
