"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/components/CurrencyProvider";
import ProductCard from "@/components/collections/ProductCard";
import Link from "next/link";

const PRODUCTS = [
  {
    slug: "simpson",
    emoji: "🟡",
    image: "/simpson_photos_produit/0009_1.jpg",
    hoverColor: "#FFD700",
  },
  {
    slug: "onepiece",
    emoji: "🏴‍☠️",
    image: "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.webp",
    hoverColor: "#CC0000",
  },
  {
    slug: "dbz",
    emoji: "⚡",
    image: "/dbz/Photo_produits/1.webp",
    hoverColor: "#FF6B00",
  },
  {
    slug: "ghibli",
    emoji: "🌸",
    image: "/ghibli/Photo_produits/il_794xN.7001686030_jbst.webp",
    hoverColor: "#4A7C59",
  },
  {
    slug: "rickandmorty",
    emoji: "🌀",
    image: "/rickandmorty/Photo_produits/1.webp",
    hoverColor: "#39FF14",
  },
  {
    slug: "disney",
    emoji: "✨",
    image: "/disney/Photo_produits/1.webp",
    hoverColor: "#1A1AFF",
  },
];

export default function CollectionsPage() {
  const t = useTranslations("collections");
  const { format: formatPrice } = useCurrency();

  const basePrice = 14;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50">
      {/* Hero Section */}
      <section className="pt-28 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-black uppercase mb-4 sm:mb-6 animate-fade-in-up"
            style={{ 
              textShadow: "4px 4px 0px #FFD700",
              animationDuration: "0.6s",
              animationFillMode: "both"
            }}
          >
            {t("heroTitle")}
          </h1>
          <p 
            className="text-lg sm:text-xl lg:text-2xl text-black/70 font-bold max-w-2xl mx-auto animate-fade-in-up"
            style={{ 
              animationDuration: "0.6s",
              animationDelay: "0.2s",
              animationFillMode: "both"
            }}
          >
            {t("heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {PRODUCTS.map((product, index) => (
              <div
                key={product.slug}
                className="animate-fade-in-up"
                style={{
                  animationDuration: "0.5s",
                  animationDelay: `${0.1 + index * 0.1}s`,
                  animationFillMode: "both"
                }}
              >
                <ProductCard
                  slug={product.slug}
                  emoji={product.emoji}
                  title={t(`${product.slug}.title`)}
                  description={t(`${product.slug}.description`)}
                  image={product.image}
                  hoverColor={product.hoverColor}
                  priceLabel={`${t("fromPrice")} ${formatPrice(basePrice)}`}
                  ctaLabel={t("discover")}
                  index={index}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reassurance Section */}
      <section className="py-16 sm:py-20 bg-black border-y-4 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {[
              { emoji: "🎨", text: t("reassurance1") },
              { emoji: "⚡", text: t("reassurance2") },
              { emoji: "💯", text: t("reassurance3") },
            ].map((item, i) => (
              <div 
                key={i} 
                className="flex flex-col items-center text-center group"
              >
                <span className="text-5xl sm:text-6xl mb-4 group-hover:scale-125 transition-transform duration-300">
                  {item.emoji}
                </span>
                <p className="text-white font-black text-lg sm:text-xl uppercase">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-black uppercase mb-4">
            {t("ctaTitle")}
          </h2>
          <p className="text-lg sm:text-xl text-black/70 font-bold mb-8">
            {t("ctaSubtitle")}
          </p>
          <Link
            href="/simpson"
            className="inline-flex items-center gap-3 bg-black text-yellow-400 font-black text-lg sm:text-xl uppercase px-10 sm:px-14 py-4 sm:py-5 rounded-full border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all"
          >
            <span className="text-2xl">🟡</span>
            {t("ctaButton")}
          </Link>
        </div>
      </section>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation-name: fade-in-up;
          animation-timing-function: ease-out;
        }
      `}</style>
    </div>
  );
}
