import "../globals.css";

/* Meme parti que confirm-poster : cette page arrive depuis un e-mail, hors du
   segment [locale]. Elle porte donc sa propre coque HTML, sans en-tete ni pied
   de site — on vient y lire un etat, pas naviguer. */

export default function SuiviLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
