"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { useLien } from "@/components/useLien";
import { useCurrency } from "@/components/CurrencyProvider";
import { CATEGORIES_AFFICHAGE, NOMS_CATEGORIE, produitPhare, type Categorie } from "@/lib/catalogue";
import type { EvenementAffiche } from "@/lib/evenements";
import Etoiles from "@/components/tj/Etoiles";
import Icone from "@/components/tj/Icone";
import BulleQueue from "@/components/tj/BulleQueue";
import BadgeVerifie from "@/components/tj/BadgeVerifie";
import Comparatif from "@/components/tj/Comparatif";
import IconesCta from "@/components/tj/IconesCta";
import IconesAtouts from "@/components/tj/IconesAtouts";

const CARTES_STYLES: {
  categorie: Categorie;
  image: string;
  fond: string;
  sloganKey: "catSloganManga" | "catSloganCartoon" | "catSloganComics" | "catSloganCinema";
}[] = [
  { categorie: "manga", image: "/toonjaune/card-manga.jpg", fond: "#EBFCFF", sloganKey: "catSloganManga" },
  { categorie: "cartoon", image: "/toonjaune/card-cartoon.jpg", fond: "#FEF3FF", sloganKey: "catSloganCartoon" },
  { categorie: "comics", image: "/toonjaune/card-comics.jpg", fond: "#E0E6FF", sloganKey: "catSloganComics" },
  { categorie: "cinema", image: "/toonjaune/card-cinema.webp", fond: "#FFF7E1", sloganKey: "catSloganCinema" },
];

/* Le carrousel suit l'ordre d'affichage du site : la famille du produit phare
   ouvre la rangee, comme dans le menu et sur la page collections. Trié plutôt
   que réécrit à la main — l'ordre reste dérivé de `SLUG_PHARE`, et les visuels
   restent attachés à leur famille. */
const CARTES_STYLES_ORDONNEES = [...CARTES_STYLES].sort(
  (a, b) =>
    CATEGORIES_AFFICHAGE.indexOf(a.categorie) - CATEGORIES_AFFICHAGE.indexOf(b.categorie)
);

const FAN_IMAGES = [
  "/toonjaune/fan-1.jpg",
  "/toonjaune/fan-2.jpg",
  "/toonjaune/fan-3.jpg",
  "/toonjaune/fan-4.jpg",
  "/toonjaune/fan-5.jpg",
  "/toonjaune/fan-6.jpg",
  "/toonjaune/fan-7.jpg",
];

const DECORS_APERCU = [
  "/simpson_background/couch8x10.jpg",
  "/simpson_background/house.jpg",
  "/simpson_background/beach.jpg",
  "/simpson_background/bar.jpg",
  "/simpson_background/church.jpg",
];

