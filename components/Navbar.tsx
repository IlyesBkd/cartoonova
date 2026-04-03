"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import LanguageAndCurrencySwitcher from "@/components/LanguageAndCurrencySwitcher";
import { useProductColors } from "@/components/ProductColorProvider";

const STYLES = [
  { name: "Simpson", href: "/simpson", emoji: "🟡", color: "from-amber-400 to-yellow-400" },
  { name: "Dragon Ball Z", href: "/dbz", emoji: "⚡", color: "from-orange-400 to-orange-500" },
  { name: "Disney", href: "/disney", emoji: "✨", color: "from-pink-400 to-pink-500" },
  { name: "Ghibli", href: "/ghibli", emoji: "🌸", color: "from-emerald-400 to-green-500" },
  { name: "One Piece", href: "/onepiece", emoji: "🏴‍☠️", color: "from-amber-500 to-orange-500" },
  { name: "Rick & Morty", href: "/rickandmorty", emoji: "🌀", color: "from-lime-400 to-green-500" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);
  const colors = useProductColors();

  const t = useTranslations("nav");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStylesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const links = [
    { label: t("home"), href: "/", icon: "" },
    { label: t("portfolio"), href: "/portfolio", icon: "🖼️" },
    { label: t("reviews"), href: "/avis", icon: "⭐" },
    { label: t("about"), href: "/a-propos", icon: "💡" },
    { label: t("contact"), href: "/contact", icon: "💬" },
  ];

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "py-2" : "py-3"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main bar */}
        <div className={`bg-white/95 backdrop-blur-md rounded-2xl border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 ${scrolled ? "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]" : ""}`}>
          <div className="flex items-center justify-between h-16 sm:h-[68px] px-4 sm:px-6">

            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image src="/logo.webp" alt="Logo Cartoonova" width={140} height={42} className="h-12 sm:h-14 w-auto" priority />
            </Link>

            {/* Desktop links */}
            <ul className="hidden xl:flex items-center gap-0.5 min-w-0 flex-1 justify-center mx-2">
              {/* Styles Dropdown */}
              <li className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setStylesOpen(!stylesOpen)}
                  className={`relative whitespace-nowrap px-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide text-gray-700 hover:text-black ${colors.hoverBg} border-2 border-transparent hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 flex items-center gap-1`}
                >
                  <span className="mr-0.5">🎨</span>{t("collections")}
                  <svg className={`w-3 h-3 transition-transform ${stylesOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {/* Dropdown */}
                {stylesOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white border-3 border-black rounded-xl shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-50">
                    <div className="p-2">
                      {STYLES.map((style) => (
                        <Link
                          key={style.href}
                          href={style.href}
                          onClick={() => setStylesOpen(false)}
                          className="block px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-bold text-gray-900 text-sm">{style.name}</span>
                        </Link>
                      ))}
                    </div>
                    <div className="border-t-2 border-black/10 p-2">
                      <Link
                        href="/collections"
                        onClick={() => setStylesOpen(false)}
                        className={`flex items-center justify-center gap-2 w-full bg-gradient-to-r ${colors.gradient} text-black font-black text-xs uppercase py-2.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all`}
                      >
                        {t("viewAllStyles")} →
                      </Link>
                    </div>
                  </div>
                )}
              </li>
              {links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className={`relative whitespace-nowrap px-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide text-gray-700 hover:text-black ${colors.hoverBg} border-2 border-transparent hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200`}
                  >
                    {l.icon && <span className="mr-1">{l.icon}</span>}{l.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Language & Currency Switcher */}
              <LanguageAndCurrencySwitcher />

              {/* CTA button */}
              <Link
                href="/collections"
                className={`hidden xl:inline-flex items-center gap-1.5 whitespace-nowrap bg-gradient-to-r ${colors.gradient} text-black text-[10px] font-black uppercase px-4 py-2 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all`}
              >
                {t("cta")}
              </Link>

              {/* Burger */}
              <button
                onClick={() => setOpen(!open)}
                className={`xl:hidden w-11 h-11 rounded-xl bg-gradient-to-r ${colors.gradient} border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center gap-[5px] cursor-pointer hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all`}
                aria-label="Menu"
              >
                <span className={`block w-5 h-[3px] bg-black rounded-full transition-all duration-300 ${open ? "rotate-45 translate-y-2" : ""}`} />
                <span className={`block w-5 h-[3px] bg-black rounded-full transition-all duration-300 ${open ? "opacity-0 scale-0" : ""}`} />
                <span className={`block w-5 h-[3px] bg-black rounded-full transition-all duration-300 ${open ? "-rotate-45 -translate-y-2" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`xl:hidden overflow-hidden transition-all duration-300 ${open ? "max-h-[700px] opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
          <div className="bg-white/95 backdrop-blur-md border-3 border-black rounded-2xl shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] p-4">
            {/* Styles Grid */}
            <div className="mb-3 pb-3 border-b-2 border-black/10">
              <p className="text-xs font-black text-gray-400 uppercase mb-2 px-2">🎨 {t("collections")}</p>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((style) => (
                  <Link
                    key={style.href}
                    href={style.href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-10 h-10 rounded-lg bg-gradient-to-r ${style.color} border-2 border-black flex items-center justify-center text-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                      {style.emoji}
                    </span>
                    <span className="font-bold text-gray-700 text-[10px] text-center leading-tight">{style.name}</span>
                  </Link>
                ))}
              </div>
            </div>
            <ul className="flex flex-col gap-1">
              {links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 font-bold uppercase text-sm border-2 border-transparent hover:border-black ${colors.hoverBg} hover:text-black transition-all`}
                  >
                    <span className="text-lg">{l.icon}</span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t-2 border-black/10">
              <Link
                href="/collections"
                onClick={() => setOpen(false)}
                className={`flex items-center justify-center gap-2 w-full bg-gradient-to-r ${colors.gradient} text-black font-black uppercase text-sm px-6 py-3.5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all`}
              >
                <span className="text-base">✏️</span>
                {t("cta")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
