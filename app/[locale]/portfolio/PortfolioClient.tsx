"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLien } from "@/components/useLien";
import Etoiles from "@/components/tj/Etoiles";
import type { Categorie } from "@/lib/catalogue";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

/** Un montage avant/apres reel, prepare cote serveur (page.tsx). */
export interface RealisationPortfolio {
  /** Slug canonique : cle React stable d'une langue a l'autre. */
  cle: string;
  /** Slug de la fiche dans la langue courante, pour le lien. */
  lien: string;
  univers: string;
  categorie: Categorie;
  image: string;
}

/* Le portfolio montrait dix-huit dessins finis, Simpson pour l'essentiel, sans
   une seule photo d'origine : rien qui reponde a la question du visiteur —
   « est-ce que ce sera moi ? ». Il montre maintenant, pour chaque univers qui
   en a un, le montage photo d'origine + portrait, et renvoie vers la fiche. */
export default function PortfolioPage({
  realisations,
  categories,
}: {
  realisations: RealisationPortfolio[];
  categories: { cle: Categorie; nom: string }[];
}) {
  const t = useTranslations("tj");
  const th = useTranslations("home");
  const tp = useTranslations("portfolio");
  const tn = useTranslations("nav");
  const lien = useLien();

  const [filtre, setFiltre] = useState<Categorie | "tous">("tous");
  const visibles = filtre === "tous" ? realisations : realisations.filter((r) => r.categorie === filtre);

  return (
    <>
      <section className="entete-page">
        <div className="enveloppe">
          <div className="hero__oeil" style={{ justifyContent: "center" }}>
            <Etoiles /> {t("heroOeil")}
          </div>
          <h1>
            {th("galleryTitle")} <span className="accent">{t("stylesAccent")}</span>
          </h1>
          <p>{tp("intro")}</p>
        </div>
      </section>

      <section className="section">
        <div className="enveloppe">
          {categories.length > 1 && (
            <div className="filtres portfolio-filtres" role="group" aria-label={tp("filtresLabel")}>
              <button
                type="button"
                className="filtre"
                aria-pressed={filtre === "tous"}
                onClick={() => {
                  setFiltre("tous");
                  mesure(MESURES.portfolioFiltre, { filter: "tous" });
                }}
              >
                {t("filtreTous")} ({realisations.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.cle}
                  type="button"
                  className="filtre"
                  aria-pressed={filtre === c.cle}
                  onClick={() => {
                    setFiltre(c.cle);
                    mesure(MESURES.portfolioFiltre, { filter: c.cle });
                  }}
                >
                  {c.nom} ({realisations.filter((r) => r.categorie === c.cle).length})
                </button>
              ))}
            </div>
          )}

          <ul className="portfolio-grille">
            {visibles.map((r, i) => (
              <li key={r.cle} className="portfolio-carte">
                <div className="portfolio-carte__visuel">
                  {/* Montage montre en entier (`contain`) : recadre, il
                      perdrait la photo d'origine posee sur un bord — c'est-a-
                      dire precisement ce qu'il prouve. */}
                  <Image
                    src={r.image}
                    alt={tp("alt", { univers: r.univers })}
                    fill
                    sizes="(max-width: 599px) 92vw, (max-width: 999px) 46vw, 380px"
                    loading={i < 2 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                  />
                </div>
                <div className="portfolio-carte__pied">
                  <span className="portfolio-carte__univers">{r.univers}</span>
                  <Link
                    className="portfolio-carte__lien"
                    href={lien(`/${r.lien}`)}
                    aria-label={tp("voirStyle", { univers: r.univers })}
                  >
                    {tp("ceStyle")} <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="portfolio-cta">
            <Link className="bouton bouton--primaire" href={lien("/collections")}>
              {tn("cta")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
