export type Currency = "EUR" | "USD" | "GBP" | "CAD" | "AUD" | "PLN" | "SEK" | "DKK" | "CHF";

export const currencies: Currency[] = ["EUR", "USD", "GBP", "CAD", "AUD", "PLN", "SEK", "DKK", "CHF"];

export const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CAD: "CA$",
  AUD: "AU$",
  PLN: "zł",
  SEK: "kr",
  DKK: "kr.",
  CHF: "CHF",
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
  CHF: "Swiss Franc",
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
  CHF: "🇨🇭",
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
  /* Le franc suisse vaut un peu moins que l'euro. Google exige la devise du
     pays de vente : tant que le flux suisse annoncait des euros, la Suisse
     etait exposee a un refus des fiches. */
  CHF: 0.94,
};

export function convertPrice(amountInEUR: number, currency: Currency): number {
  return Math.ceil(amountInEUR * exchangeRates[currency]);
}

/**
 * Ramene un montant a l'euro, la devise de reference de la table ci-dessus.
 *
 * La mesure en avait besoin : les commandes arrivent en neuf devises, et
 * additionner 89 USD, 89 GBP et 89 PLN comme s'il s'agissait du meme chiffre
 * donne un chiffre d'affaires faux de plusieurs dizaines de pour cent. Tout
 * evenement d'achat porte donc, a cote du montant reellement paye, sa
 * contrepartie en euros — c'est elle qu'on somme.
 *
 * Le taux vient de la meme table saisie a la main que le reste du site : la
 * valeur derive avec le marche, mais elle derive de la meme facon pour les
 * prix affiches, ce qui vaut mieux qu'une seconde source qui divergerait.
 */
export function toEUR(amount: number, currency: string): number {
  const taux = exchangeRates[currency as Currency];
  if (!taux) return amount;
  return Math.round((amount / taux) * 100) / 100;
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
  // Switzerland and Liechtenstein — both use the Swiss franc.
  CH: "CHF", LI: "CHF",

  /* ─── Territoires ────────────────────────────────────────────────────
     Absents jusqu'ici, ils tombaient tous sur le repli euro. Ce n'est pas
     theorique : la commande du 25 aout 2026 vient de Porto Rico, territoire
     americain, et a ete facturee 15 EUR la ou la grille dollar en demandait
     18 USD.

     Un pays absent d'ici n'echoue pas bruyamment — il est simplement facture
     dans la mauvaise monnaie, sans que rien ne le signale. */

  // Territoires americains : dollar US.
  PR: "USD", VI: "USD", GU: "USD", AS: "USD", MP: "USD", UM: "USD",

  // Dependances de la Couronne et Gibraltar : livre sterling (ou parite fixe).
  GG: "GBP", JE: "GBP", IM: "GBP", GI: "GBP",

  /* France d'outre-mer. Ce sont des departements et collectivites francais :
     l'euro y a cours, et les visiteurs y parlent francais — voir aussi la
     carte des langues dans `proxy.ts`, ou leur absence les envoyait sur le
     site anglais. */
  GP: "EUR", MQ: "EUR", GF: "EUR", RE: "EUR", YT: "EUR",
  PM: "EUR", BL: "EUR", MF: "EUR",

  /* Pacifique francais. La monnaie legale y est le franc CFP, arrime a
     l'euro a taux fixe et absent de notre table de devises : l'euro est le
     choix le plus proche du prix reellement paye. */
  NC: "EUR", PF: "EUR", WF: "EUR",

  // Åland : region autonome finlandaise, donc zone euro.
  AX: "EUR",
};

export function getCurrencyFromCountry(country?: string | null): Currency | undefined {
  if (!country) return undefined;
  return COUNTRY_TO_CURRENCY[country.toUpperCase()];
}
