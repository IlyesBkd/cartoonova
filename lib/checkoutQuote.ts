import { MAX_ANIMALS, MAX_PEOPLE, OPTIONS_PAYANTES, PRINT_KEYS, type OrderPricingInput } from "./pricing";
import { currencies } from "./currency";
import type { OrderQuote } from "./orderQuote";

/** Server-only snapshot, created once with the PI and never updated by our app.
 * No repricing on order creation: price/promo/season changes cannot alter it.
 * Stripe metadata values are limited to 500 characters. */
export interface CheckoutQuote {
  version: 1;
  type: "portrait_order";
  config: OrderPricingInput;
  amount: number;
  currency: string;
  shipping: number;
  discount: number;
  promoCode: string | null;
}

export function serializeCheckoutQuote(config: OrderPricingInput, quote: OrderQuote): string {
  const value = JSON.stringify({
    version: 1, type: "portrait_order", config,
    amount: Math.round(quote.total * 100), currency: quote.currency,
    shipping: quote.shipping, discount: quote.discount, promoCode: quote.promoCode,
  });
  if (value.length > 500) throw new Error("Checkout quote exceeds Stripe metadata limit");
  return value;
}

export function readCheckoutQuote(intent: {
  object: string; amount: number; currency: string; metadata: Record<string, string> | null;
}): CheckoutQuote | null {
  try {
    const quote = JSON.parse(intent.metadata?.checkout_quote ?? "null") as CheckoutQuote | null;
    if (!quote || quote.version !== 1 || quote.type !== "portrait_order" || intent.object !== "payment_intent") return null;
    const config = quote.config;
    if (!config || !["portrait", "fullbody"].includes(config.format) ||
      !Number.isInteger(config.people) || config.people < 1 || config.people > MAX_PEOPLE ||
      !Number.isInteger(config.animals) || config.animals < 0 || config.animals > MAX_ANIMALS ||
      !PRINT_KEYS.includes(config.printKey) || OPTIONS_PAYANTES.some(key => typeof config[key] !== "boolean")) return null;
    if (!Number.isSafeInteger(quote.amount) || quote.amount < 100 || quote.amount !== intent.amount ||
      !(currencies as readonly string[]).includes(quote.currency) || quote.currency.toLowerCase() !== intent.currency ||
      !Number.isFinite(quote.shipping) || quote.shipping < 0 ||
      !Number.isFinite(quote.discount) || quote.discount < 0 ||
      !(quote.promoCode === null || typeof quote.promoCode === "string")) return null;
    return quote;
  } catch {
    return null;
  }
}

/** Legacy UI sends paid options only to checkout, not to order/create.
 * Compare the core deliverable; always derive paid options from the snapshot. */
export function matchesCheckoutConfig(quote: CheckoutQuote, input: Record<string, unknown>): boolean {
  return input.format === quote.config.format && input.people === quote.config.people &&
    input.animals === quote.config.animals && input.printKey === quote.config.printKey;
}
