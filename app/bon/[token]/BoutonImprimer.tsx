"use client";

/** Le seul geste de la page : imprimer, ou enregistrer en PDF. */
export default function BoutonImprimer({ libelle }: { libelle: string }) {
  return (
    <button type="button" className="bouton bouton--primaire bon-imprimable__bouton" onClick={() => window.print()}>
      {libelle}
    </button>
  );
}
