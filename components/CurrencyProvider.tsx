"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type Currency, currencies, CURRENCY_COOKIE, convertAndFormat, convertPrice, formatPrice } from "@/lib/currency";
import { contexte, mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  format: (amountInEUR: number) => string;
  formatRaw: (amount: number) => string;
  convert: (amountInEUR: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "EUR",
  setCurrency: () => {},
  format: (a) => `${a} €`,
  formatRaw: (a) => `${a} €`,
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
  const localeFallback: Currency = locale === "en" ? "GBP" : "EUR";
  const defaultCurrency: Currency = initialCurrency || localeFallback;
  const [currency, setCurrencyState] = useState<Currency>(defaultCurrency);

  useEffect(() => {
    const cookieCurrency = getCookie(CURRENCY_COOKIE);
    if (cookieCurrency && currencies.includes(cookieCurrency as Currency)) {
      setCurrencyState(cookieCurrency as Currency);
    } else {
      setCurrencyState(defaultCurrency);
    }
  }, [defaultCurrency]);

  const setCurrency = (c: Currency) => {
    /* Un changement de devise manuel dit que la detection par pays s'est
       trompee — et elle se trompe sur tout visiteur derriere un VPN ou en
       voyage. C'est aussi, sur les marches en cours d'ouverture, le signe le
       plus direct qu'on affiche la mauvaise monnaie. */
    if (c !== currency) {
      mesure(MESURES.deviseChangee, { from: currency, to: c });
      contexte({ currency: c });
    }
    setCurrencyState(c);
    setCookieValue(CURRENCY_COOKIE, c);
  };

  const format = (amountInEUR: number) => convertAndFormat(amountInEUR, currency, locale);
  const formatRaw = (amount: number) => formatPrice(amount, currency, locale);
  const convert = (amountInEUR: number) => convertPrice(amountInEUR, currency);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, formatRaw, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}
