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

export interface AvisAffiche {
  id: number;
  auteur: string;
  note: number;
  texte: string;
  creeLe: string;
}

export default function AvisPage({
  avis = [],
  stats = { nombre: 0, moyenne: 0 },
}: {
  avis?: AvisAffiche[];
  stats?: { nombre: number; moyenne: number };
}) {
  const t = useTranslations("tj");
  const tn = useTranslations("nav");
  const tp = useTranslations("product");
  const tAlt = useTranslations("alt");
  const lien = useLien();

  return (
    <>
      <section className="entete-page">
        <div className="enveloppe">
          {stats.nombre > 0 && (
            <div className="hero__oeil" style={{ justifyContent: "center" }}>
              <Etoiles /> {`${stats.moyenne.toLocaleString("fr-FR")}/5`}
            </div>
          )}
          <h1>
            {t("avisTitre")} <span className="accent">{t("avisAccent")}</span>
          </h1>
          <p>{t("temoinsTexte")}</p>
        </div>
      </section>

      {/* Chiffres : seulement les vrais. « 85 000+ » et un « 4,9/5 » de repli
          s'affichaient ici sans aucune donnee derriere. */}
      {stats.nombre > 0 && (
        <section className="section preuve">
          <div className="enveloppe">
            <div className="preuve__grille">
              <div>
                <strong>{`${stats.moyenne.toLocaleString("fr-FR")}/5`}</strong>
                <span>
                  {stats.nombre} {tp("verifiedReviews")}
                </span>
              </div>
              <div>
                <strong>{t("tuileDelai")}</strong>
                <span>{t("tuileApercu")}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="enveloppe">
          {/* Des qu'il existe de vrais avis, ils remplacent les temoignages de
              repli : ce sont les seuls rattaches a une commande, donc les seuls
              qui portent legitimement la mention « achat verifie ». Les photos
              restent, en decor, tant qu'il y en a. */}
          <div className="styles-grille">
            {avis.length > 0
              ? avis.map((a, i) => (
                  <article className="avis-carte" key={a.id} style={{ flex: "unset" }}>
                    {PHOTOS[i] && (
                      <Image
                        src={PHOTOS[i]}
                        alt={tAlt("realisationClient")}
                        width={1000}
                        height={750}
                        sizes="(max-width: 520px) 92vw, 24vw"
                      />
                    )}
                    <div className="avis-bulle">
                      <div className="svg-stars">
                        <Etoiles />
                      </div>
                      <p>{a.texte}</p>
                      <p className="avis-signe">
                        {a.auteur} <BadgeVerifie />
                        <span className="verifie">{t("achatVerifie")}</span>
                      </p>
                    </div>
                    <div className="avis-queue">
                      <BulleQueue />
                    </div>
                  </article>
                ))
              : PHOTOS.map((photo) => (
                  <article className="avis-carte" key={photo} style={{ flex: "unset" }}>
                    <Image
                      src={photo}
                      alt={tAlt("realisationClient")}
                      width={1000}
                      height={750}
                      sizes="(max-width: 520px) 92vw, 24vw"
                    />
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
