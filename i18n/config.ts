export const locales = ["fr", "en", "es", "de", "it", "nl", "pl", "sv", "da", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

/* Langue choisie par le visiteur dans le selecteur, et seulement la. Lue par
   la redirection de la racine (`proxy.ts`). Le cookie automatique de
   next-intl (NEXT_LOCALE) est coupe : il se posait a la simple visite d'une
   page, si bien qu'un Francais arrive une fois sur /pl par un lien ou un
   resultat Google etait ensuite renvoye sur /pl a chaque retour par
   cartoonova.com, quelle que soit son IP. */
export const COOKIE_LANGUE_CHOISIE = "cartoonova_langue";

export const localeNames: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  sv: "Svenska",
  da: "Dansk",
  pt: "Português",
};

export const localeFlags: Record<Locale, string> = {
  fr: "🇫🇷",
  en: "🇬🇧",
  es: "🇪🇸",
  de: "🇩🇪",
  it: "🇮🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  sv: "🇸🇪",
  da: "🇩🇰",
  pt: "🇵🇹",
};
