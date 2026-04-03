"use client";

import { ProductColorProvider } from "@/components/ProductColorProvider";

export default function OnePieceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductColorProvider product="onepiece">
      {children}
    </ProductColorProvider>
  );
}
