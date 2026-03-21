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
  };
}

export function ProductJsonLd({ product }: ProductJsonLdProps) {
  const structuredData = {
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

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
