"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/components/CurrencyProvider";
import Link from "next/link";
import Image from "next/image";

const PRODUCTS = [
  {
    slug: "simpson",
    emoji: "🟡",
    image: "/simpson_photos_produit/0009_1.jpg",
    bgColor: "from-amber-400 to-yellow-400",
    accentColor: "amber-500",
    shadowColor: "rgba(251,191,36,0.6)",
  },
  {
    slug: "dbz",
    emoji: "⚡",
    image: "/dbz/Photo_produits/1.png",
    bgColor: "from-orange-400 to-orange-500",
    accentColor: "orange-500",
    shadowColor: "rgba(249,115,22,0.6)",
  },
  {
    slug: "disney",
    emoji: "✨",
    image: "/disney/Photo_produits/1.png",
    bgColor: "from-pink-400 to-pink-500",
    accentColor: "pink-500",
    shadowColor: "rgba(236,72,153,0.6)",
  },
  {
    slug: "ghibli",
    emoji: "🌸",
    image: "/ghibli/Photo_produits/il_794xN.7001686030_jbst.png",
    bgColor: "from-emerald-400 to-green-500",
    accentColor: "emerald-500",
    shadowColor: "rgba(16,185,129,0.6)",
  },
  {
    slug: "onepiece",
    emoji: "🏴‍☠️",
    image: "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.png",
    bgColor: "from-amber-500 to-orange-500",
    accentColor: "amber-600",
    shadowColor: "rgba(245,158,11,0.6)",
  },
  {
    slug: "rickandmorty",
    emoji: "🌀",
    image: "/rickandmorty/Photo_produits/1.png",
    bgColor: "from-lime-400 to-green-500",
    accentColor: "lime-500",
    shadowColor: "rgba(132,204,22,0.6)",
  },
];

