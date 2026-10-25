import JsonLd from "@/components/JsonLd";
import { offresPortrait } from "../lib/donneesStructurees";
import type { Currency } from "../lib/currency";
import type { PriceSet } from "../lib/types";
import type { PrintKey } from "../lib/pricing";

/** Consume the configurator's approved grid; never fetch/convert independently. */
export default function PortraitJsonLd({ produit, url, prix, currency, nomsSupports }: {
  produit: object;
  url: string;
  prix: PriceSet;
  currency: Currency;
  nomsSupports: Record<PrintKey, string>;
}) {
  return <JsonLd noeuds={[{ ...produit, offers: offresPortrait(prix, url, nomsSupports, currency) }]} />;
}
