"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { currencies, currencySymbols, currencyNames, type Currency } from "@/lib/currency";
import { useCurrency } from "@/components/CurrencyProvider";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

export default function LanguageAndCurrencySwitcher({ pleineLargeur = false }: { pleineLargeur?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale() as Locale;
  const tl = useTranslations("language");
  const tc = useTranslations("currency");
  const router = useRouter();
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const switchLocale = (newLocale: Locale) => {
    /* Un changement de langue manuel signale que la redirection par pays a
       servi la mauvaise : c'est la seule mesure qui dise si la table
       pays → langue du middleware est juste, et sur quels pays elle rate. */
    if (newLocale !== locale) {
      mesure(MESURES.langueChangee, { from: locale, to: newLocale });
    }

    // Retire le préfixe de langue courant avant d'appliquer le nouveau.
    let cleanPath = pathname;
    for (const l of locales) {
      if (cleanPath === `/${l}`) {
        cleanPath = "/";
        break;
      }
      if (cleanPath.startsWith(`/${l}/`)) {
        cleanPath = cleanPath.slice(l.length + 1);
        break;
      }
    }

    // localePrefix: "always" — chaque langue a son préfixe.
    const newPath = `/${newLocale}${cleanPath === "/" ? "" : cleanPath}`;

    router.replace(newPath);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", width: pleineLargeur ? "100%" : undefined }}>
      <button
        type="button"
        className="outil"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        style={pleineLargeur ? { width: "100%", justifyContent: "center" } : undefined}
      >
        <span className="code-langue">{locale.toUpperCase()}</span>
        <span>{localeNames[locale]}</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{currencySymbols[currency]}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="menu-flottant" style={pleineLargeur ? { left: 0, right: 0 } : undefined}>
          <b>{tl("label")}</b>
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => switchLocale(l)}
              aria-current={locale === l}
            >
              <span className="code-langue">{l.toUpperCase()}</span>
              {localeNames[l]}
            </button>
          ))}

          <b>{tc("label")}</b>
          {currencies.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCurrency(c);
                setOpen(false);
              }}
              aria-current={currency === c}
            >
              <span className="code-langue">{c}</span>
              {currencySymbols[c]} {currencyNames[c]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
