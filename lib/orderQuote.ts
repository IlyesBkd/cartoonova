import { getPricesForCurrency } from "./db";
import { computeOrderSubtotal, computeShipping, parseOrderPricingInput } from "./pricing";
import { validatePromoCode, type PromoRejection } from "./promoCodes";
import { currencies, type Currency } from "./currency";

export interface OrderQuote {
  currency: Currency;
  subtotal: number;
  /** Livraison des impressions, hors remise : le code promo ne porte que sur les produits. */
  shipping: number;
  discount: number;
  total: number;
  promoCode: string | null;
  promoRejected: PromoRejection | null;
}

export function parseCurrency(raw: unknown): Currency | null {
  if (typeof raw !== "string") return null;
  const upper = raw.toUpperCase();
  return (currencies as string[]).includes(upper) ? (upper as Currency) : null;
}

/**
 * Source de verite du montant a payer. Le navigateur envoie une configuration
 * (format, personnes, animaux, support) et eventuellement un code promo ;
 * le prix, lui, vient toujours de la base.
 *
 * Un code promo invalide ne fait pas echouer la commande : le devis est
 * renvoye sans remise, avec le motif du refus, a charge de l'interface de
 * l'afficher.
 */
export async function quoteOrder(input: {
  orderConfig: unknown;
  currency: unknown;
  promoCode?: unknown;
}): Promise<{ quote: OrderQuote } | { error: "invalid_config" | "invalid_currency" }> {
  const config = parseOrderPricingInput(input.orderConfig);
  if (!config) return { error: "invalid_config" };

  const currency = parseCurrency(input.currency);
  if (!currency) return { error: "invalid_currency" };

  const prices = await getPricesForCurrency(currency);
  const subtotal = computeOrderSubtotal(prices, config);
  const shipping = computeShipping(prices, config.printKey);

  let discount = 0;
  let promoCode: string | null = null;
  let promoRejected: PromoRejection | null = null;

  const rawCode = typeof input.promoCode === "string" ? input.promoCode.trim() : "";
  if (rawCode) {
    const result = await validatePromoCode(rawCode, subtotal, currency);
    if (result.ok) {
      discount = result.discount;
      promoCode = result.code;
    } else {
      promoRejected = result.reason;
    }
  }

  const total = Math.round((subtotal - discount + shipping) * 100) / 100;

  return { quote: { currency, subtotal, shipping, discount, total, promoCode, promoRejected } };
}
