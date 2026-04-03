"use client";

import { ProductColorProvider } from "@/components/ProductColorProvider";

export default function GhibliLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductColorProvider product="ghibli">
      {children}
    </ProductColorProvider>
  );
}
