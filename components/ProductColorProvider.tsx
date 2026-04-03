"use client";

import { createContext, useContext, ReactNode } from "react";

export type ProductColorScheme = {
  gradient: string;
  hoverBg: string;
  accentHex: string;
};

const DEFAULT_COLORS: ProductColorScheme = {
  gradient: "from-amber-400 to-yellow-400",
  hoverBg: "hover:bg-amber-100",
  accentHex: "#fbbf24",
};

export const PRODUCT_COLOR_SCHEMES: Record<string, ProductColorScheme> = {
  simpson: {
    gradient: "from-amber-400 to-yellow-400",
    hoverBg: "hover:bg-amber-100",
    accentHex: "#fbbf24",
  },
  dbz: {
    gradient: "from-orange-400 to-orange-500",
    hoverBg: "hover:bg-orange-100",
    accentHex: "#f97316",
  },
  disney: {
    gradient: "from-pink-400 to-pink-500",
    hoverBg: "hover:bg-pink-100",
    accentHex: "#f472b6",
  },
  ghibli: {
    gradient: "from-emerald-400 to-green-500",
    hoverBg: "hover:bg-emerald-100",
    accentHex: "#34d399",
  },
  onepiece: {
    gradient: "from-amber-500 to-orange-500",
    hoverBg: "hover:bg-amber-100",
    accentHex: "#f59e0b",
  },
  rickandmorty: {
    gradient: "from-lime-400 to-green-500",
    hoverBg: "hover:bg-lime-100",
    accentHex: "#a3e635",
  },
};

const ProductColorContext = createContext<ProductColorScheme>(DEFAULT_COLORS);

export function ProductColorProvider({ 
  children, 
  product 
}: { 
  children: ReactNode; 
  product?: string;
}) {
  const colors = product && PRODUCT_COLOR_SCHEMES[product] 
    ? PRODUCT_COLOR_SCHEMES[product] 
    : DEFAULT_COLORS;

  return (
    <ProductColorContext.Provider value={colors}>
      {children}
    </ProductColorContext.Provider>
  );
}

export function useProductColors() {
  return useContext(ProductColorContext);
}
