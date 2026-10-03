import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // Voir COOKIE_LANGUE_CHOISIE (i18n/config.ts) : seul un choix explicite est retenu.
  localeCookie: false,
});
