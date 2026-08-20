"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLien } from "@/components/useLien";
import Etoiles from "@/components/tj/Etoiles";
import BadgeVerifie from "@/components/tj/BadgeVerifie";
import BulleQueue from "@/components/tj/BulleQueue";

const AVIS = [
  { nom: "Sophie M.", texte: "Absolument magnifique ! Le dessin est fidèle et la qualité d'impression est au top. Un cadeau parfait !", photo: "/simpson_photos_produit/0009_1.jpg" },
  { nom: "Thomas K.", texte: "Livraison super rapide et la qualité est tout simplement géniale. Ma femme était ravie !", photo: "/simpson_photos_produit/0015_1.jpg" },
  { nom: "Marie L.", texte: "Le cadeau parfait pour l'anniversaire de mes parents. La ressemblance est incroyable, ils ont adoré !", photo: "/simpson_photos_produit/0017_1.jpg" },
  { nom: "Pierre D.", texte: "Travail remarquable ! Le dessin nous ressemble vraiment. Absolument recommandé.", photo: "/simpson_photos_produit/0021_1.jpg" },
  { nom: "Julie R.", texte: "Service client au top et résultat bluffant. Ce ne sera pas la dernière fois que je commande ici !", photo: "/simpson_photos_produit/0048.jpg" },
  { nom: "Nicolas B.", texte: "Très agréablement surpris. Super image et un support excellent. On recommande sans hésiter.", photo: "/simpson_photos_produit/0049.jpg" },
  { nom: "Laura G.", texte: "J'ai offert un portrait à mon copain pour Noël. Il était tellement ému ! Merci Cartoonova !", photo: "/simpson_photos_produit/0029_1.jpg" },
  { nom: "Maxime P.", texte: "La qualité du Canvas est folle. On dirait un vrai tableau d'artiste accroché dans notre salon.", photo: "/simpson_photos_produit/0032-revise3.jpg" },
  { nom: "Camille F.", texte: "Mes enfants ont adoré se voir en cartoon ! Un souvenir de famille unique qu'on gardera pour toujours.", photo: "/simpson_photos_produit/IB2-18-1.jpg" },
];

export default function AvisPage() {
  const t = useTranslations("tj");
  const tn = useTranslations("nav");
  const tp = useTranslations("product");
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
            {AVIS.map((a) => (
              <article className="avis-carte" key={a.nom} style={{ flex: "unset" }}>
                <Image src={a.photo} alt="" width={1000} height={750} sizes="(max-width: 520px) 92vw, 24vw" />
                <div className="avis-bulle">
                  <div className="svg-stars">
                    <Etoiles />
                  </div>
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
