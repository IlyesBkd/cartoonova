import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { locales } from "@/i18n/config";

const intlMiddleware = createIntlMiddleware(routing);

const COUNTRY_TO_LOCALE: Record<string, (typeof locales)[number]> = {
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", CH: "fr",
  DE: "de", AT: "de", LI: "de",
  ES: "es", AR: "es", MX: "es", CL: "es", CO: "es", PE: "es", VE: "es", UY: "es", PY: "es", BO: "es", EC: "es", DO: "es", GT: "es", CR: "es", PA: "es", HN: "es", NI: "es", SV: "es", CU: "es",
  IT: "it", SM: "it", VA: "it",
};

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === "/") {
    const country = req.headers.get("x-vercel-ip-country");
    const fromCookie = req.cookies.get("NEXT_LOCALE")?.value;
    const target =
      (fromCookie && (locales as readonly string[]).includes(fromCookie) ? fromCookie : null) ??
      (country ? COUNTRY_TO_LOCALE[country.toUpperCase()] : null) ??
      "en";
    return NextResponse.redirect(new URL(`/${target}`, req.url));
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
