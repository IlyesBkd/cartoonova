import "../globals.css";

/* Le bon cadeau imprimable : arrive depuis un e-mail, hors de [locale], avec
   sa propre coque, comme /suivi et /bonus. */

export default function BonLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
