"use client";

import { ProductColorProvider } from "@/components/ProductColorProvider";

export default function SimpsonLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductColorProvider product="simpson">
      {children}
    </ProductColorProvider>
  );
}
