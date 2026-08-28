"use client";

import Link from "next/link";
import Image from "next/image";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

/**
 * Les fiches mises en avant sous un article, et la mesure de leurs clics.
 *
 * ── Pourquoi ce composant existe ─────────────────────────────────────────
 *
 * Le bloc etait rendu directement par la page d'article, un composant serveur
 * — donc sans `onClick`, donc sans mesure. Or c'est le seul chemin du blog
 * vers ce qui se vend, et il vient d'etre cree : le laisser aveugle
 * reviendrait a ne pas savoir si le maillage sert a quelque chose.
 *
 * `produitClique` n'etait emis que depuis le catalogue. La propriete `source`
 * separe les deux origines : un clic depuis un article de blog ne vaut pas la
 * meme chose qu'un clic depuis une grille de produits, et les melanger
 * empecherait de juger l'un ou l'autre.
 */

export interface LienProduitAffiche {
  slug: string;
  univers: string;
  visuel: string | null;
}

export default function LiensProduits({
  locale,
  titre,
  fiches,
  slugArticle,
}: {
  locale: string;
  titre: string;
  fiches: LienProduitAffiche[];
  slugArticle: string;
}) {
  if (!fiches.length) return null;

  return (
    <section className="enveloppe" style={{ paddingBlock: "clamp(30px,4vw,52px)" }}>
      <h2 className="text-2xl font-black text-black uppercase mb-6">{titre}</h2>
      <div className="grid sm:grid-cols-3 gap-6">
        {fiches.map((fiche, rang) => (
          <Link
            key={fiche.slug}
            href={`/${locale}/${fiche.slug}`}
            className="carte"
            onClick={() =>
              mesure(MESURES.produitClique, {
                source: "blog",
                produit: fiche.slug,
                article: slugArticle,
                /* Le rang dit si seule la premiere carte est cliquee — auquel
                   cas en afficher trois ne sert a rien. */
                rang: rang + 1,
                locale,
              })
            }
          >
            {fiche.visuel && (
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16 / 10",
                  background: "var(--cendre)",
                }}
              >
                <Image
                  src={fiche.visuel}
                  alt={fiche.univers}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="font-black text-base leading-snug text-black">{fiche.univers}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
