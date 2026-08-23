"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useLien } from "@/components/useLien";
import { useCurrency } from "@/components/CurrencyProvider";
import { CATEGORIES, CATEGORIES_AFFICHAGE, type Categorie } from "@/lib/catalogue";
import Etoiles from "@/components/tj/Etoiles";
import Icone from "@/components/tj/Icone";
import IconesAtouts from "@/components/tj/IconesAtouts";
import IconesCta from "@/components/tj/IconesCta";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

export interface CarteCatalogue {
  slug: string;
  univers: string;
  categorie: Categorie;
  /** Deux visuels au plus : le second s'affiche au survol. */
  visuels: string[];
  accroche: string;
  nbDecors: number;
  vedette: boolean;
}

/* Page catalogue. Bâtie sur le vocabulaire du système : en-tête de page, barre
   de tri collante, .styles-grille par catégorie, puis les blocs de réassurance
   du paquet. Le tri et la recherche restent côté client — 36 fiches tiennent
   en mémoire, aucune raison de repasser par le serveur. */

export default function Catalogue({
  produits,
  nomsCategorie,
  prixDepart,
}: {
  produits: CarteCatalogue[];
  nomsCategorie: Record<Categorie, string>;
  prixDepart: number;
}) {
  const t = useTranslations("tj");
  const tc = useTranslations("collections");
  const tp = useTranslations("product");
  const th = useTranslations("home");
  const lien = useLien();
  const { format: formatPrix } = useCurrency();

  const [filtre, setFiltre] = useState<Categorie | "tous">("tous");
  const [recherche, setRecherche] = useState("");

  const terme = recherche.trim().toLowerCase();

  const resultats = useMemo(() => {
    let liste = produits;
    if (filtre !== "tous") liste = liste.filter((p) => p.categorie === filtre);
    if (terme) {
      liste = liste.filter(
        (p) =>
          p.univers.toLowerCase().includes(terme) ||
          nomsCategorie[p.categorie].toLowerCase().includes(terme)
      );
    }
    return liste;
  }, [produits, filtre, terme, nomsCategorie]);

  // Une recherche casse le regroupement : on montre une grille à plat, c'est
  // ce qu'on attend quand on cherche un nom précis.
  const enRecherche = terme.length > 0;
  const categoriesAffichees = filtre === "tous" ? CATEGORIES_AFFICHAGE : [filtre];

  const compte = `${resultats.length} ${
    resultats.length > 1 ? t("produitsCompte") : t("catalogueCompteUn")
  }`;

  /* Recherche interne et filtre par categorie.
     `resultats` accompagne le terme : une recherche a zero resultat est la
     donnee la plus utile du catalogue — elle nomme un univers que des
     visiteurs cherchent et que le site ne vend pas. Aucune autre source ne
     donne cette liste, pas meme Search Console, qui ne voit que ce sur quoi
     le site se positionne deja.
     Une seconde d'attente : sans elle, « simpson » partirait en sept
     evenements, un par lettre. */
  useEffect(() => {
    if (!terme && filtre === "tous") return;
    const minuteur = window.setTimeout(() => {
      mesure(MESURES.catalogueFiltre, {
        recherche: terme || null,
        categorie: filtre,
        resultats: resultats.length,
      });
    }, 1000);
    return () => window.clearTimeout(minuteur);
  }, [terme, filtre, resultats.length]);

  /* Quel style est clique depuis le catalogue, et depuis quelle recherche.
     Le catalogue compte trente-six fiches : sans cette mesure, rien ne dit
     lesquelles portent le trafic, ni quels termes de recherche interne ne
     trouvent rien — c'est-a-dire quels univers manquent au catalogue. */
  const carte = (p: CarteCatalogue) => (
    <Link
      className="carte"
      href={lien(`/${p.slug}`)}
      key={p.slug}
      onClick={() =>
        mesure(MESURES.produitClique, {
          slug: p.slug,
          univers: p.univers,
          category: p.categorie,
          vedette: p.vedette,
          source: "catalogue",
          recherche: recherche.trim() || null,
        })
      }
    >
      <div className="carte__visuel">
        {(p.vedette || p.nbDecors > 0) && (
          <div className="carte__marqueurs">
            {p.vedette && (
              <span className="marqueur-carte marqueur-carte--soleil">{tp("bestsellerBadge")}</span>
            )}
            {p.nbDecors > 0 && (
              <span className="marqueur-carte">
                {p.nbDecors} {t("badgeDecors")}
              </span>
            )}
          </div>
        )}

        {p.visuels[0] ? (
          <>
            <Image
              className="carte__image"
              src={p.visuels[0]}
              alt={p.univers}
              width={800}
              height={800}
              sizes="(max-width: 520px) 92vw, (max-width: 1000px) 46vw, 24vw"
            />
            {p.visuels[1] && (
              <Image
                className="carte__image carte__image--survol"
                src={p.visuels[1]}
                alt=""
                aria-hidden="true"
                width={800}
                height={800}
                sizes="(max-width: 520px) 92vw, (max-width: 1000px) 46vw, 24vw"
              />
            )}
          </>
        ) : (
          <div className="carte__image substitut">
            <span>{p.univers}</span>
            <small>{nomsCategorie[p.categorie]}</small>
          </div>
        )}
      </div>

      <div className="carte__corps">
        <h3>{p.univers}</h3>
        <p>{p.accroche}</p>
        <div className="carte__prix">
          <i>{tc("fromPrice")}</i> {formatPrix(prixDepart)}
        </div>
      </div>
    </Link>
  );

  return (
    <>
      {/* ═══ EN-TÊTE ═══ */}
      <section className="entete-page">
        <div className="enveloppe">
          <div className="hero__oeil" style={{ justifyContent: "center" }}>
            <Etoiles /> {t("heroOeil")}
          </div>
          <h1>
            {t("catalogueTitre")} <span className="accent">{t("catalogueAccent")}</span>
          </h1>
          <p>{t("catalogueSous")}</p>

          <div className="atouts" style={{ justifyContent: "center" }}>
            <div className="atout">
              <span><Icone nom="palette" taille={15} /></span> {produits.length} {t("produitsCompte")}
            </div>
            <div className="atout">
              <span><Icone nom="categories" taille={15} /></span> {CATEGORIES.length} {t("categoriesCompte")}
            </div>
            <div className="atout">
              <span><Icone nom="crayon" taille={15} /></span> {tp("handDrawn")}
            </div>
            <div className="atout">
              <span><Icone nom="eclair" taille={15} /></span> {tp("delivery48h")}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ BARRE DE TRI ═══ */}
      <div className="barre-tri">
        <div className="enveloppe barre-tri__contenu">
          <div className="filtres">
            <button
              type="button"
              className="filtre"
              aria-pressed={filtre === "tous"}
              onClick={() => setFiltre("tous")}
            >
              {t("filtreTous")} ({produits.length})
            </button>
            {CATEGORIES_AFFICHAGE.map((c) => (
              <button
                key={c}
                type="button"
                className="filtre"
                aria-pressed={filtre === c}
                onClick={() => setFiltre(c)}
              >
                {nomsCategorie[c]} ({produits.filter((p) => p.categorie === c).length})
              </button>
            ))}
          </div>

          <label className="recherche">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <span className="oeil">{t("rechercherPlaceholder")}</span>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={t("rechercherPlaceholder")}
            />
            {recherche && (
              <button type="button" aria-label={t("effacerRecherche")} onClick={() => setRecherche("")}>
                ×
              </button>
            )}
          </label>
        </div>
      </div>

      {/* ═══ GRILLE ═══ */}
      <section className="section" id="styles" style={{ paddingTop: "clamp(28px, 4vw, 44px)" }}>
        <div className="enveloppe">
          <p className="catalogue-compte" aria-live="polite">
            {compte}
          </p>

          {resultats.length === 0 ? (
            <div className="catalogue-vide">
              <h3>{t("aucunResultat")}</h3>
              <p>{t("aucunResultatAide")}</p>
              <button
                type="button"
                className="bouton bouton--primaire"
                onClick={() => {
                  setRecherche("");
                  setFiltre("tous");
                }}
              >
                {t("filtreTous")}
              </button>
            </div>
          ) : enRecherche ? (
            <div className="styles-grille">{resultats.map(carte)}</div>
          ) : (
            categoriesAffichees.map((c) => {
              const liste = resultats.filter((p) => p.categorie === c);
              if (liste.length === 0) return null;
              return (
                <div className="catalogue-groupe" key={c}>
                  <h3 id={c}>
                    {nomsCategorie[c]}
                    <small>
                      {liste.length} {liste.length > 1 ? t("produitsCompte") : t("catalogueCompteUn")}
                    </small>
                  </h3>
                  <div className="styles-grille">{liste.map(carte)}</div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* La section « Trois étapes, c'est tout » vivait ici. Retirée du site :
          l'accueil porte déjà un « Comment ça marche » illustré et détaillé
          (section .hiw), dont celle-ci n'était qu'un résumé en trois cartes. */}

      {/* ═══ ATOUTS ═══ */}
      <section className="section atouts-sec">
        <div className="enveloppe">
          <div className="chapeau">
            <span className="surtitre">{t("atoutsSurtitre")}</span>
            <h2>
              {t("atoutsTitre")}{" "}
              <span className="accent" style={{ color: "var(--encre)" }}>
                {t("atoutsAccent")}
              </span>
            </h2>
            <p>{t("atoutsSous")}</p>
          </div>
          <div className="atouts-grille">
            {[1, 2, 3, 4].map((n) => (
              <article className="atout-carte" key={n}>
                <div className="atout-carte__num">{`0${n}`}</div>
                <IconesAtouts index={n} />
                <h3>{t(`atout${n}T` as "atout1T")}</h3>
                <p>{t(`atout${n}D` as "atout1D")}</p>
              </article>
            ))}
          </div>
          <div className="preuve-ligne">
            <p>
              <strong>{t("preuveNombre")}</strong> {t("preuveTexte")}
            </p>
          </div>
        </div>
      </section>

      {/* ═══ BANNIÈRE FINALE ═══ */}
      <section className="section" style={{ paddingBlock: "clamp(34px, 4vw, 60px)" }}>
        <div className="enveloppe">
          <div className="cta-fin">
            <div className="cta-fin__texte">
              <h2>
                {t("ctaTitre")} <span className="accent">{t("ctaAccent")}</span> ?
              </h2>
              <p>{t("ctaTexte")}</p>
              {/* Pointait sur #etapes — la section « Trois étapes », retirée.
                  Un bouton « Créer mon portrait » a de toute façon plus sa
                  place sur la grille des styles que sur un texte explicatif. */}
              <a className="cta-fin__bouton" href="#styles">
                {th("createMyPortrait")}
                <IconesCta.Fleche />
              </a>
              <div className="cta-fin__atouts">
                <div>
                  <span>
                    <IconesCta.Chrono />
                  </span>{" "}
                  {t("ctaAtout1")}
                </div>
                <div>
                  <span>
                    <IconesCta.Crayon />
                  </span>{" "}
                  {t("ctaAtout2")}
                </div>
                <div>
                  <span>
                    <IconesCta.Photo />
                  </span>{" "}
                  {t("ctaAtout3")}
                </div>
              </div>
            </div>
            <div className="cta-fin__visuel" aria-hidden="true" />
          </div>
        </div>
      </section>
    </>
  );
}
