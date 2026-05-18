"use client";

interface BreadcrumbItem {
  name: string;
  item: string;
}

interface BreadcrumbJsonLdProps {
  breadcrumbs: BreadcrumbItem[];
}

export function BreadcrumbJsonLd({ breadcrumbs }: BreadcrumbJsonLdProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((breadcrumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": breadcrumb.name,
      "item": breadcrumb.item,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

interface ProductJsonLdProps {
  product: {
    name: string;
    description: string;
    brand: string;
    offers: {
      priceCurrency: string;
      price: string;
      availability: string;
      priceValidUntil: string;
    };
    image: string;
    sku?: string;
    aggregateRating?: { ratingValue: number; reviewCount: number };
  };
}

export function ProductJsonLd({ product }: ProductJsonLdProps) {
  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "brand": {
      "@type": "Brand",
      "name": product.brand,
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": product.offers.priceCurrency,
      "price": product.offers.price,
      "availability": product.offers.availability,
      "priceValidUntil": product.offers.priceValidUntil,
      "seller": {
        "@type": "Organization",
        "name": "Cartoonova",
      },
    },
    "image": product.image,
  };

  if (product.sku) structuredData.sku = product.sku;
  if (product.aggregateRating) {
    structuredData.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": product.aggregateRating.ratingValue,
      "reviewCount": product.aggregateRating.reviewCount,
      "bestRating": 5,
      "worstRating": 1,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

interface ProductStyleMeta {
  name: string;
  description: string;
  image: string;
  sku: string;
}

export const PRODUCT_STYLE_META: Record<string, ProductStyleMeta> = {
  simpson: {
    name: "Portrait Simpson personnalisé",
    description: "Transformez vos photos en personnage Simpsons. Dessiné à la main par un artiste, livré en 48h.",
    image: "/simpson_photos_produit/0009_1.jpg",
    sku: "cartoonova-simpson",
  },
  dbz: {
    name: "Portrait Dragon Ball Z personnalisé",
    description: "Devenez un Saiyan. Portrait style Dragon Ball Z dessiné main, livré en 48h.",
    image: "/DBZ/Photo_produits/1.png",
    sku: "cartoonova-dbz",
  },
  disney: {
    name: "Portrait Disney personnalisé",
    description: "Votre photo transformée en personnage Disney par un artiste. Livré en 48h.",
    image: "/Disney/Photo_produits/1.png",
    sku: "cartoonova-disney",
  },
  ghibli: {
    name: "Portrait Studio Ghibli personnalisé",
    description: "Portrait inspiré de l'univers Studio Ghibli, dessiné à la main. Livré en 48h.",
    image: "/Ghibli/Photo_produits/il_794xN.7001686030_jbst.png",
    sku: "cartoonova-ghibli",
  },
  onepiece: {
    name: "Affiche Wanted One Piece personnalisée",
    description: "Votre avis de recherche style One Piece, dessiné main. Livré en 48h.",
    image: "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.png",
    sku: "cartoonova-onepiece",
  },
  rickandmorty: {
    name: "Portrait Rick & Morty personnalisé",
    description: "Portrait style Rick & Morty dessiné par un artiste. Livré en 48h.",
    image: "/rickandmorty/Photo_produits/1.png",
    sku: "cartoonova-rickandmorty",
  },
};

interface OrganizationJsonLdProps {
  organization: {
    name: string;
    url: string;
    logo: string;
    description: string;
  };
}

export function OrganizationJsonLd({ organization }: OrganizationJsonLdProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": organization.name,
    "url": organization.url,
    "logo": organization.logo,
    "description": organization.description,
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQJsonLdProps {
  faq: FAQItem[];
}

export function FAQJsonLd({ faq }: FAQJsonLdProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map((item) => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
