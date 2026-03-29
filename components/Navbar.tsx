"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import LanguageAndCurrencySwitcher from "@/components/LanguageAndCurrencySwitcher";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const t = useTranslations("nav");

  const links = [
    { label: t("home"), href: "/", icon: "🏠" },
    { label: t("collections"), href: "/collections", icon: "🎨" },
    { label: t("portfolio"), href: "/portfolio", icon: "🖼️" },
    { label: t("reviews"), href: "/avis", icon: "⭐" },
    { label: t("about"), href: "/a-propos", icon: "💡" },
    { label: t("contact"), href: "/contact", icon: "💬" },
  ];

  return (
    <>
      {/* Yellow top accent strip */}
      <div className="fixed inset-x-0 top-0 z-[60] h-1.5 bg-yellow-400" />

      <nav className="fixed inset-x-0 top-1.5 z-50">
        {/* Main bar */}
        <div className="bg-white border-b-4 border-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 sm:h-[72px]">

            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image src="/logo.webp" alt="Logo Cartoonova" width={260} height={78} className="h-16 sm:h-20" style={{ width: "auto" }} priority />
            </Link>

            {/* Desktop links — hidden below xl to prevent overflow with long translations */}
            <ul className="hidden xl:flex items-center gap-0.5">
              {links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="relative whitespace-nowrap px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide text-black hover:bg-yellow-400 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:border-black border-2 border-transparent transition-all duration-200"
                  >
                    <span className="mr-1">{l.icon}</span>{l.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Language & Currency Switcher */}
              <LanguageAndCurrencySwitcher />

              {/* CTA button */}
              <Link
                href="/collections"
                className="hidden lg:inline-flex items-center gap-1.5 whitespace-nowrap bg-yellow-400 text-black text-xs font-black uppercase px-4 py-2.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-base leading-none">✏️</span>
                {t("cta")}
              </Link>

              {/* Burger — visible below xl */}
              <button
                onClick={() => setOpen(!open)}
                className="xl:hidden w-11 h-11 rounded-xl bg-yellow-400 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center gap-[5px] cursor-pointer hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all"
                aria-label="Menu"
              >
                <span className={`block w-5 h-[3px] bg-black rounded-full transition-all duration-300 ${open ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block w-5 h-[3px] bg-black rounded-full transition-all duration-300 ${open ? "opacity-0 scale-0" : ""}`} />
                <span className={`block w-5 h-[3px] bg-black rounded-full transition-all duration-300 ${open ? "-rotate-45 -translate-y-2" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu — slide down */}
        <div className={`xl:hidden overflow-hidden transition-all duration-300 ${open ? "max-h-[500px] pointer-events-auto" : "max-h-0 pointer-events-none"}`}>
          <div className="bg-white border-b-4 border-black mx-3 mt-1 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-5">
            <ul className="flex flex-col gap-2">
              {links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-black font-black uppercase text-base border-2 border-transparent hover:border-black hover:bg-yellow-50 transition-all"
                  >
                    <span className="text-lg">{l.icon}</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t-2 border-black/10">
              <Link
                href="/collections"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 w-full bg-yellow-400 text-black font-black uppercase text-sm px-6 py-3.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-base">✏️</span>
                {t("cta")}
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
