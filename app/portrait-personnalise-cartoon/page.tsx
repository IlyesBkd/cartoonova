import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BreadcrumbJsonLd, FAQJsonLd, ProductJsonLd, OrganizationJsonLd } from "@/components/structured-data";
// Simple SVG components to replace lucide-react
const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const Star = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const Gift = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const Zap = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const Shield = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const Heart = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Portrait Personnalisé Cartoon - Caricature Personnalisée à partir de votre Photo | Cartoonova",
    description: "Transformez vos photos en portraits personnalisés style cartoon ! Créez votre caricature unique en quelques clics. Idée cadeau originale parfaite. Qualité garantie, livraison rapide. Découvrez Cartoonova !",
    metadataBase: new URL("https://cartoonova.fr"),
    alternates: {
      canonical: "/portrait-personnalise-cartoon",
    },
    openGraph: {
      title: "Portrait Personnalisé Cartoon - Cartoonova",
      description: "Créez votre caricature personnalisée à partir de votre photo. Cadeau unique et original !",
      url: "https://cartoonova.fr/portrait-personnalise-cartoon",
      siteName: "Cartoonova",
      images: [
        {
          url: "https://cartoonova.fr/og-portrait-cartoon.jpg",
          width: 1200,
          height: 630,
          alt: "Portrait personnalisé cartoon - Cartoonova",
        },
      ],
      locale: "fr_FR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Portrait Personnalisé Cartoon | Cartoonova",
      description: "Transformez vos photos en portraits cartoons uniques !",
      images: ["https://cartoonova.fr/twitter-portrait-cartoon.jpg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default function PortraitPersonnaliseCartoon() {
  const structuredData = {
    product: {
      name: "Portrait Personnalisé Cartoon",
      description: "Service de création de portraits personnalisés style cartoon à partir de photos",
      brand: "Cartoonova",
      offers: {
        priceCurrency: "EUR",
        price: "49",
        availability: "https://schema.org/InStock",
        priceValidUntil: "2024-12-31",
      },
      image: "https://cartoonova.fr/portrait-cartoon-exemple.jpg",
    },
    organization: {
      name: "Cartoonova",
      url: "https://cartoonova.fr",
      logo: "https://cartoonova.fr/logo.png",
      description: "Spécialiste du portrait personnalisé style cartoon",
    },
    breadcrumb: [
      { name: "Accueil", item: "https://cartoonova.fr" },
      { name: "Portrait Personnalisé Cartoon", item: "https://cartoonova.fr/portrait-personnalise-cartoon" },
    ],
    faq: [
      {
        question: "Comment créer mon portrait personnalisé cartoon ?",
        answer: "C'est très simple ! Choisissez votre format, téléchargez vos photos, sélectionnez vos options et validez. Notre équipe d'artistes crée votre portrait personnalisé en quelques jours.",
      },
      {
        question: "Quels types de photos fonctionnent le mieux ?",
        answer: "Des photos claires et bien éclairées fonctionnent le mieux. Évitez les photos floues, sombres ou de faible qualité. Plus la photo est détaillée, meilleur sera le résultat final.",
      },
      {
        question: "Combien de temps faut-il pour recevoir mon portrait ?",
        answer: "Le délai moyen est de 3-5 jours ouvrables. Les options digitales sont livrées par email, les impressions par colis sécurisé. Vous recevrez un aperçu pour validation avant livraison finale.",
      },
      {
        question: "Puis-je commander un portrait de famille ?",
        answer: "Absolument ! Nos portraits de famille personnalisés sont très populaires. Vous pouvez inclure jusqu'à 10 personnes et même des animaux de compagnie pour un portrait vraiment unique.",
      },
      {
        question: "Quelle est la différence entre version digitale et impression ?",
        answer: "La version digitale (INCLUS) vous donne un fichier haute résolution parfait pour le web et l'impression locale. L'impression sur toile ou poster vous offre une œuvre d'art prête à accrocher, livrée avec cadre.",
      },
      {
        question: "Le portrait personnalisé est-il un bon cadeau ?",
        answer: "C'est le cadeau parfait ! Original, personnel et mémorable. Idéal pour anniversaires, mariages, fêtes des mères, ou simplement pour surprendre quelqu'un avec un cadeau unique.",
      },
      {
        question: "Comment s'assurer que le résultat me plaira ?",
        answer: "Nous travaillons avec vous jusqu'à ce que vous soyez satisfait. Un aperçu vous est envoyé pour validation et nous proposons des modifications si nécessaire. Votre satisfaction est notre priorité.",
      },
      {
        question: "Quels styles de portraits proposez-vous ?",
        answer: "Nous spécialisons le style cartoon inspiré des Simpson, mais nous adaptons également d'autres styles de dessin animé sur demande. Chaque portrait est unique et personnalisé selon vos préférences.",
      },
    ],
  };

  return (
    <>
      {/* Données structurées */}
      <BreadcrumbJsonLd breadcrumbs={structuredData.breadcrumb} />
      <ProductJsonLd product={structuredData.product} />
      <OrganizationJsonLd organization={structuredData.organization} />
      <FAQJsonLd faq={structuredData.faq} />

      <div className="min-h-screen bg-white">
        {/* Fil d'Ariane */}
        <nav className="bg-yellow-50 border-b border-black/10 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
            <Link href="/" className="text-black/60 hover:text-black transition-colors">
              Accueil
            </Link>
            <span className="text-black/40">/</span>
            <span className="font-black text-black">Portrait Personnalisé Cartoon</span>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-yellow-400 to-yellow-300 py-20 px-4 border-b-4 border-black">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-black mb-6 leading-tight">
                  Portrait Personnalisé Cartoon
                  <br />
                  <span className="text-3xl md:text-4xl text-yellow-900">
                    Votre Caricature Unique à Partir de Photo
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-black/80 font-bold mb-8 leading-relaxed">
                  Transformez vos souvenirs en œuvres d'art uniques ! Nos artistes créent votre 
                  <strong> portrait personnalisé cartoon </strong> 
                  avec un style inspiré des Simpson. Le cadeau parfait qui fait toujours plaisir !
                </p>
                <div className="flex flex-wrap gap-4 mb-8">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-black" />
                    <span className="font-bold text-black">Qualité garantie</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-black" />
                    <span className="font-bold text-black">Livraison rapide</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-black" />
                    <span className="font-bold text-black">Cadeau parfait</span>
                  </div>
                </div>
                <Link
                  href="#commander"
                  className="inline-block bg-black text-white font-black text-lg px-8 py-4 rounded-full border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all"
                >
                  Créer mon portrait cartoon →
                </Link>
              </div>
              <div className="relative">
                <div className="bg-white p-6 border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <Image
                    src="/portrait-cartoon-exemple.jpg"
                    alt="Portrait personnalisé cartoon - exemple caricature"
                    width={500}
                    height={500}
                    className="rounded-lg w-full"
                    priority
                  />
                </div>
                <div className="absolute -top-4 -right-4 bg-red-500 text-white font-black px-4 py-2 rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  POPULAIRE ⭐
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-16">
              Comment ça marche ? Votre portrait cartoon en 3 étapes simples
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-3xl font-black">1</span>
                </div>
                <h3 className="text-xl font-black mb-4">Choisissez votre format</h3>
                <p className="text-black/70 font-medium">
                  Portrait ou corps entier ? Combien de personnes ? Personnalisez votre 
                  <strong> portrait personnalisé</strong> selon vos envies.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-3xl font-black">2</span>
                </div>
                <h3 className="text-xl font-black mb-4">Téléchargez vos photos</h3>
                <p className="text-black/70 font-medium">
                  Envoyez vos meilleures photos. Plus elles sont claires, meilleur sera votre 
                  <strong> portrait style dessin animé</strong>.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-3xl font-black">3</span>
                </div>
                <h3 className="text-xl font-black mb-4">Recevez votre œuvre</h3>
                <p className="text-black/70 font-medium">
                  Votre <strong>caricature personnalisée</strong> est prête ! Version digitale 
                  instantanée ou impression encadrée chez vous.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Options d'impression */}
        <section id="commander" className="py-20 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-16">
              Options d'impression : Digital ou Toile, le choix parfait
            </h2>
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white p-8 border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                <div className="aspect-square bg-gray-100 rounded-lg mb-6 overflow-hidden">
                  <Image
                    src="/digital-option.jpg"
                    alt="Portrait digital cartoon"
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-black mb-2">Digital</h3>
                <p className="text-2xl font-black text-yellow-600 mb-4">INCLUS</p>
                <p className="text-black/70 font-medium mb-4">
                  Fichier haute résolution parfait pour le web et l'impression locale. 
                  Votre <strong> portrait personnalisé à partir de photo </strong> instantanément.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Livraison immédiate</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Résolution 300 DPI</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Format JPEG/PNG</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white p-8 border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                <div className="aspect-square bg-gray-100 rounded-lg mb-6 overflow-hidden">
                  <Image
                    src="/toile-option.jpg"
                    alt="Portrait sur toile cartoon"
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-black mb-2">Portrait sur Toile</h3>
                <p className="text-2xl font-black text-yellow-600 mb-4">89€</p>
                <p className="text-black/70 font-medium mb-4">
                  Œuvre d'art prête à accrocher. Votre <strong> affiche personnalisée </strong> 
                  sur toile de galerie avec cadre inclus.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Toile 40x50 cm</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Cadre inclus</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Livraison sécurisée</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white p-8 border-4 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all">
                <div className="aspect-square bg-gray-100 rounded-lg mb-6 overflow-hidden">
                  <Image
                    src="/poster-option.jpg"
                    alt="Poster encadré cartoon"
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-black mb-2">Poster Encadré</h3>
                <p className="text-2xl font-black text-yellow-600 mb-4">79€</p>
                <p className="text-black/70 font-medium mb-4">
                  Poster premium avec cadre moderne. Votre <strong> portrait de famille personnalisé </strong> 
                  mis en valeur comme une véritable œuvre.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Format 30x40 cm</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Cadre aluminium</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">Verre acrylique</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Pourquoi Cartoonova */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-16">
              Pourquoi choisir Cartoonova ? Le meilleur du portrait personnalisé
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Star className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-lg font-black mb-3">Artistes Experts</h3>
                <p className="text-black/70 font-medium">
                  Notre équipe spécialisée dans le <strong> portrait style dessin animé </strong> 
                  garantit un résultat professionnel et fidèle à votre image.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Shield className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-lg font-black mb-3">Satisfaction Garantie</h3>
                <p className="text-black/70 font-medium">
                  Votre <strong> portrait personnalisé </strong> est validé avec vous. 
                  Modifications possibles jusqu'à satisfaction complète.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Zap className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-lg font-black mb-3">Livraison Express</h3>
                <p className="text-black/70 font-medium">
                  Version digitale instantanée, impressions en 3-5 jours. Votre 
                  <strong> caricature personnalisée </strong> rapidement chez vous.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Gift className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-lg font-black mb-3">Idée Cadeau Parfaite</h3>
                <p className="text-black/70 font-medium">
                  Le <strong> cadeau personnalisé original </strong> qui surprend toujours. 
                  Anniversaire, mariage, fête des mères... l'occasion parfaite !
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Idée Cadeau */}
        <section className="py-20 px-4 bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-16">
              Idée Cadeau Originale : Le Portrait Personnalisé qui Surprend
            </h2>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-black mb-6">
                  Le cadeau personnalisé qui laisse un souvenir impérissable
                </h3>
                <p className="text-lg text-black/80 font-medium mb-6">
                  Cherchez une <strong> idée cadeau originale </strong> qui sort de l'ordinaire ? 
                  Notre <strong> portrait cartoon personnalisé </strong> est la réponse parfaite !
                </p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-4">
                    <Gift className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-black mb-1">Pour tous les événements</h4>
                      <p className="text-black/70">
                        Anniversaire, mariage, départ à la retraite, fête des mères... 
                        Chaque occasion mérite un <strong> cadeau personnalisé unique </strong>.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Heart className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-black mb-1">Émotion garantie</h4>
                      <p className="text-black/70">
                        Imaginez la surprise de voir vos proches transformés en personnages 
                        cartoon. Un <strong> portrait de famille personnalisé </strong> qui fait 
                        toujours plaisir.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Star className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-black mb-1">Durable et mémorable</h4>
                      <p className="text-black/70">
                        Contrairement aux cadeaux éphémères, votre <strong> affiche personnalisée </strong> 
                        orne les murs pendant des années.
                      </p>
                    </div>
                  </div>
                </div>
                <Link
                  href="#commander"
                  className="inline-block bg-black text-white font-black text-lg px-8 py-4 rounded-full border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all"
                >
                  Commander mon cadeau personnalisé →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Image
                    src="/cadeau-anniversaire.jpg"
                    alt="Portrait cadeau anniversaire"
                    width={200}
                    height={200}
                    className="rounded-lg w-full mb-4"
                  />
                  <h4 className="font-black text-center">Anniversaire</h4>
                </div>
                <div className="bg-white p-6 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Image
                    src="/cadeau-famille.jpg"
                    alt="Portrait cadeau famille"
                    width={200}
                    height={200}
                    className="rounded-lg w-full mb-4"
                  />
                  <h4 className="font-black text-center">Famille</h4>
                </div>
                <div className="bg-white p-6 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Image
                    src="/cadeau-couple.jpg"
                    alt="Portrait cadeau couple"
                    width={200}
                    height={200}
                    className="rounded-lg w-full mb-4"
                  />
                  <h4 className="font-black text-center">Couple</h4>
                </div>
                <div className="bg-white p-6 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Image
                    src="/cadeau-entreprise.jpg"
                    alt="Portrait cadeau entreprise"
                    width={200}
                    height={200}
                    className="rounded-lg w-full mb-4"
                  />
                  <h4 className="font-black text-center">Entreprise</h4>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-center mb-16">
              FAQ - Vos Questions sur nos Portraits Personnalisés
            </h2>
            <div className="space-y-6">
              {structuredData.faq.map((item, index) => (
                <div key={index} className="bg-gray-50 border-4 border-black rounded-2xl p-6 hover:bg-yellow-50 transition-colors">
                  <h3 className="text-lg font-black mb-3">{item.question}</h3>
                  <p className="text-black/70 font-medium leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-20 px-4 bg-black text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black mb-6">
              Prêt à créer votre portrait cartoon unique ?
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Rejoignez des milliers de clients satisfaits. Votre <strong> portrait personnalisé </strong> 
              vous attend !
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/product"
                className="bg-yellow-400 text-black font-black text-lg px-8 py-4 rounded-full border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all"
              >
                Commencer maintenant →
              </Link>
              <Link
                href="/portfolio"
                className="bg-white text-black font-black text-lg px-8 py-4 rounded-full border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] active:translate-y-1 active:shadow-none transition-all"
              >
                Voir nos réalisations
              </Link>
            </div>
            <div className="flex justify-center gap-8 text-sm">
              <Link href="/avis" className="text-white/80 hover:text-white underline">
                Voir les avis clients
              </Link>
              <Link href="/contact" className="text-white/80 hover:text-white underline">
                Nous contacter
              </Link>
              <Link href="/cgv" className="text-white/80 hover:text-white underline">
                Conditions générales
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
