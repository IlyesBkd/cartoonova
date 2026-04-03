"use client";

import { ProductColorProvider } from "@/components/ProductColorProvider";

export default function DisneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductColorProvider product="disney">
      {children}
    </ProductColorProvider>
  );
}
