"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLien } from "@/components/useLien";
import Etoiles from "@/components/tj/Etoiles";

const PHOTOS = [
  "/simpson_photos_produit/0009_1.jpg",
  "/simpson_photos_produit/0015_1.jpg",
  "/simpson_photos_produit/0017_1.jpg",
  "/simpson_photos_produit/0021_1.jpg",
  "/simpson_photos_produit/0029_1.jpg",
  "/simpson_photos_produit/0032-revise3.jpg",
  "/simpson_photos_produit/0044_revise.jpg",
  "/simpson_photos_produit/0048.jpg",
  "/simpson_photos_produit/0049.jpg",
  "/simpson_photos_produit/43-2.png",
  "/simpson_photos_produit/IB2-18-1.jpg",
  "/simpson_photos_produit/IB4-20.jpg",
  "/DBZ/Photo_produits/1.png",
  "/Disney/Photo_produits/1.png",
  "/Ghibli/Photo_produits/il_794xN.7001686030_jbst.png",
  "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.png",
  "/rickandmorty/Photo_produits/1.png",
  "/DBZ/Photo_produits/il_1140xN.7733273072_b9q7.png",
];

export default function PortfolioPage() {
  const t = useTranslations("tj");
  const th = useTranslations("home");
  const tn = useTranslations("nav");
  const lien = useLien();

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
          <p>{th("gallerySubtitle")}</p>
        </div>
      </section>

      <section className="section">
        <div className="enveloppe">
          <div className="styles-grille">
            {PHOTOS.map((src, i) => (
              <Image
                key={src}
                className="carte__image"
                style={{ borderRadius: "var(--rayon-lg)", boxShadow: "var(--ombre)" }}
                src={src}
                alt={`${th("realizationAlt")} ${i + 1}`}
                width={800}
                height={800}
                sizes="(max-width: 520px) 92vw, (max-width: 1000px) 46vw, 24vw"
              />
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
