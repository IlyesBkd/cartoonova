"use client";

import { useCurrency } from "./CurrencyProvider";
import JsonLd from "./JsonLd";
import { offresBonCadeau } from "@/lib/donneesStructurees";

/** No offer before the visitor currency (and visible denominations) is known. */
export default function BonCadeauJsonLd({ produit, url }: { produit: object; url: string }) {
  const { currency, pret } = useCurrency();
  if (!pret) return null;
  return <JsonLd noeuds={[{ ...produit, offers: offresBonCadeau(currency, url) }]} />;
}
