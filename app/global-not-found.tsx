import type { Metadata } from "next";
import Link from "next/link";
import MesurePage404 from "@/components/MesurePage404";
import "./globals.css";

/* 404 des URL qu'aucune route ne couvre. Le site a deux mises en page racines
   (`[locale]` et `(hors-langue)`) : il n'y en a plus une seule ou composer la
   404 de dernier recours, d'ou ce document complet. En pratique presque rien
   n'arrive ici : `proxy.ts` renvoie les chemins sans langue vers `/fr`, et
   les URL inconnues sous une langue passent par `app/[locale]/not-found.tsx`,
   dans la coque du site. Bilingue faute de savoir qui visite. */

export const metadata: Metadata = {
  title: "404 — Cartoonova",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="fr">
      <body>
        <MesurePage404 />
        <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", textAlign: "center", padding: "48px 16px" }}>
          <div>
            <h1>404</h1>
            <p>Cette page n&apos;existe pas. · This page does not exist.</p>
            <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
              <Link href="/fr" className="bouton bouton--primaire">Accueil</Link>
              <Link href="/en" className="bouton bouton--fantome">Home</Link>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
