import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Les regles precedentes ne couvraient pas ce qu'elles visaient : les chemins
 * reels sont prefixes par la langue. `/admin/` ne matchait pas `/fr/admin`, et
 * `/*​/simpson-mockups/` — avec sa barre finale — laissait passer
 * `/fr/simpson-mockups`, la page d'index des maquettes.
 *
 * Les motifs sont donc doubles : avec et sans prefixe de langue, sans barre
 * finale pour attraper la page elle-meme autant que ce qu'il y a dessous.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/*/admin',
          '/simpson-mockups',
          '/*/simpson-mockups',
          // Pages de fin de tunnel : arrivees par e-mail ou apres paiement,
          // elles n'ont rien a faire dans l'index et portent un jeton en URL.
          '/success',
          '/suivi/',
          '/confirm-poster/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
