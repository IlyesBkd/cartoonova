"use client";

import { ProductColorProvider } from "@/components/ProductColorProvider";

export default function DBZLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductColorProvider product="dbz">
      {children}
    </ProductColorProvider>
  );
}
