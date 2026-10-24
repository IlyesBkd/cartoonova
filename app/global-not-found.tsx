import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import MesurePage404 from "@/components/MesurePage404";
import PageIntrouvable from "@/components/PageIntrouvable";
import styles from "@/components/PageIntrouvable.module.css";
import "./globals.css";

// Standalone 404: the app has separate localized and post-purchase root layouts.
export const metadata: Metadata = {
  title: "Page introuvable | Cartoonova",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="fr">
      <head><title>Page introuvable | Cartoonova</title></head>
      <body>
        <MesurePage404 />
        <header className={styles.header}>
          <Link href="/fr" aria-label="Cartoonova — accueil">
            <Image src="/logo-detoure.png" alt="Cartoonova" width={110} height={56} priority />
          </Link>
          <nav aria-label="Navigation principale">
            <Link href="/fr/collections">Nos univers</Link>
            <Link href="/fr/contact">Besoin d’aide ?</Link>
          </nav>
        </header>
        <main><PageIntrouvable /></main>
        <footer className={styles.footer}>
          <span>Retrouve tous nos portraits sur Cartoonova.</span>
          <Link href="/en">English version ↗</Link>
        </footer>
      </body>
    </html>
  );
}
