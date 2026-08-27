import { Poppins } from "next/font/google";
import "../globals.css";

/* Meme coque que `/confirm-poster` et `/success` : ces pages arrivent par
   e-mail, hors du prefixe de langue, et portent leur propre en-tete. */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export default function DepotLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${poppins.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
