"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { capturerOrigine } from "@/lib/origineVisite";
import Navbar from "@/components/Navbar";
import FooterCartoon from "@/components/FooterCartoon";
import { SLUGS_PRODUIT_TOUTES_LANGUES } from "@/lib/catalogue";
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

  /* Toutes langues confondues : depuis la localisation des slugs, une fiche
     anglaise s'appelle /en/custom-naruto-portrait et ne figure pas dans la
     liste francaise. */
  const surFicheProduit = pathname
    .split("/")
    .filter(Boolean)
    .some((segment) => SLUGS_PRODUIT_TOUTES_LANGUES.includes(segment));

  /* Le blog aussi. Il ne captait rien : un lecteur d'article repartait sans
     qu'on lui ait rien propose, alors que le pied de page seul ne retient
     personne. Or le blog devient la porte d'entree — les sujets tires du
     corpus visent la longue traine, la seule que ce site puisse gagner
     aujourd'hui. Un lecteur qui repart est plus cher ici qu'ailleurs.

     La liste des articles est exclue a dessein : on y est encore en train de
     choisir, l'interruption y serait gratuite. */
  const surArticle = /\/blog\/[^/]+/.test(pathname);

  const captureUtile = surFicheProduit || surArticle;

  return (
    <>
      <Navbar vignettes={vignettes} evenement={evenement} />
      <main>{children}</main>
      <FooterCartoon />
      <ChatWidget />
      {captureUtile && (
        <ExitIntentDialog source={surArticle ? "exit_intent_blog" : "exit_intent_fiche"} />
      )}
    </>
  );
}
