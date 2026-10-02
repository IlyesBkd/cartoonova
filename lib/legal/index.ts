import type { Lang } from "../email-i18n";
import type { PagesLegales } from "./types";
import { LEGAL_FR } from "./fr";
import { LEGAL_EN } from "./en";
import { LEGAL_ES } from "./es";
import { LEGAL_DE } from "./de";
import { LEGAL_IT } from "./it";
import { LEGAL_NL } from "./nl";
import { LEGAL_PL } from "./pl";
import { LEGAL_SV } from "./sv";
import { LEGAL_DA } from "./da";
import { LEGAL_PT } from "./pt";

/* Pages legales par langue. Module serveur : les pages legales sont rendues
   cote serveur, ces textes ne partent jamais dans le JavaScript du navigateur. */
export const PAGES_LEGALES: Record<Lang, PagesLegales> = {
  fr: LEGAL_FR, en: LEGAL_EN, es: LEGAL_ES, de: LEGAL_DE, it: LEGAL_IT,
  nl: LEGAL_NL, pl: LEGAL_PL, sv: LEGAL_SV, da: LEGAL_DA, pt: LEGAL_PT,
};

export function pagesLegales(locale: string): PagesLegales {
  return PAGES_LEGALES[locale as Lang] ?? LEGAL_FR;
}
