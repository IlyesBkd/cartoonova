// Product color configurations for cartoon design
export const PRODUCT_COLORS = {
  simpson: {
    bg: "amber-50",
    accent: "yellow-400",
    accentLight: "yellow-50",
    accentDark: "yellow-500",
    gradient: "from-yellow-400 to-orange-500",
  },
  dbz: {
    bg: "orange-50",
    accent: "orange-500",
    accentLight: "orange-100",
    accentDark: "orange-600",
    gradient: "from-orange-400 to-red-500",
  },
  disney: {
    bg: "pink-50",
    accent: "pink-400",
    accentLight: "pink-100",
    accentDark: "pink-500",
    gradient: "from-pink-400 to-purple-500",
  },
  ghibli: {
    bg: "emerald-50",
    accent: "emerald-400",
    accentLight: "emerald-100",
    accentDark: "emerald-500",
    gradient: "from-emerald-400 to-teal-500",
  },
  onepiece: {
    bg: "amber-50",
    accent: "amber-500",
    accentLight: "amber-100",
    accentDark: "amber-600",
    gradient: "from-amber-400 to-orange-500",
  },
  rickandmorty: {
    bg: "lime-50",
    accent: "lime-400",
    accentLight: "lime-100",
    accentDark: "lime-500",
    gradient: "from-lime-400 to-green-500",
  },
} as const;

export type ProductKey = keyof typeof PRODUCT_COLORS;
