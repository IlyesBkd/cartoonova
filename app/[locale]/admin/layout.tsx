import type { Metadata } from "next";

/* Le back-office etait servi avec `index, follow` — herite du layout de
   `[locale]` — et le `Disallow: /admin/` de robots.txt ne le couvrait pas, le
   chemin reel etant prefixe par la langue (`/fr/admin`). Les deux sont
   corriges : ici pour l'indexation, dans `app/robots.ts` pour l'exploration. */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
