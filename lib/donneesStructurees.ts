import { SITE_URL } from "./site";
import { locales } from "../i18n/config";
import { COUNTRIES } from "./countries";
import { PRINT_KEYS, computeShipping, type PrintKey } from "./pricing";
import { FIN_LANCEMENT, lancementEnCours } from "./lancement";
import type { PriceSet } from "./types";

/* Blocs schema.org partages par les pages (2 octobre 2026).

   Ce que Google demande a une fiche marchande depuis 2024 : un prix par offre,
   sa duree de validite, le cout et le delai de livraison, la politique de
   retour. Sans ces trois derniers, Search Console signale la fiche et ne
   l'affiche pas en resultat enrichi « produit ». Ils sont ecrits une fois ici
   pour que la fiche, le bon cadeau et les pages d'information disent la meme
   chose — et la meme chose que les CGV (articles 3, 6, 8 et 9 bis). */

/** Pays livres, au format ISO, pour `shippingDestination` et la politique de retour. */
const PAYS_LIVRES = COUNTRIES.map((c) => c.code);

/**
 * Date de fin de validite des prix annonces. Pendant le prix de lancement,
 * c'est sa date de fin : annoncer plus loin serait faux. Ensuite, la fin de
 * l'annee suivante.
 */
export function prixValideJusqua(maintenant: Date = new Date()): string {
  if (lancementEnCours(maintenant)) return FIN_LANCEMENT.toISOString().slice(0, 10);
  return `${maintenant.getUTCFullYear() + 1}-12-31`;
}

/** Delais et cout de livraison d'un support, en jours ouvres (CGV art. 6). */
export function livraisonOffre(prix: PriceSet, cle: PrintKey) {
  const numerique = cle === "digital";
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: computeShipping(prix, cle), currency: "EUR" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: PAYS_LIVRES },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      // Dessin en 2 jours ; pour un tirage, 1 jour de validation de l'apercu en plus.
      handlingTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: numerique ? 2 : 3, unitCode: "DAY" },
      // Le fichier part par e-mail ; un tirage met 3 a 7 jours ouvres.
      transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: numerique ? 0 : 7, unitCode: "DAY" },
    },
  };
}

/**
 * Politique de retour d'un portrait. Cree sur mesure a partir des photos du
 * client : pas de droit de retractation une fois le travail commence (CGV
 * art. 8, article L221-28 du Code de la consommation). Le remboursement en cas
 * d'insatisfaction et l'echange d'un tirage abime existent, mais ce sont une
 * garantie commerciale, pas un retour : schema.org n'a pas de categorie pour
 * eux, et les declarer comme « retour libre » serait faux.
 */
export function politiqueRetourPortrait() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: PAYS_LIVRES,
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    merchantReturnLink: `${SITE_URL}/fr/cgv`,
  };
}

/** Politique de retour du bon cadeau : 14 jours tant qu'il n'est pas utilise (CGV art. 9 bis). */
export function politiqueRetourBonCadeau() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: PAYS_LIVRES,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 14,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
    merchantReturnLink: `${SITE_URL}/fr/cgv`,
  };
}

/** Champ de prix de chaque support (meme correspondance que `lib/pricing.ts`). */
const CHAMP_SUPPORT: Record<PrintKey, keyof PriceSet> = {
  digital: "digital",
  posterSimple: "posterSimple",
  canvas: "canvas",
  framed: "poster",
};

/**
 * Une offre par support, pour un portrait a une personne : c'est ce que la
 * fiche affiche par defaut et ce que commandent la plupart des clients. Le
 * prix est celui des produits ; la livraison est declaree a part, comme a la
 * caisse.
 */
export function offresPortrait(prix: PriceSet, url: string, nomsSupports: Record<PrintKey, string>) {
  const validite = prixValideJusqua();
  return PRINT_KEYS.map((cle) => ({
    "@type": "Offer",
    name: nomsSupports[cle],
    price: Math.round((prix.base + prix[CHAMP_SUPPORT[cle]]) * 100) / 100,
    priceCurrency: "EUR",
    priceValidUntil: validite,
    availability: "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    url,
    seller: { "@id": `${SITE_URL}/#organization` },
    shippingDetails: livraisonOffre(prix, cle),
    hasMerchantReturnPolicy: politiqueRetourPortrait(),
  }));
}

/** L'organisation Cartoonova, avec son identifiant stable (repris de l'accueil). */
export function organisation(locale: string) {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Cartoonova",
    alternateName: ["Cartoon Nova", "Cartoonnova", "Cartonova"],
    url: `${SITE_URL}/${locale}`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "support@cartoonova.com",
      availableLanguage: [...locales],
    },
  };
}

/** Fil d'Ariane : une liste de [nom, url absolue]. */
export function filAriane(etapes: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: etapes.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
  };
}

/** Une page simple (contact, a propos, page legale…) reliee au site et a la marque. */
export function pageWeb(type: string, locale: string, url: string, nom: string, description?: string) {
  return {
    "@type": type,
    "@id": `${url}#page`,
    url,
    name: nom,
    ...(description ? { description } : {}),
    inLanguage: locale,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

/** Le script JSON-LD d'un graphe, pret a poser dans une page serveur. */
export function grapheJsonLd(noeuds: object[]) {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": noeuds });
}
