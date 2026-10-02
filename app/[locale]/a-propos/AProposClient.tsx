"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLien } from "@/components/useLien";
import Etoiles from "@/components/tj/Etoiles";
import IconesAtouts from "@/components/tj/IconesAtouts";

/* Page « À propos ». Tout son texte etait ecrit en francais dans le composant,
   et s'affichait tel quel sur les dix langues. Il vit maintenant dans
   `messages/*.json` (espace `aPropos`, plus le recit de `tj`, deja traduit
   mais jamais affiche). Les chiffres viennent des memes cles que le reste du
   site : les modifier a un endroit les modifie partout. */

const VALEURS = [1, 2, 3, 4] as const;

export default function AProposPage() {
  const t = useTranslations("tj");
  const ta = useTranslations("aPropos");
  const tn = useTranslations("nav");
  const tp = useTranslations("product");
  const lien = useLien();

  return (
    <>
      <section className="entete-page">
        <div className="enveloppe">
          <div className="hero__oeil" style={{ justifyContent: "center" }}>
            <Etoiles /> {t("heroOeil")}
          </div>
          <h1>
            {ta("titre")} <span className="accent">Cartoonova</span>
          </h1>
          <p>{ta("intro")}</p>
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
              {t("recitTitre")} <span className="accent">{t("recitAccent")}</span>
            </h2>
            <p>{t("recitP1")}</p>
            <p>{ta.rich("communaute", { nombre: t("preuveNombre"), b: (c) => <strong>{c}</strong> })}</p>
            <p>{t("recitP2")}</p>
          </div>
        </div>
      </section>

      {/* Chiffres */}
      <section className="section preuve">
        <div className="enveloppe">
          <div className="preuve__grille">
            <div>
              <strong>{t("preuveNombre")}</strong>
              <span>{tp("portraitsCount")}</span>
            </div>
            <div>
              <strong>{ta("avisNombre")}</strong>
              <span>{tp("verifiedReviews")}</span>
            </div>
            <div>
              <strong>{ta("paysNombre")}</strong>
              <span>{ta("paysLabel")}</span>
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
              {ta("valeursTitre")}{" "}
              <span className="accent" style={{ color: "var(--encre)" }}>
                {ta("valeursAccent")}
              </span>
            </h2>
          </div>
          <div className="atouts-grille">
            {VALEURS.map((n) => (
              <article className="atout-carte" key={n}>
                <div className="atout-carte__num">{`0${n}`}</div>
                <IconesAtouts index={n} />
                <h3>{ta(`v${n}Titre`)}</h3>
                <p>{ta(`v${n}Texte`)}</p>
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
