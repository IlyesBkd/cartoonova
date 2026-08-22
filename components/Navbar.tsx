"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import LanguageAndCurrencySwitcher from "@/components/LanguageAndCurrencySwitcher";
import TeteAide from "@/components/tj/TeteAide";
import { EVENEMENT_AIDE } from "@/components/ChatWidget";
import Icone, { type NomIcone } from "@/components/tj/Icone";
import { useLien } from "@/components/useLien";
import type { CleAffichee, EvenementAffiche } from "@/lib/evenements";
import {
  CATEGORIES,
  CATEGORIES_AFFICHAGE,
  NOMS_CATEGORIE,
  NOMS_CATEGORIE_COURT,
  SLUG_PHARE,
  VEDETTES,
  produitsParCategorie,
  slugProduit,
  titreProduit,
  universProduit,
  type Categorie,
  type Produit,
} from "@/lib/catalogue";

/* En-tete du systeme ToonJaune (blocs/entete.html) : barre promo indigo,
   en-tete collante, logo a gauche, menu a droite, bouton d'action.

   La navigation reprend la structure de cartoontoi.fr — un menu par famille
   de styles plutot qu'un unique menu « Styles » qui deversait les 36 fiches
   d'un coup. Chaque famille ouvre un panneau illustre : les vignettes viennent
   du serveur (voir app/[locale]/layout.tsx), un composant client ne pouvant
   pas lire `public/`. */

/** Delai avant fermeture au survol : traverser un blanc de 2 px entre le
 *  declencheur et son panneau ne doit pas refermer le menu sous le curseur. */
const DELAI_FERMETURE = 160;

/** Le pictogramme qui accompagne le discours de chaque temps fort. */
const ICONES_EVENEMENT: Record<CleAffichee, NomIcone> = {
  noel: "sapin",
  saintValentin: "coeur",
  feteDesMeres: "cadeau",
  feteDesPeres: "cadeau",
  halloween: "fete",
  blackFriday: "eclair",
  anniversaire: "cadeau",
};

