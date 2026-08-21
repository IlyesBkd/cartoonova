import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { locales, defaultLocale } from "./i18n/config";

const intlMiddleware = createMiddleware(routing);

// Country → Currency mapping
const countryCurrencyMap: Record<string, string> = {
  // EUR countries
  FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR", AT: "EUR",
  PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR", MT: "EUR", MC: "EUR", AD: "EUR",
  // GBP
  GB: "GBP",
  // USD
  US: "USD",
  // CAD
  CA: "CAD",
  // AUD
  AU: "AUD", NZ: "AUD",
  PL: "PLN",
  SE: "SEK",
};

// Country → Locale preference for root-path geo-redirect
const countryLocaleMap: Record<string, (typeof locales)[number]> = {
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", CH: "fr",
  DE: "de", AT: "de", LI: "de",
  ES: "es", AR: "es", MX: "es", CL: "es", CO: "es", PE: "es", VE: "es", UY: "es", PY: "es", BO: "es", EC: "es", DO: "es", GT: "es", CR: "es", PA: "es", HN: "es", NI: "es", SV: "es", CU: "es",
  IT: "it", SM: "it", VA: "it",
  /* Pas de BE ici : la Belgique reste sur le francais. La Flandre parle
     neerlandais mais cherche massivement en anglais ; a rouvrir quand Search
     Console montrera une demande flamande reelle. */
  NL: "nl",
  PL: "pl",
  SE: "sv",
};

const CURRENCY_COOKIE = "cartoonova_currency";
const COUNTRY_COOKIE = "cartoonova_country";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const country = request.headers.get("x-vercel-ip-country") || "";

  /* Apex → www. Normalement traite en amont par la redirection de domaine
     Vercel ; ce garde-fou existe pour que l'intention soit versionnee ici et
     pour couvrir le cas ou la requete arriverait quand meme sur l'apex. Le
     domaine canonique est celui de `lib/site.ts`. */
  const host = request.headers.get("host") ?? "";
  if (host === "cartoonova.com") {
    const cible = new URL(request.nextUrl.toString());
    cible.host = "www.cartoonova.com";
    return NextResponse.redirect(cible, 308);
  }

  // Root-path geo-redirect: send the user to the locale matching their country
  // before next-intl falls back to the default. Respect existing NEXT_LOCALE cookie.
  if (pathname === "/") {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const validCookie = cookieLocale && (locales as readonly string[]).includes(cookieLocale) ? cookieLocale : null;
    const fromCountry = country ? countryLocaleMap[country.toUpperCase()] : null;
    const target = validCookie ?? fromCountry ?? "en";
    /* 307 volontaire, et surtout pas 308 : la cible depend du pays et du
       cookie. Un permanent serait mis en cache par le navigateur — un visiteur
       passe une fois par un reseau etranger resterait bloque sur cette langue
       — et par Google, qui figerait la langue vue par son robot. Une
       redirection qui varie ne peut pas etre permanente.
       C'est `x-default` qui donne a Google la version stable de repli. */
    return NextResponse.redirect(new URL(`/${target}`, request.url));
  }

  /* Anciennes URL sans prefixe de langue — /avis, /cgv, /simpson… — heritees
     du site d'avant l'internationalisation.
     Le releve Search Console du 2026-08-17 les montre encore indexees et
     captant 490 des 536 impressions du site, soit 91 %. La cause est le 307
     emis par next-intl : un temporaire demande explicitement a Google de
     conserver l'ancienne URL. Elles ne se consolidaient donc jamais.
     Ici, un 308 vers la langue par defaut : permanent, donc consolidant, et
     deterministe — contrairement a la racine, la cible ne depend de rien. */
  const premierSegment = pathname.split("/")[1];
  if (premierSegment && !(locales as readonly string[]).includes(premierSegment)) {
    const cible = new URL(`/${defaultLocale}${pathname}`, request.url);
    cible.search = request.nextUrl.search;
    return NextResponse.redirect(cible, 308);
  }

  // Skip next-intl for /success and /confirm-poster (standalone pages, no locale needed)
  if (pathname.startsWith("/success") || pathname.startsWith("/confirm-poster")) {
    console.log("[PROXY] ✅ standalone bypass — skipping next-intl:", pathname);
    const response = NextResponse.next();

    const existingCurrency = request.cookies.get(CURRENCY_COOKIE)?.value;
    if (!existingCurrency) {
      const detectedCurrency = countryCurrencyMap[country.toUpperCase()] || "EUR";
      response.cookies.set(CURRENCY_COOKIE, detectedCurrency, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    if (country && !request.cookies.get(COUNTRY_COOKIE)?.value) {
      response.cookies.set(COUNTRY_COOKIE, country.toUpperCase(), {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return response;
  }

  // Run next-intl middleware for all other routes
  console.log("[PROXY] Running next-intl for:", pathname);
  const response = intlMiddleware(request);

  // Currency detection — only set if no cookie exists
  const existingCurrency = request.cookies.get(CURRENCY_COOKIE)?.value;

  if (!existingCurrency) {
    const detectedCurrency = countryCurrencyMap[country.toUpperCase()] || "EUR";

    response.cookies.set(CURRENCY_COOKIE, detectedCurrency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
  }

  if (country && !request.cookies.get(COUNTRY_COOKIE)?.value) {
    response.cookies.set(COUNTRY_COOKIE, country.toUpperCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except API routes, static files, etc.
    // `suivi` rejoint `success` et `confirm-poster` : ces pages arrivent depuis
    // un e-mail, portent leur propre coque et tirent la langue du pays detecte
    // a la commande — un prefixe de langue n'aurait rien a y faire. Sans cette
    // exclusion, /suivi/... etait redirige vers /fr/suivi/... qui n'existe pas.
    "/((?!api|_next|_vercel|success|confirm-poster|suivi|.*\\..*).*)",
  ],
};
