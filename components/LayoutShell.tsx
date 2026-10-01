"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { capturerOrigine } from "@/lib/origineVisite";
import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";
import type { EvenementAffiche } from "@/lib/evenements";

/* Ces deux-la etaient importes en statique, donc presents dans le bundle
   initial de chaque page. Aucun des deux n'a de raison d'y etre : la bulle
   d'aide attend un clic, la relance de sortie attend que la souris quitte la
   fenetre. Ni l'un ni l'autre ne participe au premier rendu, et aucun n'a
   besoin d'exister cote serveur. */
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), { ssr: false });
const ExitIntentDialog = dynamic(() => import("@/components/ExitIntentDialog"), { ssr: false });

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

  /* L'origine est retenue au tout premier passage, et jamais ecrasee ensuite :
     un client amene par un assistant qui revient deux jours plus tard en tapant
     l'adresse a bien ete amene par l'assistant. Le dernier contact ne dirait
     que « direct », ce qui est vrai et sans interet. */
  useEffect(() => {
    capturerOrigine();
  }, []);
  const nu = pathname.includes("/admin") || pathname.includes("/simpson-mockups");

  if (nu) return <>{children}</>;

  /* La relance de sortie ne vit plus que sur les articles de blog. Un lecteur
     d'article repartait sans qu'on lui ait rien propose, et le blog devient la
     porte d'entree de la longue traine.

     Elle a quitte les fiches produit le 30 septembre 2026 : 67 affichages en
     90 jours, zero inscription. Sur mobile elle se declenche des qu'on remonte
     de 120px — ce qu'on fait sans cesse entre la galerie et les options — et
     pendant l'audit elle s'est ouverte a l'instant du clic sur « Commander ».
     Elle ne rapportait rien et coupait l'achat.

     La liste des articles est exclue a dessein : on y est encore en train de
     choisir, l'interruption y serait gratuite. */
  const surArticle = /\/blog\/[^/]+/.test(pathname);

  return (
    <>
      <Navbar vignettes={vignettes} evenement={evenement} />
      <main>{children}</main>
      <FooterCartoon />
      <ChatWidget />
      {surArticle && <ExitIntentDialog source="exit_intent_blog" />}
    </>
  );
}
