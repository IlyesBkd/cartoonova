/* Pictogrammes des quatre cartes « Pourquoi nous ».
   Le paquet posait un substitut LOGO dans ce slot (46x46) ; ces quatre icones
   le remplacent, dessinees dans la palette et au meme gabarit. */

const TAILLE = { width: 46, height: 46, display: "block" as const };

export default function IconesAtouts({ index }: { index: number }) {
  const commun = {
    viewBox: "0 0 48 48",
    fill: "none",
    style: TAILLE,
    "aria-hidden": true as const,
    xmlns: "http://www.w3.org/2000/svg",
  };

  // 01 — apercu rapide : un chronometre
  if (index === 1) {
    return (
      <svg {...commun}>
        <circle cx="24" cy="27" r="16" fill="var(--soleil-pale)" stroke="var(--encre)" strokeWidth="3" />
        <path d="M24 18v9l6 4" stroke="var(--encre)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 6h10M24 6v5" stroke="var(--encre)" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 12l3 3" stroke="var(--soleil-fonce)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // 02 — retouches illimitees : une fleche circulaire
  if (index === 2) {
    return (
      <svg {...commun}>
        <circle cx="24" cy="24" r="16" fill="var(--soleil-pale)" />
        <path
          d="M38 24a14 14 0 1 1-4.1-9.9"
          stroke="var(--encre)"
          strokeWidth="3.4"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M38 8v8h-8" stroke="var(--encre)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M18 24l4 4 8-8" stroke="var(--soleil-fonce)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }

  // 03 — n'importe quelle photo : un appareil photo
  if (index === 3) {
    return (
      <svg {...commun}>
        <rect x="4" y="13" width="40" height="29" rx="6" fill="var(--soleil-pale)" stroke="var(--encre)" strokeWidth="3" />
        <path d="M17 13l3-5h8l3 5" stroke="var(--encre)" strokeWidth="3" strokeLinejoin="round" fill="none" />
        <circle cx="24" cy="28" r="8" fill="var(--papier)" stroke="var(--encre)" strokeWidth="3" />
        <circle cx="24" cy="28" r="3" fill="var(--soleil-fonce)" />
      </svg>
    );
  }

  // 04 — paiement securise : un bouclier
  return (
    <svg {...commun}>
      <path
        d="M24 4l16 6v12c0 11-7 18-16 22-9-4-16-11-16-22V10l16-6Z"
        fill="var(--soleil-pale)"
        stroke="var(--encre)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M16 24l6 6 11-12" stroke="var(--soleil-fonce)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
