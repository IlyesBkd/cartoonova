"use client";

import Image from "next/image";
import Link from "next/link";

interface ProductCardProps {
  slug: string;
  emoji: string;
  title: string;
  description: string;
  image: string;
  hoverColor: string;
  priceLabel: string;
  ctaLabel: string;
  index: number;
}

export default function ProductCard({
  slug,
  emoji,
  title,
  description,
  image,
  hoverColor,
  priceLabel,
  ctaLabel,
  index,
}: ProductCardProps) {
  return (
    <Link
      href={`/${slug}`}
      className="group relative block overflow-hidden rounded-2xl border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-2"
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          loading={index < 3 ? "eager" : "lazy"}
        />
        
        {/* Overlay on hover */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-70 transition-opacity duration-300"
          style={{ backgroundColor: hoverColor }}
        />
        
        {/* Badge */}
        <div className="absolute top-4 left-4 z-10">
          <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border-2 border-black font-black text-sm uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-base">{emoji}</span>
            <span className="hidden sm:inline">{slug === "onepiece" ? "One Piece" : slug === "rickandmorty" ? "Rick & Morty" : slug.charAt(0).toUpperCase() + slug.slice(1)}</span>
          </span>
        </div>

        {/* CTA Button - appears on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
          <span className="bg-white text-black font-black text-sm uppercase px-6 py-3 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            {ctaLabel} →
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 border-t-4 border-black">
        <h3 className="font-black text-xl text-black uppercase mb-1 group-hover:text-yellow-600 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-black/60 font-bold mb-3 line-clamp-1">
          {description}
        </p>
        <div className="flex items-center justify-between">
          <span 
            className="font-black text-lg"
            style={{ color: hoverColor }}
          >
            {priceLabel}
          </span>
          <span className="text-2xl group-hover:animate-bounce">
            {emoji}
          </span>
        </div>
      </div>
    </Link>
  );
}