export default function CollectionsPage() {
  const t = useTranslations("collections");
  const { format: formatPrice } = useCurrency();

  const basePrice = 14;

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 -left-10 w-40 h-40 rounded-full bg-amber-200/40 blur-2xl" />
          <div className="absolute top-40 right-10 w-32 h-32 rounded-full bg-pink-200/30 blur-xl" />
          <div className="absolute bottom-10 left-[30%] w-48 h-48 rounded-full bg-emerald-200/30 blur-2xl" />
          <div className="absolute -bottom-10 right-[20%] w-56 h-56 rounded-full bg-orange-200/30 blur-2xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white border-2 border-black rounded-full px-4 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mb-6">
            <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className="text-amber-500 text-sm">★</span>)}</div>
            <span className="text-gray-700 text-sm font-bold">4.9/5</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500 text-sm">+2,500 portraits</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 uppercase mb-5 leading-[1.1]">
            <span className="block">{t("heroTitle")}</span>
            <span className="text-amber-500 inline-block -rotate-1">en personnage cartoon</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 font-medium max-w-2xl mx-auto mb-8">
            {t("heroSubtitle")}
          </p>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-gray-500 text-sm">
            <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Satisfait ou remboursé</span>
            <span>✏️ Dessiné à la main</span>
            <span>⚡ Livré en 48h</span>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section title */}
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase mb-2">
              <span className="inline-block -rotate-1">Choisissez votre univers</span> 🎨
            </h2>
            <p className="text-gray-500">6 styles uniques pour votre portrait personnalisé</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {PRODUCTS.map((product, index) => (
              <Link
                key={product.slug}
                href={`/${product.slug}`}
                className="group relative bg-white rounded-2xl border-3 border-black overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-300"
                style={{ 
                  transform: `rotate(${(index % 2 === 0 ? -1 : 1) * 0.5}deg)`,
                }}
              >
                {/* Image */}
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image 
                    src={product.image} 
                    alt={t(`${product.slug}.title`)} 
                    fill 
                    className="object-cover transition-transform duration-500 group-hover:scale-110" 
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  
                  {/* Emoji badge */}
                  <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white border-2 border-black flex items-center justify-center text-2xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:scale-110 group-hover:rotate-12 transition-all">
                    {product.emoji}
                  </div>

                  {/* Price tag */}
                  <div className="absolute top-4 left-4">
                    <span className={`inline-block bg-gradient-to-r ${product.bgColor} text-black font-black text-xs uppercase px-3 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                      {t("fromPrice")} {formatPrice(basePrice)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-xl font-black text-gray-900 uppercase mb-1 group-hover:text-amber-600 transition-colors">
                    {t(`${product.slug}.title`)}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {t(`${product.slug}.description`)}
                  </p>
                  
                  {/* CTA Button */}
                  <div className={`w-full bg-gradient-to-r ${product.bgColor} text-black font-black text-sm uppercase py-3 rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] group-hover:translate-x-[2px] group-hover:translate-y-[2px] transition-all text-center`}>
                    <span className="flex items-center justify-center gap-2">
                      {t("discover")}
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantee Section */}
      <section className="py-12 bg-amber-50">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-5 text-center">
          {[
            { icon: "📸", title: "Envoyez votre photo", desc: "Un selfie suffit", rotate: "-rotate-1" },
            { icon: "🎨", title: "On dessine votre portrait", desc: "Par un artiste dédié", rotate: "rotate-1" },
            { icon: "✅", title: "Pas satisfait ?", desc: "On recommence gratuitement", rotate: "-rotate-1" },
          ].map((s, i) => (
            <div key={i} className={`flex flex-col items-center bg-white border-2 border-black rounded-2xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${s.rotate} hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all`}>
              <div className="w-14 h-14 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center text-2xl mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{s.icon}</div>
              <p className="font-black text-gray-900 text-sm uppercase">{s.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reassurance Section */}
      <section className="py-14 sm:py-16 bg-gray-900 border-y-3 border-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            {[
              { emoji: "🎨", text: t("reassurance1"), color: "text-amber-400" },
              { emoji: "⚡", text: t("reassurance2"), color: "text-orange-400" },
              { emoji: "💯", text: t("reassurance3"), color: "text-emerald-400" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-white/20 transition-all">
                  <span className="text-3xl">{item.emoji}</span>
                </div>
                <p className={`${item.color} font-black text-base sm:text-lg uppercase`}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <svg viewBox="0 0 1440 40" className="w-full -mb-1 text-amber-400" preserveAspectRatio="none"><path fill="currentColor" d="M0,20 C360,0 720,40 1080,20 C1260,10 1380,30 1440,20 L1440,40 L0,40 Z" /></svg>

      {/* Final CTA Section */}
      <section className="relative py-14 sm:py-20 bg-amber-400 overflow-hidden border-t-3 border-black">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-8 left-[8%] w-16 h-16 rounded-full bg-white/20" />
          <div className="absolute bottom-12 right-[10%] w-24 h-12 rounded-full bg-white/15" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <span key={i} className="text-black text-lg">★</span>)}
            <span className="text-black/70 font-bold text-sm ml-2">4.9/5 — 2,500+ portraits</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-black mb-3 uppercase">
            <span className="inline-block -rotate-1">{t("ctaTitle")}</span>
          </h2>
          <p className="text-base text-black/60 mb-8 max-w-lg mx-auto">
            {t("ctaSubtitle")}
          </p>
          <Link
            href="/simpson"
            className="inline-flex items-center gap-2 bg-black text-amber-400 font-black text-lg px-10 py-5 rounded-xl border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[3px] hover:translate-y-[3px] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all uppercase"
          >
            <span className="text-xl">🟡</span>
            {t("ctaButton")}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
          <p className="mt-5 text-sm text-black/40">✏️ Dessiné à la main · ⚡ Livré en 48h · 🔒 Satisfait ou remboursé</p>
        </div>
      </section>
    </div>
  );
}
