import { grapheJsonLd } from "@/lib/donneesStructurees";

/** Donnees structurees schema.org d'une page (rendu serveur, aucun JS client). */
export default function JsonLd({ noeuds }: { noeuds: object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: grapheJsonLd(noeuds) }} />;
}
