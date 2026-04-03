"use client";

import { ProductColorProvider } from "@/components/ProductColorProvider";

export default function RickAndMortyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductColorProvider product="rickandmorty">
      {children}
    </ProductColorProvider>
  );
}
