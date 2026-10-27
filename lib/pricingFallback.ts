import { convertPrice, type Currency } from "./currency";
import type { PriceSet } from "./types";

/** Same policy as db.getPricesForCurrency for currencies without a custom grid.
 * Keep explicit merchant grids (USD/GBP/CAD/AUD) separate: they are NOT FX rates.
 */
export function convertedPricingFallback(eur: PriceSet, currency: Currency): PriceSet {
  return Object.fromEntries(
    Object.entries(eur).map(([field, amount]) => [
      field,
      field === "digital" ? amount : convertPrice(amount, currency),
    ]),
  ) as unknown as PriceSet;
}
