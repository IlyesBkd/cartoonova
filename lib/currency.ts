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
