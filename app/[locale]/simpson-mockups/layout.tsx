import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/* Maquettes de travail : elles affichent des chiffres inventes (« 2 540 avis
   verifies ») alors que la base n'en compte aucun. Exclues des robots, elles
   restaient ouvertes a qui tapait l'adresse. Visibles en local et sur les
   previsualisations, introuvables en production. */
export default function SimpsonMockupsLayout({ children }: { children: React.ReactNode }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return children;
}
