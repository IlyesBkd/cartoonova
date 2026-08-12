import { NextRequest, NextResponse } from "next/server";
import { buildProductFeed, parseCurrency } from "@/lib/productFeed";
import { locales, type Locale } from "@/i18n/config";

// Catalogue Pinterest : meme format RSS que Google, a la disponibilite pres
// ("in stock" et non "in_stock").
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale: rawLocale } = await params;

  if (!(locales as readonly string[]).includes(rawLocale)) {
    return new NextResponse("Invalid locale", { status: 400 });
  }
  const locale = rawLocale as Locale;
  const currency = parseCurrency(request.nextUrl.searchParams.get("currency"), locale);

  const xml = await buildProductFeed({ locale, currency, variant: "pinterest" });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
