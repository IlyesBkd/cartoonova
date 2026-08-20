"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";
import ChatWidget from "@/components/ChatWidget";
import ExitIntentDialog from "@/components/ExitIntentDialog";
import { SLUGS_PRODUIT } from "@/lib/catalogue";
import type { EvenementAffiche } from "@/lib/evenements";

export default function LayoutShell({
  children,
  /** Vignette de chaque style, calculee cote serveur — voir app/[locale]/layout.tsx. */
  vignettes = {},
  /** Temps fort du moment, ou null hors periode. */
  evenement = null,
}: {
  children: React.ReactNode;
  vignettes?: Record<string, string>;
  evenement?: EvenementAffiche | null;
}) {
  const pathname = usePathname();
  const nu = pathname.includes("/admin") || pathname.includes("/simpson-mockups");

  if (nu) return <>{children}</>;

  const surFicheProduit = pathname
    .split("/")
    .filter(Boolean)
    .some((segment) => SLUGS_PRODUIT.includes(segment));

  return (
    <>
      <Navbar vignettes={vignettes} evenement={evenement} />
      <main>{children}</main>
      <FooterCartoon />
      <ChatWidget />
      {surFicheProduit && <ExitIntentDialog />}
    </>
  );
}
