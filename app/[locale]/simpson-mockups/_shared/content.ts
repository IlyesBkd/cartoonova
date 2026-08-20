import { DEFAULT_PRICE_SET } from "@/lib/types";

export const PRICES = DEFAULT_PRICE_SET;

export const formatEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export type Format = "portrait" | "fullbody";
export type PrintKey = "digital" | "posterSimple" | "canvas" | "poster";

export interface ConfiguratorState {
  format: Format;
  people: number;
  animals: number;
  printKey: PrintKey;
}

export function computeTotal(state: ConfiguratorState): number {
  return (
    PRICES.base +
    (state.format === "fullbody" ? PRICES.fullbodyExtra : 0) +
    (state.people - 1) * PRICES.extraPerson +
    state.animals * PRICES.extraAnimal +
    PRICES[state.printKey]
  );
}

export const PRINT_OPTIONS: {
  key: PrintKey;
  img: string;
  label: string;
  sub: string;
  addon: number;
  badge: string;
}[] = [
  { key: "digital", img: "/digital.jpeg", label: "Digital", sub: "HD · PNG + JPG", addon: PRICES.digital, badge: "le plus rapide" },
  { key: "posterSimple", img: "/poster.png", label: "Poster", sub: "30×40 cm · papier mat", addon: PRICES.posterSimple, badge: "" },
  { key: "canvas", img: "/canvas.jpeg", label: "Portrait sur Toile", sub: "40×60 cm · prête à accrocher", addon: PRICES.canvas, badge: "best-seller" },
  { key: "poster", img: "/framed.jpg", label: "Portrait Encadré", sub: "30×40 cm · cadre chêne", addon: PRICES.poster, badge: "" },
];

export const BACKGROUNDS = [
  { src: "/simpson_background/couch8x10.jpg", label: "Canapé" },
  { src: "/simpson_background/house.jpg", label: "Maison" },
  { src: "/simpson_background/beach.jpg", label: "Plage" },
  { src: "/simpson_background/bar.jpg", label: "Bar" },
  { src: "/simpson_background/church.jpg", label: "Église" },
  { src: "/simpson_background/forest.jpg", label: "Forêt" },
  { src: "/simpson_background/snow.jpg", label: "Neige" },
  { src: "/simpson_background/montain.jpg", label: "Montagne" },
  { src: "/simpson_background/valentines.jpg", label: "Saint-Valentin" },
];

export const GALLERY_PHOTOS = [
  "/simpson_photos_produit/0009_1.jpg",
  "/simpson_photos_produit/0015_1.jpg",
  "/simpson_photos_produit/0017_1.jpg",
  "/simpson_photos_produit/0021_1.jpg",
  "/simpson_photos_produit/0029_1.jpg",
  "/simpson_photos_produit/0032-revise3.jpg",
  "/simpson_photos_produit/0044_revise.jpg",
  "/simpson_photos_produit/0048.jpg",
  "/simpson_photos_produit/0049.jpg",
  "/simpson_photos_produit/43-2.png",
  "/simpson_photos_produit/IB2-18-1.jpg",
  "/simpson_photos_produit/IB4-20.jpg",
];

export const HERO_SLIDES = GALLERY_PHOTOS.slice(0, 5);

export const REVIEWS = [
  { name: "Sophie M.", text: "Absolument magnifique ! Le dessin est fidèle et la qualité d'impression est au top. Un cadeau parfait !" },
  { name: "Thomas K.", text: "Livraison super rapide et la qualité est tout simplement géniale. Ma femme était ravie !" },
  { name: "Marie L.", text: "Le cadeau parfait pour l'anniversaire de mes parents. La ressemblance est incroyable, ils ont adoré !" },
  { name: "Pierre D.", text: "Travail remarquable ! Le dessin nous ressemble vraiment. Absolument recommandé." },
  { name: "Julie R.", text: "Service client au top et résultat bluffant. Ce ne sera pas la dernière fois que je commande ici !" },
  { name: "Nicolas B.", text: "Nous étions très agréablement surpris. Super image et un support excellent. On recommandera sans hésiter." },
];

