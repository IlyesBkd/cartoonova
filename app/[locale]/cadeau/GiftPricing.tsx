"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCurrency } from "@/components/CurrencyProvider";
import { loadProductPrices, PRICE_MESSAGES } from "@/lib/productPrices";
import type { Currency } from "@/lib/currency";
import type { Prices } from "@/lib/types";
import { computeOrderSubtotal } from "@/lib/pricing";

const GiftPriceContext = createContext<Prices | null>(null);

/** One approved grid for every card, never a conversion of the EUR base. */
export function GiftPricingProvider({ initialPrices, children }: { initialPrices: Prices | null; children: ReactNode }) {
  const { currency, pret } = useCurrency();
  const [grid, setGrid] = useState<{ currency: Currency; prices: Prices | null; error: boolean } | null>(
    () => initialPrices ? { currency: "EUR", prices: initialPrices, error: false } : null,
  );
  const [attempt, setAttempt] = useState(0);
  const prices = pret && grid?.currency === currency ? grid.prices : null;
  const error = pret && grid?.currency === currency && grid.error;
  const messages = PRICE_MESSAGES[useLocale()] ?? PRICE_MESSAGES.en;

  useEffect(() => {
    if (!pret) return;
    const controller = new AbortController();
    const request = currency === "EUR" && initialPrices
      ? Promise.resolve(initialPrices)
      : loadProductPrices(currency, { signal: controller.signal });
    request.then(prices => {
      if (!controller.signal.aborted) setGrid({ currency, prices, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setGrid({ currency, prices: null, error: true });
    });
    return () => controller.abort();
  }, [currency, pret, initialPrices, attempt]);

  return <GiftPriceContext.Provider value={prices}>
    {error ? <div role="alert" className="enveloppe">
      <p>{messages.unavailable}</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)}>{messages.retry}</button>
    </div> : null}
    {children}
  </GiftPriceContext.Provider>;
}

export function GiftStartingPrice({ className }: { className?: string }) {
  const prices = useContext(GiftPriceContext);
  const { formatRaw } = useCurrency();
  const t = useTranslations("cadeauPage");
  return <span className={className} aria-busy={!prices}>{prices ? t("aPartirDe", { prix: formatRaw(prices.base) }) : "—"}</span>;
}

/** Illustrative digital portrait, no paid options, using the approved currency grid. */
export function GiftExampleTotal({ people }: { people: number }) {
  const prices = useContext(GiftPriceContext);
  const { formatRaw } = useCurrency();
  return <span aria-busy={!prices}>{prices ? formatRaw(computeOrderSubtotal(prices, { format: "portrait", people, animals: 0, printKey: "digital" })) : "—"}</span>;
}

/** Keep the shared visitor currency (and its cookie) on the product route. */
export function GiftConfiguratorLink({ href, className, children, onClick }: { href: string; className?: string; children: ReactNode; onClick?: () => void }) {
  const prices = useContext(GiftPriceContext);
  return prices ? <Link href={href} className={className} onClick={onClick}>{children}</Link>
    : <span role="link" aria-disabled="true" className={className}>{children}</span>;
}
