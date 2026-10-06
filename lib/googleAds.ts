/* Balise Google Ads coupee le 6 octobre 2026 : aucune campagne ne tourne, et
   elle posait un cookie (_gcl_au) chez chaque visiteur sans son accord. Pour la
   remettre le jour d'une campagne : NEXT_PUBLIC_GOOGLE_ADS_ACTIF=1 dans Vercel,
   puis redeployer. Elle devra alors dependre du bandeau de consentement. */
export const GOOGLE_ADS_ACTIF = process.env.NEXT_PUBLIC_GOOGLE_ADS_ACTIF === "1";

export const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-18095488131";

export const GOOGLE_ADS_PURCHASE_CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || "NSxACK-gva8cEIP5zLRD";

export const GOOGLE_ADS_PURCHASE_SEND_TO =
  `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_CONVERSION_LABEL}`;
