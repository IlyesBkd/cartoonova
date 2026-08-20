import type { CSSProperties } from "react";

/**
 * Jeu d'icônes du site.
 *
 * Remplace les emoji système, qui changent de dessin d'un appareil à l'autre
 * (Apple, Google, Samsung en rendent trois versions différentes) et cassent la
 * ligne graphique. Ici : un seul trait, la couleur vient de `currentColor`,
 * donc des jetons du contexte.
 *
 * Trait de 1,8 sur une grille de 24, arrondi — le même que les tuiles de la
 * fiche produit.
 */

export type NomIcone =
  | "crayon"
  | "eclair"
  | "cadenas"
  | "palette"
  | "categories"
  | "cadeau"
  | "sapin"
  | "coeur"
  | "photo"
  | "personnes"
  | "patte"
  | "image"
  | "coche"
  | "enveloppe"
  | "epingle"
  | "telephone"
  | "globe"
  | "carte-bancaire"
  | "panier"
  | "envoyer"
  | "etoile"
  | "question"
  | "discussion"
  | "alerte"
  | "croix"
  | "fete"
  | "presse-papiers"
  | "maison"
  | "camion";

const TRACES: Record<NomIcone, React.ReactNode> = {
  crayon: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  eclair: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  cadenas: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.7 1.6-1.5 0-.4-.2-.8-.5-1.1-.3-.3-.4-.6-.4-1 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" />
      <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  categories: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),
  cadeau: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S10.5 4 8 4a2.5 2.5 0 0 0 0 5h4Zm0 0s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4Z" />
    </>
  ),
  sapin: (
    <>
      <path d="M12 3 7 10h3l-4 5h4l-4 5h12l-4-5h4l-4-5h3Z" />
      <path d="M11 20v2h2v-2" />
    </>
  ),
  coeur: <path d="M12 20.5 4.5 13a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1A4.6 4.6 0 0 1 19.5 13Z" />,
  photo: (
    <>
      <rect x="2.5" y="6" width="19" height="14" rx="2.5" />
      <path d="M8 6l1.6-2.5h4.8L16 6" />
      <circle cx="12" cy="13" r="3.6" />
    </>
  ),
  personnes: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M17.5 14.4a6.2 6.2 0 0 1 3.7 5.6" />
    </>
  ),
  patte: (
    <>
      <ellipse cx="6.5" cy="10.5" rx="1.9" ry="2.6" />
      <ellipse cx="10.5" cy="7.5" rx="1.9" ry="2.6" />
      <ellipse cx="15" cy="7.8" rx="1.9" ry="2.6" />
      <ellipse cx="18.6" cy="11.4" rx="1.8" ry="2.4" />
      <path d="M12.4 13.2c2.6 0 4.6 1.9 4.6 4 0 1.7-1.3 2.8-3 2.8-1 0-1.4-.4-2.4-.4s-1.4.4-2.4.4c-1.7 0-3-1.1-3-2.8 0-2.1 2-4 4.6-4Z" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.8" />
      <path d="M3 16.5l4.5-4 3.5 3 4-4.5L21 16" />
    </>
  ),
  coche: <path d="m4.5 12.5 5 5 10-11" />,
  enveloppe: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  epingle: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  telephone: (
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6.5 3Z" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </>
  ),
  "carte-bancaire": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6 15h3" />
    </>
  ),
  panier: (
    <>
      <path d="M3 4h2.2l2.3 11.2a1.8 1.8 0 0 0 1.8 1.4h8.1a1.8 1.8 0 0 0 1.8-1.4L21 8H6" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </>
  ),
  envoyer: <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8Z" />,
  etoile: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z" />,
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4" />
      <path d="M12 17.4h.01" />
    </>
  ),
  discussion: (
    <path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.6-.34L4.2 21l1.3-3.5a6.9 6.9 0 0 1-2-4.7C3.5 8.4 7.3 5.2 12 5.2s8.5 3.2 8.5 7.2Z" />
  ),
  alerte: (
    <>
      <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  croix: <path d="M6 6l12 12M18 6 6 18" />,
  fete: (
    <>
      <path d="M3.5 20.5 8 8.5l7.5 7.5-12 4.5Z" />
      <path d="M13 3.5v2M18 6l1.5-1.5M20.5 11h2M17 13l2 2" />
    </>
  ),
  "presse-papiers": (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2.2" />
      <path d="M9 4V3a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3v1Z" />
      <path d="M9 11h6M9 15h4" />
    </>
  ),
  maison: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.8V20h13V9.8" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  camion: (
    <>
      <rect x="1.5" y="6" width="13" height="10" rx="1.6" />
      <path d="M14.5 9.5H18l3 3v3.5h-6.5Z" />
      <circle cx="5.5" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </>
  ),
};

export default function Icone({
  nom,
  taille = 20,
  plein = false,
  style,
  className,
}: {
  nom: NomIcone;
  taille?: number;
  /** Icônes pleines plutôt que filaires (étoile, cœur, coche). */
  plein?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill={plein ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={plein ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: "none", display: "block", ...style }}
    >
      {TRACES[nom]}
    </svg>
  );
}
