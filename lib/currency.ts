export type Currency = "EUR" | "USD" | "GBP" | "CAD" | "AUD" | "PLN" | "SEK" | "DKK";

export const currencies: Currency[] = ["EUR", "USD", "GBP", "CAD", "AUD", "PLN", "SEK", "DKK"];

export const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CAD: "CA$",
  AUD: "AU$",
  PLN: "zł",
  SEK: "kr",
  DKK: "kr.",
};

export const currencyNames: Record<Currency, string> = {
  EUR: "Euro",
  USD: "US Dollar",
  GBP: "British Pound",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  PLN: "Polish Zloty",
  SEK: "Swedish Krona",
  DKK: "Danish Krone",
};

// Drapeaux : ne servent plus qu'au back-office. L'interface publique affiche
// le code de la devise, composé dans la fonte de titre.
export const currencyFlags: Record<Currency, string> = {
  EUR: "🇪🇺",
  USD: "🇺🇸",
  GBP: "🇬🇧",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  PLN: "🇵🇱",
  SEK: "🇸🇪",
  DKK: "🇩🇰",
};

// Fixed exchange rates (base: EUR)
// Update these manually or connect to an API later
export const exchangeRates: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  CAD: 1.48,
  AUD: 1.66,
  /* Le zloty flotte davantage que les autres : il a varie de plus de 8 %
     sur douze mois. Avec une table saisie a la main, c'est la devise qui
     derivera le plus vite — raison de plus pour brancher un flux de taux. */
  PLN: 4.3,
  SEK: 11.3,
  /* La couronne danoise est arrimee a l'euro dans une bande etroite : c'est
     la seule de la table qui ne derivera pas. */
  DKK: 7.46,
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
  PL: "PLN",
  SE: "SEK",
  DK: "DKK",
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
