import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { locales } from "./i18n/config";

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
};

// Country → Locale preference for root-path geo-redirect
const countryLocaleMap: Record<string, (typeof locales)[number]> = {
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", CH: "fr",
  DE: "de", AT: "de", LI: "de",
  ES: "es", AR: "es", MX: "es", CL: "es", CO: "es", PE: "es", VE: "es", UY: "es", PY: "es", BO: "es", EC: "es", DO: "es", GT: "es", CR: "es", PA: "es", HN: "es", NI: "es", SV: "es", CU: "es",
  IT: "it", SM: "it", VA: "it",
};

const CURRENCY_COOKIE = "cartoonova_currency";
const COUNTRY_COOKIE = "cartoonova_country";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const country = request.headers.get("x-vercel-ip-country") || "";

  // Root-path geo-redirect: send the user to the locale matching their country
  // before next-intl falls back to the default. Respect existing NEXT_LOCALE cookie.
  if (pathname === "/") {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const validCookie = cookieLocale && (locales as readonly string[]).includes(cookieLocale) ? cookieLocale : null;
    const fromCountry = country ? countryLocaleMap[country.toUpperCase()] : null;
    const target = validCookie ?? fromCountry ?? "en";
    return NextResponse.redirect(new URL(`/${target}`, request.url));
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
    "/((?!api|_next|_vercel|success|confirm-poster|.*\\..*).*)",
  ],
};
