"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLien } from "@/components/useLien";
import Etoiles from "@/components/tj/Etoiles";
import IconesAtouts from "@/components/tj/IconesAtouts";

export default function AProposPage() {
  const t = useTranslations("tj");
  const tn = useTranslations("nav");
  const tp = useTranslations("product");
  const lien = useLien();

  const valeurs = [
    {
      titre: "100 % fait main",
      texte: "Chaque portrait est dessiné à la main par un artiste professionnel. Zéro IA, zéro modèle.",
    },
    {
      titre: "Satisfaction garantie",
      texte: "Révisions illimitées et gratuites. On ne s'arrête pas tant que vous n'êtes pas ravi.",
    },
    {
      titre: "Rapide et fiable",
      texte: "Dessin en 2 jours, impressions livrées en 5 jours ouvrés. Livraison sécurisée partout dans le monde.",
    },
    {
      titre: "Une vraie équipe",
      texte: "Quinze illustrateurs, plus de 50 pays livrés, et un support qui répond vraiment.",
    },
  ];

  return (
    <>
      <section className="entete-page">
        <div className="enveloppe">
          <div className="hero__oeil" style={{ justifyContent: "center" }}>
            <Etoiles /> {t("heroOeil")}
          </div>
          <h1>
            Bienvenue chez <span className="accent">Cartoonova</span>
          </h1>
          <p>
            Nous transformons vos plus belles photos en caricatures cartoon uniques, dessinées à la
            main par de vrais artistes.
          </p>
        </div>
      </section>

      {/* Récit de marque */}
      <section className="section">
        <div className="enveloppe recit">
          <Image
            src="/simpson_photos_produit/0009_1.jpg"
            alt=""
            width={800}
            height={600}
            sizes="(max-width: 860px) 92vw, 40vw"
          />
          <div>
            <span className="marqueur">{t("recitMarqueur")}</span>
            <h2>
              D&apos;une passion à un <span className="accent">atelier</span>
            </h2>
            <p>
              Tout a commencé avec une idée simple : et si on pouvait transformer n&apos;importe qui
              en personnage de dessin animé ?
            </p>
            <p>
              Avec plus de <strong>85 000 portraits créés</strong>{" "}
              et une communauté de clients fidèles, nous avons prouvé que l&apos;art du cartoon peut toucher tout le monde.
            </p>
            <p>
              Aujourd&apos;hui, une équipe d&apos;illustrateurs redessine chaque commande, une par
              une. Pas de génération automatique, pas de filtre : un dessin, fait par quelqu&apos;un.
            </p>
          </div>
        </div>
      </section>

      {/* Chiffres */}
      <section className="section preuve">
        <div className="enveloppe">
          <div className="preuve__grille">
            <div>
              <strong>85 000+</strong>
              <span>{tp("portraitsCount")}</span>
            </div>
            <div>
              <strong>3 000+</strong>
              <span>{tp("verifiedReviews")}</span>
            </div>
            <div>
              <strong>50+</strong>
              <span>pays livrés</span>
            </div>
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="section atouts-sec">
        <div className="enveloppe">
          <div className="chapeau">
            <span className="surtitre">{t("atoutsSurtitre")}</span>
            <h2>
              Nos <span className="accent" style={{ color: "var(--encre)" }}>valeurs</span>
            </h2>
          </div>
          <div className="atouts-grille">
            {valeurs.map((v, i) => (
              <article className="atout-carte" key={v.titre}>
                <div className="atout-carte__num">{`0${i + 1}`}</div>
                <IconesAtouts index={i + 1} />
                <h3>{v.titre}</h3>
                <p>{v.texte}</p>
              </article>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 34 }}>
            <Link className="bouton bouton--clair" href={lien("/collections")}>
              {tn("cta")} →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
