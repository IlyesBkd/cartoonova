"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLien } from "@/components/useLien";
import Etoiles from "@/components/tj/Etoiles";
import BadgeVerifie from "@/components/tj/BadgeVerifie";
import BulleQueue from "@/components/tj/BulleQueue";

/* Les temoignages etaient ecrits ici en francais, en dur, et servis tels quels
   sur /en, /de, /es, /it et /nl. Les six premiers existaient deja traduits
   sous product.review1..6 : c'etait une copie, pas un contenu distinct. Seules
   les photos restent locales — elles n'ont pas de langue. */
const PHOTOS = [
  "/simpson_photos_produit/0009_1.jpg",
  "/simpson_photos_produit/0015_1.jpg",
  "/simpson_photos_produit/0017_1.jpg",
  "/simpson_photos_produit/0021_1.jpg",
  "/simpson_photos_produit/0048.jpg",
  "/simpson_photos_produit/0049.jpg",
  "/simpson_photos_produit/0029_1.jpg",
  "/simpson_photos_produit/0032-revise3.jpg",
  "/simpson_photos_produit/IB2-18-1.jpg",
];

export default function AvisPage() {
  const t = useTranslations("tj");
  const tn = useTranslations("nav");
  const tp = useTranslations("product");
  const tAlt = useTranslations("alt");
  const lien = useLien();

  return (
    <>
      <section className="entete-page">
        <div className="enveloppe">
          <div className="hero__oeil" style={{ justifyContent: "center" }}>
            <Etoiles /> 4,9/5
          </div>
          <h1>
            {t("avisTitre")} <span className="accent">{t("avisAccent")}</span>
          </h1>
          <p>{t("temoinsTexte")}</p>
        </div>
      </section>

      <section className="section preuve">
        <div className="enveloppe">
          <div className="preuve__grille">
            <div>
              <strong>85 000+</strong>
              <span>{tp("portraitsCount")}</span>
            </div>
            <div>
              <strong>4,9/5</strong>
              <span>{tp("verifiedReviews")}</span>
            </div>
            <div>
              <strong>48 H</strong>
              <span>{t("tuileApercu")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="enveloppe">
          <div className="styles-grille">
            {PHOTOS.map((photo, i) => (
              <article className="avis-carte" key={photo} style={{ flex: "unset" }}>
                <Image
                  src={photo}
                  alt={tAlt("realisationClient")}
                  width={1000}
                  height={750}
                  sizes="(max-width: 520px) 92vw, 24vw"
                />
                <div className="avis-bulle">
                  <div className="svg-stars">
                    <Etoiles />
                  </div>
                  <p>{tp(`review${i + 1}Text`)}</p>
                  <p className="avis-signe">
                    {tp(`review${i + 1}Name`)} <BadgeVerifie />
                    <span className="verifie">{t("achatVerifie")}</span>
                  </p>
                </div>
                <div className="avis-queue">
                  <BulleQueue />
                </div>
              </article>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 44 }}>
            <Link className="bouton bouton--primaire" href={lien("/collections")}>
              {tn("cta")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
