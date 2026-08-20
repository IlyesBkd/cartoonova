"use client";

import { useLocale } from "next-intl";

/**
 * Prefixe un chemin interne par la langue courante.
 *
 * `localePrefix` vaut "always" : sans prefixe, chaque clic partirait en
 * redirection par le middleware avant d'atteindre la page. Le helper evite
 * cet aller-retour.
 */
export function useLien() {
  const locale = useLocale();
  return (chemin: string) => `/${locale}${chemin === "/" ? "" : chemin}`;
}