export default function Accueil({
  photosAvis,
  photoHero,
  prixDepart,
  evenement = null,
}: {
  photosAvis: string[];
  photoHero: string;
  prixDepart: number;
  /** Temps fort du moment : il prend la main sur le titre et l'accroche. */
  evenement?: EvenementAffiche | null;
}) {
  const t = useTranslations("tj");
  const th = useTranslations("home");
  const tp = useTranslations("product");
  const tEvt = useTranslations("evenements");
  const lien = useLien();
  const locale = useLocale() as Locale;
  const { format: formatPrix } = useCurrency();

  const faq = [1, 2, 3, 4, 5].map((n) => ({
    q: th(`faqQ${n}` as "faqQ1"),
    a: th(`faqA${n}` as "faqA1"),
  }));

  const avis = [1, 2, 3, 4].map((n) => ({
    titre: th(`review${n}Name` as "review1Name"),
    texte: th(`review${n}Text` as "review1Text"),
    nom: th(`review${n}Name` as "review1Name"),
    photo: photosAvis[n - 1] ?? photosAvis[0],
  }));

  const [videoLance, setVideoLance] = useState(false);

  /* Tous les appels a l'action de l'accueil menaient a `/collections`, la
     grille des 36 fiches. Avec un univers attendu a 70 % des ventes, c'etait
     imposer un choix a sept visiteurs sur dix pour rien : ils repartent
     maintenant sur la fiche du produit phare, et le second bouton du hero
     ouvre le catalogue pour les trois autres.

     Le bouton NOMME l'univers ou il mene — un « Créer mon portrait » qui
     atterrit sur les Simpson serait une promesse floue. `univers` plutot que
     sa version localisee : « The Simpsons » donnerait « Create my The
     Simpsons portrait ».

     Repli sur le catalogue si le produit phare venait a etre depublie : ce
     serait 7 boutons morts d'un coup. */
  const phare = produitPhare();
  const lienPhare = phare ? lien(`/${phare.slug}`) : lien("/collections");
  const ctaPhare = phare
    ? th("createFlagship", { univers: phare.univers })
    : th("createMyPortrait");

  return (
    <>
      {/* ═══ HERO ═══
          Reprend la palette et la composition de la bannière finale « Prêt à
          te voir en dessin animé ? » : or, texte à gauche, visuel à droite,
          bouton noir en pastille, rangée d'atouts en pied. Deux écarts
          assumés : le doré court d'un bord à l'autre de la fenêtre au lieu
          d'être une plaque encadrée (c'est ce qui distingue un hero d'une
          bannière posée au milieu du flux), et la photo produit est un vrai
          <Image> et non un fond incrusté — c'est le LCP de la page, elle doit
          rester servie par next/image. */}
      <section className="hero">
        <div className="enveloppe">
          <div className="hero__grille">
            <div className="hero__texte-col">
              <div className="hero__oeil">
                <Etoiles /> {t("heroOeil")}
              </div>
              {/* Hors période, le discours permanent. En période, celui du
                  temps fort : c'est le même bloc, seul le texte change — la
                  composition du hero, elle, ne bouge pas d'un pixel. */}
              <h1>
                {evenement ? tEvt(`${evenement.cle}.heroTitre1` as "noel.heroTitre1") : th("heroTitle1")}{" "}
                <span className="accent">
                  {evenement ? tEvt(`${evenement.cle}.heroTitre2` as "noel.heroTitre2") : th("heroTitle2")}
                </span>
              </h1>
              <p className="hero__texte">
                {evenement ? tEvt(`${evenement.cle}.heroSous` as "noel.heroSous") : th("heroSubtitle")}
              </p>

              {/* Le second bouton pointait sur « Comment ça marche », qui a
                  sa place dans la barre utilitaire depuis qu'elle existe.
                  Ici, la vraie alternative au produit phare, c'est le
                  catalogue — sinon les 30 % n'ont pas de porte. */}
              <div className="hero__actions">
                <Link className="bouton bouton--noir" href={lienPhare}>
                  {ctaPhare}
                  <IconesCta.Fleche />
                </Link>
                <Link className="bouton bouton--contour" href={lien("/collections")}>
                  {t("stylesTous")}
                </Link>
              </div>
              <span className="hero__note">{t("heroNote")}</span>

              <div className="atouts">
                <div className="atout">
                  <span><Icone nom="crayon" taille={17} /></span> {tp("handDrawn")}
                </div>
                <div className="atout">
                  <span><Icone nom="eclair" taille={17} /></span> {tp("delivery48h")}
                </div>
                <div className="atout">
                  <span><Icone nom="cadenas" taille={17} /></span> {t("garantieTexte")}
                </div>
              </div>
            </div>

            <div className="hero__visuel">
              <Image
                className="hero__photo"
                src={photoHero}
                alt={th("portraitAlt")}
                width={1000}
                height={1000}
                priority
                sizes="(max-width: 1000px) 88vw, 42vw"
              />
            </div>
          </div>
        </div>
      </section>
      {/* Le bloc « hero__cta » qui se trouvait ici reprenait mot pour mot la
          bannière finale : même h2 (« Prêt à te voir en dessin animé ? »),
          même texte, mêmes trois atouts, même bouton — à 300px sous le CTA du
          hero, et en double dans le plan de titres de la page. Supprimé : le
          hero porte déjà l'appel à l'action, la bannière finale le reprend. */}

      {/* ═══ GALERIE ÉVENTAIL ═══ */}
      <section className="image-fan-section">
        <div className="image-fan-container">
          {FAN_IMAGES.map((src) => (
            <div className="fan-image-card" key={src}>
              <Image src={src} alt="" width={170} height={180} sizes="170px" />
            </div>
          ))}
        </div>
      </section>

      {/* ═══ COMMENT ÇA MARCHE ═══ */}
      <section className="section hiw" id="etapes">
        <div className="enveloppe">
          <div className="chapeau">
            <h2>{th("howItWorksLink")}</h2>
          </div>

          <div className="hiw-rows">
            <div className="hiw-step-row">
              <div className="hiw-step-image">
                <div className="hiw-step-image-inner hiw-mock hiw-mock--decor">
                  <div className="hiw-mock__barre">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p className="hiw-mock__label">{t("hiwChoisirDecor")}</p>
                  <div className="hiw-mock__vignettes">
                    {DECORS_APERCU.map((src) => (
                      <Image key={src} src={src} alt="" width={64} height={64} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="hiw-step-content">
                <span className="hiw-background-number">01</span>
                <div className="hiw-step-content-wr">
                  <h3 className="hiw-step-heading">{t("hiwStep1Titre")}</h3>
                  <p className="hiw-step-description">{t("hiwStep1Texte")}</p>
                  <Link className="hiw-step-button" href={lienPhare}>
                    {ctaPhare}
                    <IconesCta.Fleche />
                  </Link>
                </div>
              </div>
            </div>

            <div className="hiw-step-row">
              <div className="hiw-step-image">
                <div className="hiw-step-image-inner hiw-mock hiw-mock--upload">
                  <div className="hiw-mock__stack">
                    <Image src="/simpson_photos_produit/43-2.png" alt="" width={90} height={90} className="hiw-mock__photo hiw-mock__photo--1" />
                    <Image src="/simpson_photos_produit/IB2-18-1.jpg" alt="" width={90} height={90} className="hiw-mock__photo hiw-mock__photo--2" />
                  </div>
                  <div className="hiw-mock__zone">
                    <Icone nom="image" taille={26} />
                    <span>{t("hiwChoisirFichiers")}</span>
                  </div>
                </div>
              </div>
              <div className="hiw-step-content">
                <span className="hiw-background-number">02</span>
                <div className="hiw-step-content-wr">
                  <h3 className="hiw-step-heading">{t("hiwStep2Titre")}</h3>
                  <p className="hiw-step-description">{t("hiwStep2Texte")}</p>
                  <Link className="hiw-step-button" href={lienPhare}>
                    {ctaPhare}
                    <IconesCta.Fleche />
                  </Link>
                </div>
              </div>
            </div>

            <div className="hiw-step-row">
              <div className="hiw-step-image">
                <div className="hiw-step-image-inner hiw-mock hiw-mock--livraison">
                  <Image src="/simpson_photos_produit/IB4-20.jpg" alt="" width={412} height={412} className="hiw-mock__photo-pleine" />
                  <div className="hiw-mock__suivi">
                    <div className="hiw-mock__etape">
                      <span className="hiw-mock__puce" />
                      {t("hiwCommande")}
                    </div>
                    <div className="hiw-mock__etape">
                      <span className="hiw-mock__puce" />
                      {t("hiwExpediee")}
                    </div>
                    <div className="hiw-mock__etape hiw-mock__etape--actif">
                      <span className="hiw-mock__puce" />
                      {t("hiwLivree")}
                    </div>
                  </div>
                  <div className="hiw-mock__carte">
                    <span>{tp("poster")}</span>
                    <strong>{formatPrix(prixDepart)}</strong>
                  </div>
                </div>
              </div>
              <div className="hiw-step-content">
                <span className="hiw-background-number">03</span>
                <div className="hiw-step-content-wr">
                  <h3 className="hiw-step-heading">{t("hiwStep3Titre")}</h3>
                  <p className="hiw-step-description">{t("hiwStep3Texte")}</p>
                  <Link className="hiw-step-button" href={lienPhare}>
                    {ctaPhare}
                    <IconesCta.Fleche />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STYLES ═══
          Une seule section de styles au lieu de deux. Il y avait ici une grille
          `.carte` de quatre produits vedettes suivie, juste dessous, de ce
          carrousel de quatre catégories : même format, même prix, même promesse
          à deux granularités différentes. Les cartes catégorie l'emportent ;
          elles reprennent le chapeau et le bouton « voir tous les styles » de
          la grille supprimée, et l'ancre #styles reste sur cette section. */}
      <section className="section carrousel-styles" id="styles" style={{ background: "var(--cendre)" }}>
        <div className="enveloppe">
          <div className="chapeau">
            <h2>
              {t("stylesTitre")} <span className="accent">{t("stylesAccent")}</span>
            </h2>
            <p>{th("collectionsSubtitle")}</p>
          </div>
          <div className="carrousel-styles__piste">
            {CARTES_STYLES_ORDONNEES.map((c) => (
              <Link
                key={c.categorie}
                href={lien(`/collections#${c.categorie}`)}
                className="carte-style"
                style={{ background: c.fond }}
              >
                <div className="carte-style__figure">
                  <Image
                    src={c.image}
                    alt={NOMS_CATEGORIE[c.categorie][locale]}
                    width={267}
                    height={267}
                    sizes="267px"
                  />
                </div>
                <div className="carte-style__info">
                  <div className="carte-style__avis">
                    <span className="carte-style__etoiles">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                          <path
                            d="M7.5 0L9.58587 5.2731L15 5.72949L10.875 9.44483L12.1353 15L7.5 12.0231L2.86475 15L4.125 9.44483L0 5.72949L5.41414 5.2731L7.5 0Z"
                            fill="currentColor"
                          />
                        </svg>
                      ))}
                    </span>
                    <span className="carte-style__nb-avis">(1125 {t("avisSuffix")})</span>
                  </div>
                  <h3>{NOMS_CATEGORIE[c.categorie][locale]}</h3>
                  <p>{t(c.sloganKey)}</p>
                  <span className="carte-style__prix">
                    {t("personnaliser")} — {formatPrix(prixDepart)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 34 }}>
            <Link className="bouton bouton--primaire" href={lien("/collections")}>
              {t("stylesTous")}
            </Link>
          </div>
        </div>
      </section>

      {/* La section « Cartoonisés… et ravis ! » — carrousel de portraits
          clients à flèches — vivait ici. Retirée : la section « avis
          illustrés » qui suit montre les mêmes photos, signées d'un avis et
          d'un achat vérifié. Deux carrousels de portraits d'affilée disaient
          la même chose, le second en mieux. */}

      {/* ═══ AVIS ILLUSTRÉS ═══ */}
      <section className="section" id="avis" style={{ background: "var(--creme)" }}>
        <div className="enveloppe">
          <div className="chapeau" style={{ marginBottom: 34 }}>
            <h2>
              {t("avisTitre")} <span className="accent">{t("avisAccent")}</span>
            </h2>
          </div>
          <div className="avis-rail">
            {avis.map((a, i) => (
              <article className="avis-carte" key={i}>
                <Image src={a.photo} alt="" width={1000} height={750} sizes="(max-width: 620px) 80vw, 24vw" />
                <div className="avis-bulle">
                  <div className="svg-stars">
                    <Etoiles />
                  </div>
                  <h3>{a.titre}</h3>
                  <p>{a.texte}</p>
                  <p className="avis-signe">
                    {a.nom} <BadgeVerifie />
                    <span className="verifie">{t("achatVerifie")}</span>
                  </p>
                </div>
                <div className="avis-queue">
                  <BulleQueue />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ATOUTS (fond soleil) ═══ */}
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
          <div style={{ textAlign: "center", marginTop: 30 }}>
            <Link className="bouton bouton--clair" href={lienPhare}>
              {ctaPhare} →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ COMPARATIF ═══ */}
      <section className="section" style={{ background: "var(--cendre)" }}>
        <div className="enveloppe">
          <div className="chapeau">
            <h2>
              {t("comparatifTitre")} <span className="accent">{t("comparatifAccent")}</span>
            </h2>
          </div>
          <Comparatif />
        </div>
      </section>

      {/* ═══ DESSINÉ À LA MAIN ═══ */}
      <section className="dessine">
        <div className="dessine__halo" aria-hidden="true" />
        <h2 className="dessine__titre">
          {t("dessineTitre")}
          <br />
          <span className="accent">{t("dessineAccent")}</span>
        </h2>
        <div className="dessine__video" onClick={() => setVideoLance(true)}>
          {videoLance ? (
            <video
              src="/toonjaune/handdrawn-video.mp4"
              poster="/toonjaune/handdrawn-poster.jpg"
              controls
              autoPlay
              muted
              playsInline
            />
          ) : (
            <>
              <Image
                src="/toonjaune/handdrawn-poster.jpg"
                alt=""
                width={870}
                height={454}
                sizes="(max-width: 900px) 92vw, 870px"
              />
              <button type="button" className="dessine__jouer" aria-label={th("createMyPortrait")}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M6.5 4.5C6.5 3 8 2.3 9.3 3.1L21 10.6C22.2 11.4 22.2 13.1 21 13.9L9.3 21.4C8 22.2 6.5 21.5 6.5 20V4.5Z" fill="#fff" />
                </svg>
              </button>
            </>
          )}
        </div>
        <Link className="dessine__bouton" href={lienPhare}>
          {ctaPhare}
          <svg width="24" height="24" viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              d="M18.632 25C18.4085 25.0013 18.1896 24.9347 18.0033 24.8087C17.817 24.6827 17.6718 24.5029 17.586 24.2924C17.5003 24.0818 17.478 23.85 17.522 23.6265C17.566 23.403 17.6742 23.1979 17.8329 23.0374L23.798 16.9658L17.8329 10.8943C17.6486 10.6747 17.5522 10.3923 17.5631 10.1034C17.5741 9.81458 17.6915 9.54057 17.892 9.33616C18.0924 9.13176 18.3611 9.01201 18.6443 9.00086C18.9276 8.9897 19.2046 9.08795 19.4199 9.27598L26.1727 16.1624C26.3823 16.3774 26.5 16.6683 26.5 16.9716C26.5 17.2748 26.3823 17.5657 26.1727 17.7807L19.4199 24.6671C19.2102 24.8792 18.9273 24.9987 18.632 25Z"
              fill="currentColor"
            />
            <path
              opacity="0.4"
              d="M7.37936 23C7.20571 23.001 7.03569 22.9513 6.89098 22.8572C6.74627 22.7631 6.63342 22.6289 6.56683 22.4717C6.50024 22.3145 6.48292 22.1414 6.51708 21.9746C6.55124 21.8077 6.63533 21.6546 6.75863 21.5347L11.3923 17.0017L6.75863 12.4688C6.594 12.3074 6.50151 12.0886 6.50151 11.8604C6.50151 11.6322 6.594 11.4134 6.75863 11.252C6.92325 11.0906 7.14654 11 7.37936 11C7.61218 11 7.83547 11.0906 8.0001 11.252L13.2458 16.3934C13.4086 16.5539 13.5 16.7711 13.5 16.9975C13.5 17.2238 13.4086 17.441 13.2458 17.6016L8.0001 22.7429C7.91913 22.8239 7.82257 22.8883 7.71602 22.9324C7.60946 22.9766 7.49504 22.9995 7.37936 23Z"
              fill="currentColor"
            />
          </svg>
        </Link>
        <div className="dessine__avis">
          <span style={{ color: "#FFC107", display: "inline-flex" }}>
            <Etoiles largeur={106} />
          </span>
          <span>
            <strong>{t("preuveNombre")}</strong> {t("preuveTexte")}
          </span>
        </div>
      </section>

      {/* La section « Notre histoire / Pourquoi on fait ça » vivait ici.
          Retirée de l'accueil : c'est une digression au milieu d'un parcours
          d'achat. Elle reste sur /a-propos, dont elle est le sujet — les clés
          `recit*` des fichiers de langue servent toujours là-bas. */}

      {/* ═══ FAQ ILLUSTRÉE ═══ */}
      <section className="section" id="faq" style={{ background: "var(--cendre)" }}>
        <div className="enveloppe faq-illus">
          <div className="faq-visuel">
            <Image
              src="/toonjaune/faq-photo.webp"
              alt={th("portraitAlt")}
              width={1000}
              height={1000}
              sizes="(max-width: 1000px) 80vw, 38vw"
            />
          </div>
          <div>
            <h2 style={{ fontSize: "var(--t-section)", marginBottom: 12 }}>
              {t("faqTitre")} <span className="accent">{t("faqAccent")}</span>
            </h2>
            <div className="faq">
              {faq.map((f, i) => (
                <details key={i} name="faq" open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
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
              <Link className="cta-fin__bouton" href={lienPhare}>
                {ctaPhare}
                <IconesCta.Fleche />
              </Link>
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
