"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type Currency, currencies, CURRENCY_COOKIE, convertAndFormat, convertPrice } from "@/lib/currency";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  format: (amountInEUR: number) => string;
  convert: (amountInEUR: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "EUR",
  setCurrency: () => {},
  format: (a) => `${a} €`,
  convert: (a) => a,
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : undefined;
}

function setCookieValue(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

export default function CurrencyProvider({
  children,
  initialCurrency,
  locale = "fr",
}: {
  children: ReactNode;
  initialCurrency?: Currency;
  locale?: string;
}) {
  // Devise par défaut basée sur la locale pour Google Shopping
  // en = USD, toutes les autres locales européennes = EUR
  const defaultCurrency = locale === "en" ? "USD" : "EUR";
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency || defaultCurrency);

  useEffect(() => {
    const cookieCurrency = getCookie(CURRENCY_COOKIE);
    if (cookieCurrency && currencies.includes(cookieCurrency as Currency)) {
      setCurrencyState(cookieCurrency as Currency);
    } else {
      // Si pas de cookie, utiliser la devise par défaut basée sur la locale
      setCurrencyState(defaultCurrency);
    }
  }, [defaultCurrency]);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    setCookieValue(CURRENCY_COOKIE, c);
  };

  const format = (amountInEUR: number) => convertAndFormat(amountInEUR, currency, locale);
  const convert = (amountInEUR: number) => convertPrice(amountInEUR, currency);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}
