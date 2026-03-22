"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { currencies, currencySymbols, currencyFlags, currencyNames, type Currency } from "@/lib/currency";
import { useCurrency } from "@/components/CurrencyProvider";

export default function LanguageAndCurrencySwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const switchLocale = (newLocale: Locale) => {
    // Strip any existing locale prefix from the pathname
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

    // With localePrefix: "always", every locale gets a prefix
    const newPath = `/${newLocale}${cleanPath === "/" ? "" : cleanPath}`;

    router.replace(newPath);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
      >
        <span>{localeFlags[locale]}</span>
        <span className="hidden sm:inline">{localeNames[locale]}</span>
        <span className="text-black/30">|</span>
        <span>{currencyFlags[currency]}</span>
        <span className="hidden sm:inline">{currencySymbols[currency]}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-[100] animate-fadeIn">
          {/* Language section */}
          <div className="p-4 border-b-4 border-black">
            <p className="text-xs font-black text-black/60 uppercase tracking-wider mb-3">
              🌍 Langue
            </p>
            <div className="grid grid-cols-2 gap-2">
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => switchLocale(l)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black uppercase border-2 transition-all cursor-pointer ${
                    locale === l
                      ? "bg-yellow-400 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-white border-black/20 hover:border-black hover:bg-yellow-50"
                  }`}
                >
                  <span className="text-base">{localeFlags[l]}</span>
                  <span>{localeNames[l]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Currency section */}
          <div className="p-4">
            <p className="text-xs font-black text-black/60 uppercase tracking-wider mb-3">
              💰 Devise
            </p>
            <div className="grid grid-cols-2 gap-2">
              {currencies.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCurrency(c);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-black border-2 transition-all cursor-pointer ${
                    currency === c
                      ? "bg-yellow-400 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-white border-black/20 hover:border-black hover:bg-yellow-50"
                  }`}
                >
                  <span className="text-base">{currencyFlags[c]}</span>
                  <span>{currencySymbols[c]} {currencyNames[c]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
