import "../../globals.css";

/* Meme parti que /suivi : la page arrive depuis un e-mail, hors du segment
   [locale], et porte sa propre coque, sans en-tete ni pied de site. */

export default function BonusLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
