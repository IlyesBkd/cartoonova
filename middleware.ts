import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

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

const CURRENCY_COOKIE = "cartoonova_currency";

export default function middleware(request: NextRequest) {
  // Skip next-intl for /success (standalone page, no locale needed)
  const pathname = request.nextUrl.pathname;
  if (pathname === "/success" || pathname.startsWith("/success?")) {
    const response = NextResponse.next();

    // Still set currency cookie if needed
    const existingCurrency = request.cookies.get(CURRENCY_COOKIE)?.value;
    if (!existingCurrency) {
      const country = request.headers.get("x-vercel-ip-country") || "";
      const detectedCurrency = countryCurrencyMap[country.toUpperCase()] || "EUR";
      response.cookies.set(CURRENCY_COOKIE, detectedCurrency, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return response;
  }

  // Run next-intl middleware for all other routes
  const response = intlMiddleware(request);

  // Currency detection — only set if no cookie exists
  const existingCurrency = request.cookies.get(CURRENCY_COOKIE)?.value;

  if (!existingCurrency) {
    // Vercel Edge: x-vercel-ip-country header
    const country = request.headers.get("x-vercel-ip-country") || "";

    const detectedCurrency = countryCurrencyMap[country.toUpperCase()] || "EUR";

    response.cookies.set(CURRENCY_COOKIE, detectedCurrency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except API routes, static files, etc.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