export default function Navbar({
  vignettes = {},
  evenement = null,
}: {
  vignettes?: Record<string, string>;
  /** Temps fort du moment (fête des mères, Noël…), ou null hors période. */
  evenement?: EvenementAffiche | null;
}) {
  const [menuOuvert, setMenuOuvert] = useState<Categorie | null>(null);
  const [replieOuvert, setReplieOuvert] = useState(false);
  const [sectionRepliee, setSectionRepliee] = useState<Categorie | null>(null);
  const enteteRef = useRef<HTMLElement>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locale = useLocale() as Locale;
  const t = useTranslations("tj");
  const tn = useTranslations("nav");
  const tp = useTranslations("product");
  const tEvt = useTranslations("evenements");
  const lien = useLien();
  const chemin = usePathname();

  const annulerFermeture = () => {
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
  };

  const ouvrir = (categorie: Categorie) => {
    annulerFermeture();
    setMenuOuvert(categorie);
  };

  const programmerFermeture = () => {
    annulerFermeture();
    minuterie.current = setTimeout(() => setMenuOuvert(null), DELAI_FERMETURE);
  };

  useEffect(() => () => annulerFermeture(), []);

  /* Un clic sur un lien du panneau ne fermait le menu que parce que chaque
     lien portait son propre onClick. Fermer sur changement d'URL couvre aussi
     le retour arriere et les liens ajoutes plus tard.

     Ajustement pendant le rendu et non dans un effet : un effet rouvrirait
     brievement le menu sur la page d'arrivee, le temps d'un second rendu. */
  const [cheminPrecedent, setCheminPrecedent] = useState(chemin);
  if (chemin !== cheminPrecedent) {
    setCheminPrecedent(chemin);
    setMenuOuvert(null);
    setReplieOuvert(false);
    setSectionRepliee(null);
  }

  useEffect(() => {
    const auClic = (e: MouseEvent) => {
      if (enteteRef.current && !enteteRef.current.contains(e.target as Node)) {
        setMenuOuvert(null);
      }
    };
    document.addEventListener("mousedown", auClic);
    return () => document.removeEventListener("mousedown", auClic);
  }, []);

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOuvert(null);
        setReplieOuvert(false);
      }
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, []);

  const liens = [
    { libelle: t("navEtapes"), href: "/#etapes" },
    { libelle: tn("reviews"), href: "/avis" },
    { libelle: t("navFaq"), href: "/#faq" },
  ];

  /** Le style mis en avant dans le panneau : le produit phare quand il
   *  appartient a cette famille, sinon une vedette, sinon la premiere fiche
   *  illustree — une carte de mise en avant sans visuel ne vaut pas la place
   *  qu'elle prend.
   *
   *  Le phare passait apres : la famille « Cartoon » mettait en avant Rick et
   *  Morty pour la seule raison qu'il precede Simpson dans l'ordre du
   *  catalogue. La carte la plus visible du menu vendait le mauvais produit. */
  const vedetteDe = (produits: Produit[]): Produit | null =>
    produits.find((p) => p.slug === SLUG_PHARE && vignettes[p.slug]) ??
    produits.find((p) => (VEDETTES as readonly string[]).includes(p.slug) && vignettes[p.slug]) ??
    produits.find((p) => vignettes[p.slug]) ??
    null;

  const vignetteStyle = (p: Produit, taille: number) => {
    const src = vignettes[p.slug];
    const nom = universProduit(p, locale);
    return src ? (
      <Image src={src} alt="" width={taille} height={taille} sizes={`${taille}px`} />
    ) : (
      <i aria-hidden="true">{nom.slice(0, 1)}</i>
    );
  };

  return (
    <>
      {/* Barre utilitaire. Elle ne portait que l'accroche ; les trois liens
          secondaires y remontent depuis la barre principale, qui ne tenait
          plus : quatre menus de famille + trois liens + sélecteur + bouton
          d'action dépassaient la largeur du site et rognaient le bouton.
          C'est aussi la répartition de cartoontoi.fr — la rangée principale
          n'y porte que les familles de styles. */}
      <div className="promo" data-evenement={evenement?.cle}>
        <div className="enveloppe promo__grille">
          <span aria-hidden="true" />
          <p className="promo__message">
            {evenement ? (
              <>
                <Icone
                  nom={ICONES_EVENEMENT[evenement.cle]}
                  taille={15}
                  style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 8 }}
                />
                {tEvt(`${evenement.cle}.promo` as "noel.promo")}{" "}
                <b>{tEvt(`${evenement.cle}.promoFort` as "noel.promoFort", { date: evenement.dateLimite })}</b>
              </>
            ) : (
              <>
                {t("promo")} <b>{t("promoFort")}</b>
              </>
            )}
          </p>
          <nav className="promo__liens" aria-label="Navigation secondaire">
            {liens.map((l) => (
              <Link key={l.href} href={lien(l.href)}>
                {l.libelle}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <header className="entete" ref={enteteRef}>
        <div className="enveloppe entete__grille">
          <Link className="marque" href={lien("/")} aria-label="Cartoonova">
            <Image src="/logo-detoure.png" alt="Cartoonova" width={160} height={82} priority />
          </Link>

          <nav className="nav" aria-label="Navigation principale">
            {CATEGORIES_AFFICHAGE.map((categorie) => {
              const produits = produitsParCategorie(categorie);
              if (produits.length === 0) return null;
              const ouvert = menuOuvert === categorie;
              const vedette = vedetteDe(produits);

              return (
                <div
                  className="nav__groupe"
                  key={categorie}
                  onMouseEnter={() => ouvrir(categorie)}
                  onMouseLeave={programmerFermeture}
                >
                  <button
                    type="button"
                    className="nav__declencheur"
                    aria-expanded={ouvert}
                    aria-controls={`menu-${categorie}`}
                    onClick={() => (ouvert ? setMenuOuvert(null) : ouvrir(categorie))}
                  >
                    {NOMS_CATEGORIE_COURT[categorie][locale]}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {ouvert && (
                    <div
                      className="nav__panneau"
                      id={`menu-${categorie}`}
                      onMouseEnter={annulerFermeture}
                      onMouseLeave={programmerFermeture}
                    >
                      <div className="nav__colonne">
                        <div className="nav__tete">
                          <h5>{NOMS_CATEGORIE[categorie][locale]}</h5>
                          <span>
                            {produits.length}{" "}
                            {produits.length > 1 ? t("produitsCompte") : t("catalogueCompteUn")}
                          </span>
                        </div>

                        <ul className="nav__liste">
                          {produits.map((p) => (
                            <li key={p.slug}>
                              <Link className="nav__style" href={lien(`/${slugProduit(p, locale)}`)}>
                                <span className="nav__style__vignette">{vignetteStyle(p, 48)}</span>
                                <span className="nav__style__nom">{universProduit(p, locale)}</span>
                                <svg
                                  className="nav__style__fleche"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  aria-hidden="true"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                            </li>
                          ))}
                        </ul>

                        <div className="nav__pied">
                          <Link className="nav__tout" href={lien(`/collections#${categorie}`)}>
                            {tn("viewAllStyles")}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                          </Link>
                        </div>
                      </div>

                      {vedette && (
                        <Link className="nav__vedette" href={lien(`/${slugProduit(vedette, locale)}`)}>
                          <span className="nav__vedette__visuel">{vignetteStyle(vedette, 260)}</span>
                          <span className="nav__vedette__badge">{tp("bestsellerBadge")}</span>
                          <span className="nav__vedette__nom">{titreProduit(vedette, locale)}</span>
                          <span className="nav__vedette__cta">{tn("cta")}</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          </nav>

          <div className="entete__outils">
            {/* Équivalent du `.live-chat-top` de turnedyellow.com : le lien de
                l'en-tête ouvre le panneau d'aide flottant. */}
            <button
              type="button"
              className="lien-aide"
              onClick={() => window.dispatchEvent(new Event(EVENEMENT_AIDE))}
            >
              <TeteAide taille={28} />
              <span>Live Chat</span>
            </button>
            <LanguageAndCurrencySwitcher />
          </div>

          <Link className="bouton bouton--primaire" href={lien("/collections")}>
            {tn("cta")}
          </Link>

          <button
            type="button"
            className="burger"
            aria-expanded={replieOuvert}
            aria-label="Menu"
            onClick={() => setReplieOuvert((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={`replie${replieOuvert ? " ouvert" : ""}`}>
          <div className="enveloppe">
            {/* Les familles reprennent la meme hierarchie qu'en bureau, en
                accordeon : 36 fiches deroulees d'un bloc rendaient le repli
                illisible. */}
            {CATEGORIES_AFFICHAGE.map((categorie) => {
              const produits = produitsParCategorie(categorie);
              if (produits.length === 0) return null;
              const ouverte = sectionRepliee === categorie;

              return (
                <div className="replie__famille" key={categorie}>
                  <button
                    type="button"
                    className="replie__declencheur"
                    aria-expanded={ouverte}
                    onClick={() => setSectionRepliee(ouverte ? null : categorie)}
                  >
                    {NOMS_CATEGORIE[categorie][locale]}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {ouverte && (
                    <div className="replie__styles">
                      {produits.map((p) => (
                        <Link className="replie__style" key={p.slug} href={lien(`/${slugProduit(p, locale)}`)}>
                          <span className="nav__style__vignette">{vignetteStyle(p, 40)}</span>
                          {universProduit(p, locale)}
                        </Link>
                      ))}
                      <Link className="replie__tout" href={lien(`/collections#${categorie}`)}>
                        {tn("viewAllStyles")}
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}

            <nav aria-label="Navigation repliée">
              {liens.map((l) => (
                <Link key={l.href} href={lien(l.href)}>
                  {l.libelle}
                </Link>
              ))}
            </nav>

            <Link className="bouton bouton--primaire" href={lien("/collections")}>
              {tn("cta")}
            </Link>

            {/* Sous 860px le sélecteur quitte la barre : il revient ici. */}
            <div className="replie__outils">
              <LanguageAndCurrencySwitcher pleineLargeur />
            </div>
          </div>
        </div>
      </header>

      {/* Voile de profondeur derriere le panneau ouvert. Pose hors de l'en-tete
          pour rester sous elle (z-index 39 contre 40) : place a l'interieur, il
          assombrissait la barre elle-meme. */}
      <div className={`nav__voile${menuOuvert ? " nav__voile--visible" : ""}`} aria-hidden="true" />
    </>
  );
}

/** Reste exporte : d'autres modules listaient les styles depuis ce fichier. */
export function titresStyles(locale: Locale) {
  return CATEGORIES.flatMap((c) => produitsParCategorie(c).map((p) => titreProduit(p, locale)));
}