export const FAQ_ITEMS = [
  { q: "Combien de temps faut-il pour réaliser la caricature ?", a: "Le dessin est réalisé en 2 jours. Si vous avez choisi une impression (poster, toile), comptez 3 jours ouvrés supplémentaires pour la fabrication et la livraison." },
  { q: "Les personnes doivent-elles toutes être sur la même photo ?", a: "Pas du tout ! Envoyez-nous des photos individuelles et nos artistes dessineront tout le monde ensemble sur une seule image." },
  { q: "Que se passe-t-il si je ne suis pas satisfait(e) ?", a: "Nous offrons des révisions illimitées et gratuites jusqu'à votre entière satisfaction. Votre bonheur est notre priorité !" },
  { q: "Mon animal de compagnie peut-il aussi devenir jaune ?", a: "Absolument ! Chiens, chats, oiseaux — nous pouvons transformer n'importe quel animal adoré en personnage cartoon jaune." },
  { q: "Puis-je aussi faire dessiner des objets ?", a: "Oui ! Nous pouvons inclure des objets, véhicules, décors ou accessoires dans votre caricature pour un petit supplément." },
];

export const STATS = {
  rating: 4.9,
  reviewCount: 2540,
  distribution: [
    { stars: 5, pct: 92 },
    { stars: 4, pct: 6 },
    { stars: 3, pct: 1.5 },
    { stars: 2, pct: 0.3 },
    { stars: 1, pct: 0.2 },
  ],
};

export const COPY = {
  universe: "Univers",
  simpsonStyle: "Style cartoon jaune",
  heroTitle1: "Commandez Votre",
  heroTitle2: "Simpson Caricature",
  heroSubtitle: "Transformez-vous en personnage cartoon dessiné à la main. Le cadeau unique et personnalisé parfait !",
  delivered48h: "Livré en 2 jours",
  satisfiedOrRefunded: "Satisfait ou remboursé",
  orderCta: "Commander mon portrait",
  addToCart: "Ajouter au panier",
  verifiedReviews: "avis vérifiés",
  portraitsDelivered: "portraits livrés",
  handDrawn: "Dessiné à la main",
  freeRevisions: "retouches gratuites",
  howItWorks: "Comment ça marche",
  howItWorksTitle: "3 étapes, zéro prise de tête.",
  step1Title: "Envoyez votre photo",
  step1Desc: "Un selfie suffit",
  step2Title: "On dessine votre portrait",
  step2Desc: "Par un artiste dédié",
  step3Title: "Pas satisfait ?",
  step3Desc: "On recommence gratuitement",
  configurator: "Configurateur",
  composeYourPortrait: "Compose ton portrait.",
  guidedSteps: "5 étapes guidées. Aperçu live à chaque clic.",
  framingStep: "Cadrage",
  portrait: "Portrait",
  portraitSub: "Visage + buste",
  fullbody: "Corps Entier",
  fullbodySub: "De la tête aux pieds",
  whoOnPortrait: "Qui est sur le portrait ?",
  peopleLabel: "Personnes",
  perExtraPerson: "par personne supplémentaire",
  animalsLabel: "Animaux",
  perAnimal: "par animal",
  peopleSingular: "personne",
  peoplePlural: "personnes",
  animalsSingular: "animal",
  animalsPlural: "animaux",
  decorStep: "Décor de fond",
  hoverToPreview: "Survole pour prévisualiser",
  uploadStep: "Téléverse tes photos",
  uploadMax8: "Jusqu'à 8 photos",
  dragHere: "Glisse tes photos ici",
  orWord: "ou bien",
  choosePhoto: "Choisir une photo",
  uploadHint: "JPG, PNG · 10 Mo max par image · visages bien éclairés recommandés",
  noteForArtist: "Note pour l'artiste",
  optional: "optionnel",
  notePlaceholder: "Ex : mon père porte sa casquette OM, ma chatte s'appelle Pixel, met-nous tous en tenue de Noël…",
  printSupportStep: "Support d'impression",
  summary: "Récapitulatif",
  revisionsIncluded: "Retouches & ajustements",
  included: "Inclus",
  total: "Total",
  paymentReassurance: "Paiement sécurisé · 3x sans frais · Retouches gratuites",
  galleryLabel: "Galerie",
  galleryTitle: "Nos Réalisations 🖼️",
  gallerySub: "Survole une image pour voir le client.",
  reviewsLabel: "Avis clients",
  basedOn: "Basé sur",
  verified: "Vérifié",
  frequentQuestions: "Questions fréquentes",
  satisfiedClients: "clients satisfaits",
  ctaTitle: "Toi aussi, passe en mode cartoon.",
  ctaSubtitle: "Plus de 2 500 portraits livrés, note moyenne 4,9/5. Ton tour ?",
  pillDrawnHand: "Dessiné main",
  pillDelivered48h: "Livré 2 jours",
  pillSatisfied: "Satisfait ou remboursé",
  madeInFrance: "Made in France",
  estimatedDelay: "Délai estimé",
  digital48h: "2 jours (fichier num.)",
  print57Days: "3 j (impression)",
  previewOnlyToast: "Aperçu de maquette — panier non actif",
};
