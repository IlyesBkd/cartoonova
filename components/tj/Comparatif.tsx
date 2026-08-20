"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Icone from "@/components/tj/Icone";

/**
 * Tableau comparatif.
 *
 * Chez CartoonToi ce bloc est une illustration vectorielle — c'est ce qui lui
 * donne sa tenue, mais une image ne se traduit pas, et le site tourne en cinq
 * langues. Rendu ici en HTML au meme gabarit (760 px max, centre) et avec les
 * memes jetons : meme resultat a l'ecran, traduisible.
 *
 * La colonne de droite compare a une categorie de service (le portrait genere
 * automatiquement), pas a un concurrent nomme : les quatre lignes sont vraies
 * par definition de cette categorie.
 */
export default function Comparatif() {
  const t = useTranslations("tj");

  const lignes = [t("cmp1"), t("cmp2"), t("cmp3"), t("cmp4")];

  return (
    <div className="compare-illu">
      <table className="compare">
        <thead>
          <tr>
            <th />
            <th className="compare__nous">
              <Image
                src="/logo-detoure.png"
                alt="Cartoonova"
                width={160}
                height={82}
                style={{ height: 28, width: "auto", display: "inline-block" }}
              />
            </th>
            <th>{t("comparatifEux")}</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne}>
              <th scope="row">{ligne}</th>
              <td className="compare__nous">
                <span className="compare__oui">
                  <Icone nom="coche" taille={15} />
                </span>
              </td>
              <td>
                <span className="compare__non">
                  <Icone nom="croix" taille={13} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
