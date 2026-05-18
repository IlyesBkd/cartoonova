export type Currency = "EUR" | "USD" | "GBP" | "CAD" | "AUD";

export const currencies: Currency[] = ["EUR", "USD", "GBP", "CAD", "AUD"];

export const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CAD: "CA$",
  AUD: "AU$",
};

export const currencyNames: Record<Currency, string> = {
  EUR: "Euro",
  USD: "US Dollar",
  GBP: "British Pound",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
};

export const currencyFlags: Record<Currency, string> = {
  EUR: "🇪🇺",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
};

// Fixed exchange rates (base: EUR)
// Update these manually or connect to an API later
export const exchangeRates: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  CAD: 1.48,
  AUD: 1.66,
};

export function convertPrice(amountInEUR: number, currency: Currency): number {
  return Math.ceil(amountInEUR * exchangeRates[currency]);
}

export function formatPrice(amount: number, currency: Currency, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function convertAndFormat(amountInEUR: number, currency: Currency, locale: string): string {
  const converted = convertPrice(amountInEUR, currency);
  return formatPrice(converted, currency, locale);
}

export const CURRENCY_COOKIE = "cartoonova_currency";

const COUNTRY_TO_CURRENCY: Record<string, Currency> = {
  US: "USD",
  GB: "GBP",
  CA: "CAD",
  AU: "AUD", NZ: "AUD",
  // Eurozone
  AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR", FI: "EUR",
  FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR", LU: "EUR",
  LV: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR", SK: "EUR",
  // EUR-pegged or EUR-accepted micro-states
  AD: "EUR", MC: "EUR", SM: "EUR", VA: "EUR", ME: "EUR", XK: "EUR",
  // Switzerland — CHF not supported, EUR is widely accepted there
  CH: "EUR", LI: "EUR",
};

export function getCurrencyFromCountry(country?: string | null): Currency | undefined {
  if (!country) return undefined;
  return COUNTRY_TO_CURRENCY[country.toUpperCase()];
}
