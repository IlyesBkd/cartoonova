import { locales, type Locale } from "../i18n/config";

/**
 * Catalogue produit.
 *
 * Les 36 entrees relevees sur cartoontoi.fr le 16 aout 2026
 * (`catalogue-cartoontoi/catalogue.json`), plus les deux univers Cartoonova
 * qui n'y figurent pas mais qui sont deja en ligne avec leurs visuels :
 * Disney et Ghibli. Total : 38 fiches.
 *
 * Ce que ce fichier decrit : l'identite d'un produit et la forme de son
 * configurateur. Ce qu'il ne decrit PAS : le prix. Le prix vient de la base
 * (`lib/db.ts` -> `lib/pricing.ts`) et est recalcule cote serveur a chaque
 * commande. Le catalogue d'origine pratique un prix uniforme ; le site aussi.
 * Aucun montant releve chez le concurrent n'est repris ici.
 */

export const CATEGORIES = ["manga", "cartoon", "comics", "cinema"] as const;
export type Categorie = (typeof CATEGORIES)[number];

export const NOMS_CATEGORIE: Record<Categorie, Record<Locale, string>> = {
  manga: {
    fr: "Portrait Manga",
    en: "Manga Portraits",
    es: "Retratos Manga",
    de: "Manga-Portraits",
    it: "Ritratti Manga",
    nl: "Manga Portretten",
    pl: "Portrety Manga",
    sv: "Manga-porträtt",
  },
  cartoon: {
    fr: "Portrait Cartoon",
    en: "Cartoon Portraits",
    es: "Retratos Cartoon",
    de: "Cartoon-Portraits",
    it: "Ritratti Cartoon",
    nl: "Cartoon Portretten",
    pl: "Portrety Cartoon",
    sv: "Cartoon-porträtt",
  },
  comics: {
    fr: "Portrait Comics",
    en: "Comics Portraits",
    es: "Retratos Comics",
    de: "Comics-Portraits",
    it: "Ritratti Comics",
    nl: "Comics Portretten",
    pl: "Portrety Komiksowe",
    sv: "Serieporträtt",
  },
  cinema: {
    fr: "Portrait Cinéma",
    en: "Movie Portraits",
    es: "Retratos Cine",
    de: "Kino-Portraits",
    it: "Ritratti Cinema",
    nl: "Film Portretten",
    pl: "Portrety Filmowe",
    sv: "Filmporträtt",
  },
};

/**
 * Libellé court pour la barre de navigation. Les quatre menus déroulants
 * portent le nom de leur catégorie : « Portrait Manga », « Portrait Cartoon »,
 * « Portrait Comics », « Portrait Cinéma » côte à côte dépassent 500 px à eux
 * seuls — plus rien ne tenait à côté du logo, du sélecteur et du bouton
 * d'action. Le nom complet reste affiché en titre du panneau ouvert.
 */
export const NOMS_CATEGORIE_COURT: Record<Categorie, Record<Locale, string>> = {
  manga: { fr: "Manga", en: "Manga", es: "Manga", de: "Manga", it: "Manga", nl: "Manga", pl: "Manga", sv: "Manga" },
  cartoon: { fr: "Cartoon", en: "Cartoon", es: "Cartoon", de: "Cartoon", it: "Cartoon", nl: "Cartoon", pl: "Cartoon", sv: "Cartoon" },
  comics: { fr: "Comics", en: "Comics", es: "Comics", de: "Comics", it: "Comics", nl: "Comics", pl: "Komiks", sv: "Serier" },
  cinema: { fr: "Cinéma", en: "Movies", es: "Cine", de: "Kino", it: "Cinema", nl: "Films", pl: "Filmy", sv: "Film" },
};

export interface Decor {
  src: string;
  /** Cle de traduction si elle existe dans messages/*.json, sinon libelle brut. */
  cle: string;
  libelle?: string;
}

export interface Produit {
  /** Segment d'URL. Les six univers deja en ligne gardent leur slug historique. */
  slug: string;
  /** Handle d'origine sur cartoontoi.fr — sert de trace, pas de route. */
  handle: string;
  /** Nom de l'univers seul ("Batman"), qui alimente les gabarits de titre. */
  univers: string;
  /**
   * Nom localise, quand l'univers ne porte pas le meme nom d'une langue a
   * l'autre. La plupart n'en ont pas besoin — « Batman » ou « Naruto » se
   * disent partout pareil ; seuls les titres traduits en font varier.
   */
  universLocalise?: Partial<Record<Locale, string>>;
  categorie: Categorie;
  /** Identifiant stable pour PostHog / flux Merchant. */
  idProduit: string;
  /**
   * false = la fiche existe dans les donnees mais n'est pas publiee.
   * Voir la note en bas de fichier : deux entrees du releve n'ont pas de prix
   * coherent avec le moteur tarifaire du site.
   */
  enLigne: boolean;
  /** Etape « nombre de personnages » du configurateur. */
  personnages: boolean;
  /** Nombre de decors releve chez CartoonToi — informatif : l'etape ne s'affiche
   *  que si des visuels de decor sont reellement presents (voir visuels.ts). */
  decorsAttendus: number;
  /** Titre et description sur-mesure quand ils existent, sinon gabarit. */
  titre?: Partial<Record<Locale, string>>;
  description?: Partial<Record<Locale, string>>;
  /**
   * Slug impose pour une langue, quand le gabarit se trompe.
   *
   * Le cas courant est l'article : « Die Unglaublichen » ampute de son article
   * donne « unglaublichen », qui ne veut rien dire seul, alors que « The
   * Simpsons » donne bien « simpsons ». Aucune regle ne separe les deux — le
   * gabarit produit le cas general, ce champ tranche les exceptions.
   */
  slugLocalise?: Partial<Record<Locale, string>>;
}

/* ─── gabarits de titre et de description ──────────────────────────────── */

const GABARIT_TITRE: Record<Locale, (u: string) => string> = {
  fr: (u) => `Portrait ${u} Personnalisé`,
  en: (u) => `Custom ${u} Portrait`,
  es: (u) => `Retrato ${u} Personalizado`,
  de: (u) => `Personalisiertes ${u} Porträt`,
  it: (u) => `Ritratto ${u} Personalizzato`,
  nl: (u) => `Gepersonaliseerd ${u} Portret`,
  pl: (u) => `Spersonalizowany Portret ${u}`,
  sv: (u) => `Personligt ${u}-porträtt`,
};

const GABARIT_DESCRIPTION: Record<Locale, (u: string) => string> = {
  fr: (u) =>
    `Transforme ta photo en portrait ${u} dessiné à la main. Aperçu sous 48 h, retouches illimitées, disponible en fichier numérique, poster, toile ou cadre.`,
  en: (u) =>
    `Turn your photo into a hand-drawn ${u} portrait. Preview within 48 h, unlimited revisions, available as a digital file, poster, canvas or framed print.`,
  es: (u) =>
    `Convierte tu foto en un retrato ${u} dibujado a mano. Vista previa en 48 h, retoques ilimitados, disponible en digital, póster, lienzo o enmarcado.`,
  de: (u) =>
    `Verwandle dein Foto in ein handgezeichnetes ${u}-Porträt. Vorschau in 48 Std., unbegrenzte Korrekturen, als Datei, Poster, Leinwand oder gerahmt.`,
  it: (u) =>
    `Trasforma la tua foto in un ritratto ${u} disegnato a mano. Anteprima in 48 h, ritocchi illimitati, disponibile in digitale, poster, tela o incorniciato.`,
  nl: (u) =>
    `Laat je foto omtoveren tot een handgetekend ${u} portret. Voorbeeld binnen 48 uur, onbeperkt aanpassen, verkrijgbaar als digitaal bestand, poster, canvas of ingelijst.`,
  pl: (u) =>
    `Zamień swoje zdjęcie w ręcznie rysowany portret ${u}. Podgląd w 48 godzin, nieograniczone poprawki, do wyboru plik cyfrowy, plakat, obraz na płótnie lub w ramie.`,
  sv: (u) =>
    `Förvandla ditt foto till ett handritat ${u}-porträtt. Förhandsvisning inom 48 timmar, obegränsat med ändringar, som digital fil, affisch, canvas eller inramad.`,
};

/** Nom de l'univers dans la langue demandee, le francais servant de repli. */
export function universProduit(p: Produit, locale: Locale): string {
  return p.universLocalise?.[locale] ?? p.univers;
}

export function titreProduit(p: Produit, locale: Locale): string {
  return p.titre?.[locale] ?? GABARIT_TITRE[locale](universProduit(p, locale));
}

export function descriptionProduit(p: Produit, locale: Locale): string {
  return p.description?.[locale] ?? GABARIT_DESCRIPTION[locale](universProduit(p, locale));
}

/* ─── le catalogue ─────────────────────────────────────────────────────── */

export const CATALOGUE: Produit[] = [
  /* ---------- Portrait Manga ---------- */
  {
    slug: "onepiece",
    handle: "affiche-wanted-one-piece-personnalise",
    univers: "One Piece",
    categorie: "manga",
    idProduit: "cartoonova-onepiece-wanted",
    enLigne: true,
    personnages: true,
    decorsAttendus: 3,
    titre: {
      fr: "Affiche Wanted One Piece Personnalisée",
      en: "Custom One Piece Wanted Poster",
      es: "Póster Wanted One Piece Personalizado",
      de: "Personalisiertes One Piece Wanted Poster",
      it: "Poster Wanted One Piece Personalizzato",
    },
    description: {
      fr: "Crée ton affiche Wanted One Piece personnalisée ! Ajoute ta photo, fixe ta prime de pirate et choisis ton décor. Avis de recherche dispo en poster et cadre.",
      en: "Create your own One Piece wanted poster! Become a legendary pirate with your custom bounty.",
      de: "Erstellen Sie Ihr eigenes One Piece Steckbrief! Werden Sie ein legendärer Pirat mit Ihrem persönlichen Kopfgeld.",
      es: "¡Crea tu propio cartel de búsqueda One Piece! Conviértete en un pirata legendario con tu recompensa personalizada.",
      it: "Crea il tuo poster ricercato One Piece! Diventa un pirata leggendario con la tua taglia personalizzata.",
    },
  },
  {
    slug: "portrait-attaque-des-titans-personnalise",
    handle: "portrait-attaque-des-titans-personnalise",
    univers: "Attaque des Titans",
    universLocalise: { en: "Attack on Titan", es: "Ataque a los Titanes", de: "Attack on Titan", it: "L'attacco dei giganti", nl: "Attack on Titan", pl: "Atak Tytanów", sv: "Attack on Titan" },
    categorie: "manga",
    idProduit: "cartoonova-snk-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme-toi en héros de l'Attaque des Titans avec un portrait SNK personnalisé ! Un cadeau unique pour les fans de l'univers d'Eren, Mikasa et Levi.",
    },
  },
  {
    slug: "portrait-bleach-personnalise",
    handle: "portrait-bleach-personnalise",
    univers: "Bleach",
    categorie: "manga",
    idProduit: "cartoonova-bleach-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme-toi en Shinigami avec un portrait Bleach personnalisé. Un cadeau unique pour les fans d'Ichigo, Rukia et du Gotei 13 !",
    },
  },
  {
    slug: "portrait-death-note-personnalise",
    handle: "portrait-death-note-personnalise",
    univers: "Death Note",
    categorie: "manga",
    idProduit: "cartoonova-deathnote-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Offre un portrait Death Note personnalisé et plonge dans l'univers du manga culte. Idéal pour les fans de Light Yagami, L ou même Ryuk !",
    },
  },
  {
    slug: "portrait-demon-slayer-personnalise",
    handle: "portrait-demon-slayer-personnalise",
    univers: "Demon Slayer",
    categorie: "manga",
    idProduit: "cartoonova-demonslayer-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme ta photo en portrait Demon Slayer personnalisé. Un dessin façon Tanjiro ou Nezuko, imprimé en poster ou cadre. Cadeau pour fans d'anime !",
    },
  },
  {
    slug: "dbz",
    handle: "portrait-dragon-ball-personnalise",
    univers: "Dragon Ball",
    categorie: "manga",
    idProduit: "cartoonova-dbz-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 3,
    titre: {
      fr: "Portrait Dragon Ball Personnalisé",
      en: "Custom Dragon Ball Z Portrait",
      es: "Retrato Dragon Ball Z Personalizado",
      de: "Personalisiertes Dragon Ball Z Porträt",
      it: "Ritratto Dragon Ball Z Personalizzato",
    },
    description: {
      fr: "Offre un cadre Dragon Ball Z personnalisé ! Transforme ta photo en portrait Saiyan avec un dessin unique sur tableau ou poster. Le cadeau DBZ parfait !",
      en: "Transform into a Super Saiyan! Custom portrait in Dragon Ball Z style, hand-drawn.",
      de: "Verwandeln Sie sich in einen Super-Saiyajin! Handgezeichnetes Portrait im Dragon Ball Z Stil.",
      es: "¡Transfórmate en Super Saiyan! Retrato personalizado estilo Dragon Ball Z dibujado a mano.",
      it: "Trasformati in Super Saiyan! Ritratto personalizzato in stile Dragon Ball Z disegnato a mano.",
    },
  },
  {
    slug: "ghibli",
    handle: "",
    univers: "Studio Ghibli",
    categorie: "manga",
    idProduit: "cartoonova-ghibli-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    titre: {
      fr: "Portrait Studio Ghibli Personnalisé",
      en: "Custom Studio Ghibli Portrait",
      es: "Retrato Studio Ghibli Personalizado",
      de: "Personalisiertes Studio Ghibli Porträt",
      it: "Ritratto Studio Ghibli Personalizzato",
    },
    description: {
      fr: "Entrez dans l'univers enchanté de Ghibli ! Portrait magique inspiré de Totoro, Chihiro et Mononoké.",
      en: "Enter the enchanted world of Ghibli! Magical portrait inspired by Totoro, Spirited Away and Mononoke.",
      de: "Betreten Sie die verzauberte Welt von Ghibli! Magisches Portrait inspiriert von Totoro, Chihiro und Mononoke.",
      es: "¡Entra en el mundo encantado de Ghibli! Retrato mágico inspirado en Totoro, Chihiro y Mononoke.",
      it: "Entra nel mondo incantato di Ghibli! Ritratto magico ispirato a Totoro, Chihiro e Mononoke.",
    },
  },
  {
    slug: "portrait-hunter-x-hunter-personnalise",
    handle: "portrait-hunter-x-hunter-personnalise",
    univers: "Hunter x Hunter",
    categorie: "manga",
    idProduit: "cartoonova-hxh-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme-toi en héros du manga culte avec un portrait Hunter x Hunter personnalisé. Un cadeau unique pour les fans de Gon, Killua et Hisoka !",
    },
  },
  {
    slug: "portrait-jujutsu-kaisen-personnalise",
    handle: "portrait-jujutsu-kaisen-personnalise",
    univers: "Jujutsu Kaisen",
    categorie: "manga",
    idProduit: "cartoonova-jjk-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 2,
    description: {
      fr: "Offre un portrait Jujutsu Kaisen personnalisé et transforme-toi en exorciste aux côtés des plus grands sorciers de l'univers !",
    },
  },
  {
    slug: "portrait-naruto-personnalise",
    handle: "portrait-naruto-personnalise",
    univers: "Naruto",
    categorie: "manga",
    idProduit: "cartoonova-naruto-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 3,
    description: {
      fr: "Crée ton portrait Naruto personnalisé ! Un dessin unique en ninja de Konoha, imprimé en cadre ou poster. Le cadeau parfait pour les fans de manga.",
    },
  },

  /* ---------- Portrait Cartoon ---------- */
  {
    slug: "carte-pokemon-personnalisee",
    handle: "carte-pokemon-personnalisee",
    univers: "Pokémon",
    categorie: "cartoon",
    idProduit: "cartoonova-pokemon-carte",
    enLigne: true,
    personnages: true,
    decorsAttendus: 5,
    titre: {
      fr: "Carte Pokémon Personnalisée",
      en: "Custom Pokémon Card",
      es: "Carta Pokémon Personalizada",
      de: "Personalisierte Pokémon-Karte",
      it: "Carta Pokémon Personalizzata",
    },
    description: {
      fr: "Crée ta propre carte Pokémon personnalisée : transforme ta photo, choisis ton nom, tes attaques et ton Pokémon favori. Dessiné et imprimé en France !",
    },
  },
  {
    slug: "portrait-adventure-time-personnalise",
    handle: "portrait-adventure-time-personnalise",
    univers: "Adventure Time",
    categorie: "cartoon",
    idProduit: "cartoonova-adventuretime-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Entre dans l'univers délirant d'Adventure Time avec un portrait personnalisé unique ! Cadeau fun et original pour les vrais fans de Finn et Jake.",
    },
  },
  {
    slug: "disney",
    handle: "",
    univers: "Disney",
    categorie: "cartoon",
    idProduit: "cartoonova-disney-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Devenez le héros de votre propre conte de fées Disney ! Portrait magique style animation classique.",
      en: "Become the hero of your own Disney fairy tale! Magical portrait in classic animation style.",
      de: "Werden Sie der Held Ihres eigenen Disney-Märchens! Magisches Portrait im klassischen Animationsstil.",
      es: "¡Conviértete en el héroe de tu propio cuento de hadas Disney! Retrato mágico estilo animación clásica.",
      it: "Diventa l'eroe della tua fiaba Disney! Ritratto magico in stile animazione classica.",
    },
  },
  {
    slug: "portrait-family-guy-personnalise",
    handle: "portrait-family-guy-personnalise",
    univers: "Family Guy",
    categorie: "cartoon",
    idProduit: "cartoonova-familyguy-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Envie d'un portrait Family Guy sur-mesure ? Faites-vous dessiner dans le style de la série et offrez un cadeau fun et original aux fans du dessin animé !",
    },
  },
  {
    slug: "portrait-futurama-personnalise",
    handle: "portrait-futurama-personnalise",
    univers: "Futurama",
    categorie: "cartoon",
    idProduit: "cartoonova-futurama-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Fais-toi dessiner comme un personnage de Futurama ! Un portrait personnalisé unique dans le style de la série. L'idée-cadeau fun et originale à offrir !",
    },
  },
  {
    slug: "portrait-lego-personnalise",
    handle: "portrait-lego-personnalise",
    univers: "Lego",
    categorie: "cartoon",
    idProduit: "cartoonova-lego-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Deviens une figurine LEGO avec un portrait personnalisé fun et unique ! Parfait pour une déco originale ou un cadeau créatif. Prêt à être en briques ?",
    },
  },
  {
    slug: "portrait-playmobil-personnalise",
    handle: "portrait-playmobil-personnalise",
    univers: "Playmobil",
    categorie: "cartoon",
    idProduit: "cartoonova-playmobil-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme-toi en Playmobil avec un portrait personnalisé fun et original ! Un cadeau unique pour les fans ou une déco rétro parfaite. Prêt à jouer ?",
    },
  },
  {
    slug: "rickandmorty",
    handle: "portrait-rick-et-morty-personnalise",
    univers: "Rick et Morty",
    universLocalise: { en: "Rick and Morty", es: "Rick y Morty", de: "Rick and Morty", it: "Rick and Morty", nl: "Rick and Morty", pl: "Rick i Morty", sv: "Rick and Morty" },
    categorie: "cartoon",
    idProduit: "cartoonova-rickandmorty-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    titre: {
      fr: "Portrait Rick et Morty Personnalisé",
      en: "Custom Rick & Morty Portrait",
      es: "Retrato Rick & Morty Personalizado",
      de: "Personalisiertes Rick & Morty Porträt",
      it: "Ritratto Rick & Morty Personalizzato",
    },
    description: {
      fr: "Crée ton affiche Rick et Morty personnalisée ! Transforme ta photo en dessin original et imprime-le en poster ou cadre. Un cadeau fun pour tous les fans.",
      en: "Wubba Lubba Dub Dub! Join Rick and Morty in their interdimensional adventures with your portrait.",
      de: "Wubba Lubba Dub Dub! Begleiten Sie Rick und Morty auf ihren interdimensionalen Abenteuern mit Ihrem Portrait.",
      es: "¡Wubba Lubba Dub Dub! Únete a Rick y Morty en sus aventuras interdimensionales con tu retrato.",
      it: "Wubba Lubba Dub Dub! Unisciti a Rick e Morty nelle loro avventure interdimensionali con il tuo ritratto.",
    },
  },
  {
    slug: "simpson",
    handle: "portrait-simpson-personnalise",
    univers: "Simpson",
    universLocalise: { en: "The Simpsons", es: "Los Simpson", de: "Die Simpsons", it: "I Simpson", nl: "De Simpsons", pl: "Simpsonowie", sv: "Simpsons" },
    categorie: "cartoon",
    idProduit: "cartoonova-simpson-base",
    enLigne: true,
    personnages: true,
    decorsAttendus: 3,
    description: {
      fr: "Transforme ta photo en portrait Simpson personnalisé ! Pose en famille à Springfield avec un dessin fun. Affiche ta caricature en tableau, cadre ou poster !",
      en: "Transform your photo into a beautiful hand-drawn Simpson caricature. The perfect gift!",
      de: "Verwandeln Sie Ihr Foto in eine wunderschöne handgezeichnete Simpson-Karikatur. Das perfekte Geschenk!",
      es: "Transforma tu foto en una hermosa caricatura Simpson dibujada a mano. ¡El regalo perfecto!",
      it: "Trasforma la tua foto in una bellissima caricatura Simpson disegnata a mano. Il regalo perfetto!",
    },
  },
  {
    slug: "portrait-snoopy-personnalise",
    handle: "portrait-snoopy-personnalise",
    univers: "Snoopy",
    categorie: "cartoon",
    idProduit: "cartoonova-snoopy-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme-toi en personnage de Snoopy avec un portrait personnalisé unique ! Un cadeau fun et nostalgique pour tous les fans des Peanuts et de Charlie Brown.",
    },
  },
  {
    slug: "portrait-south-park-personnalise",
    handle: "portrait-south-park-personnalise",
    univers: "South Park",
    categorie: "cartoon",
    idProduit: "cartoonova-southpark-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 2,
    description: {
      fr: "Crée un portrait personnalisé South Park ! Un dessin unique à partir de ta photo, imprimé en poster ou cadre. Le cadeau parfait pour les fans de la série !",
    },
  },
  {
    slug: "portrait-tintin-personnalise",
    handle: "portrait-tintin-personnalise",
    univers: "Tintin",
    universLocalise: { en: "Tintin", es: "Tintín", de: "Tim und Struppi", it: "Tintin", nl: "Kuifje", pl: "Tintin", sv: "Tintin" },
    categorie: "cartoon",
    idProduit: "cartoonova-tintin-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme ta photo en portrait Tintin personnalisé. Dessiné à la main dans le style d'Hergé, c'est le cadeau idéal pour les fans de Tintin et Milou !",
    },
  },

  /* ---------- Portrait Comics ---------- */
  {
    slug: "affiche-aquaman-personnalisee",
    handle: "affiche-aquaman-personnalisee",
    univers: "Aquaman",
    categorie: "comics",
    idProduit: "cartoonova-aquaman-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme-toi en Aquaman avec un portrait personnalisé épique ! Plonge dans l'univers du Roi d'Atlantis et affirme ton style héroïque.",
    },
  },
  {
    slug: "portrait-batman-personnalise",
    handle: "portrait-batman-personnalise",
    univers: "Batman",
    categorie: "comics",
    idProduit: "cartoonova-batman-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transformez-vous en justicier avec un portrait Batman personnalisé ! Un cadeau unique pour tout fan du Chevalier Noir.",
    },
  },
  {
    slug: "affiche-black-panther-personnalisee",
    handle: "affiche-black-panther-personnalisee",
    univers: "Black Panther",
    categorie: "comics",
    idProduit: "cartoonova-blackpanther-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Incarne la puissance de Wakanda avec un portrait Black Panther personnalisé ! Un cadeau unique pour tout fan du Roi T'Challa.",
    },
  },
  {
    slug: "affiche-deadpool-personnalisee",
    handle: "affiche-deadpool-personnalisee",
    univers: "Deadpool",
    categorie: "comics",
    idProduit: "cartoonova-deadpool-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Plonge dans l'univers déjanté de Deadpool avec un portrait personnalisé ! Ajoute une touche fun et badass à ta déco.",
    },
  },
  {
    slug: "affiche-joker-personnalisee",
    handle: "affiche-joker-personnalisee",
    univers: "Joker",
    categorie: "comics",
    idProduit: "cartoonova-joker-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Entre dans la peau du Joker avec un portrait personnalisé unique ! Ajoute une touche de folie et de mystère à ta déco.",
    },
  },
  {
    slug: "portrait-spiderman-personnalise",
    handle: "portrait-spiderman-personnalise",
    univers: "Spiderman",
    categorie: "comics",
    idProduit: "cartoonova-spiderman-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Personnalise ton portrait Spiderman à partir de ta photo ! Transforme-toi en super-héros dans le style de Peter Parker. Cadeau idéal pour fan de Marvel.",
    },
  },
  {
    slug: "portrait-superman-personnalise",
    handle: "portrait-superman-personnalise",
    univers: "Superman",
    categorie: "comics",
    idProduit: "cartoonova-superman-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Envole-toi vers Metropolis avec un portrait Superman personnalisé ! Le cadeau parfait pour les fans de l'Homme d'Acier.",
    },
  },
  {
    slug: "affiche-wonderwoman-personnalisee",
    handle: "affiche-wonderwoman-personnalisee",
    univers: "Wonder Woman",
    categorie: "comics",
    idProduit: "cartoonova-wonderwoman-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Affirme ta force et ton courage avec un portrait Wonder Woman personnalisé ! Idéal pour une déco puissante et inspirante.",
    },
  },

  /* ---------- Portrait Cinéma ---------- */
  {
    slug: "portrait-harry-potter-personnalise",
    handle: "portrait-harry-potter-personnalise",
    univers: "Harry Potter",
    categorie: "cinema",
    idProduit: "cartoonova-harrypotter-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Ton portrait personnalisé dans l'univers Harry Potter ! Envoie ta photo et deviens un élève de Poudlard ou même un Auror. Le cadeau parfait pour les fans.",
    },
  },
  {
    slug: "portrait-indestructibles-personnalise",
    handle: "portrait-indestructibles-personnalise",
    univers: "Les Indestructibles",
    universLocalise: { en: "The Incredibles", es: "Los Increíbles", de: "Die Unglaublichen", it: "Gli Incredibili", nl: "The Incredibles", pl: "Iniemamocni", sv: "Superhjältarna" },
    /* Seul titre du catalogue dont l'article ne se detache pas : « Die
       Unglaublichen » ampute donne « unglaublichen », qui n'existe pas seul.
       L'anglais, lui, se passe tres bien de son article. */
    slugLocalise: {
      es: "retrato-los-increibles-personalizado",
      de: "personalisiertes-die-unglaublichen-portraet",
      it: "ritratto-gli-incredibili-personalizzato",
    },
    categorie: "cinema",
    idProduit: "cartoonova-indestructibles-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Offrez un portrait Les Indestructibles personnalisé dessiné à la main. L'idée cadeau en couple ou en famille, en poster ou en cadre.",
    },
  },
  {
    slug: "portrait-star-wars-personnalise",
    handle: "portrait-star-wars-personnalise",
    univers: "Star Wars",
    categorie: "cinema",
    idProduit: "cartoonova-starwars-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme ta photo en portrait personnalisé Star Wars. Deviens un Jedi ou un Sith avec une illustration unique. Le cadeau parfait pour les fans de la saga.",
    },
  },
  {
    slug: "portrait-stranger-things-personnalise",
    handle: "portrait-stranger-things-personnalise",
    univers: "Stranger Things",
    categorie: "cinema",
    idProduit: "cartoonova-strangerthings-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 0,
    description: {
      fr: "Transforme-toi en héros de Hawkins avec ton propre portrait Stranger Things personnalisé. Choisis ton style et plonge dans l'ambiance rétro de la série.",
    },
  },
  {
    slug: "portrait-tim-burton-personnalise",
    handle: "portrait-tim-burton-personnalise",
    univers: "Tim Burton",
    categorie: "cinema",
    idProduit: "cartoonova-timburton-portrait",
    enLigne: true,
    personnages: true,
    decorsAttendus: 4,
    description: {
      fr: "Transforme-toi en personnage digne d'un film de Tim Burton avec un portrait personnalisé unique. Un cadeau gothique et original pour les fans du style burtonien !",
    },
  },

  /* ---------- Les deux entrées non publiées ----------
     Elles complètent le relevé des 36 mais ne sont pas mises en ligne :
     le moteur tarifaire du site applique une grille unique (base + support +
     personnages), et ces deux fiches ne s'y rattachent pas — la première est
     un supplément d'impression, pas un produit ; la seconde est une anomalie
     du relevé (handle `brume-truefilter™` sans rapport avec le titre).
     Passer `enLigne: true` suffit à les publier une fois leur prix arbitré. */
  {
    slug: "portrait-grand-format",
    handle: "portrait-grand-format",
    univers: "Grand Format",
    categorie: "cartoon",
    idProduit: "cartoonova-grand-format",
    enLigne: false,
    personnages: false,
    decorsAttendus: 0,
    titre: {
      fr: "Ton Portrait en Grand Format",
      en: "Your Portrait in Large Format",
      es: "Tu Retrato en Gran Formato",
      de: "Dein Porträt im Großformat",
      it: "Il Tuo Ritratto in Grande Formato",
    },
  },
  {
    slug: "super-cafe",
    handle: "brume-truefilter™",
    univers: "Super Café",
    categorie: "cartoon",
    idProduit: "cartoonova-super-cafe",
    enLigne: false,
    personnages: false,
    decorsAttendus: 0,
    titre: {
      fr: "Super Café",
      en: "Super Café",
      es: "Super Café",
      de: "Super Café",
      it: "Super Café",
    },
  },
];

/* ─── acces ────────────────────────────────────────────────────────────── */

/**
 * Le produit phare — celui sur lequel le site est batî.
 *
 * Le catalogue compte 38 univers, mais ils ne pesent pas le meme poids : les
 * Simpson sont attendus a environ 70 % du chiffre. Le site etait pourtant
 * construit comme si les 38 se valaient — tous les appels a l'action de
 * l'accueil menaient a la grille des 38 fiches, et le menu deroulant mettait
 * en avant Rick et Morty pour la seule raison qu'il precede Simpson dans
 * l'ordre alphabetique.
 *
 * Cette constante est le SEUL endroit ou ce choix est ecrit. Ordre du
 * catalogue, menu, fiches similaires, page collections, sitemap : tout en
 * derive. Changer de produit phare — ou revenir en arriere si le mix reel
 * dement la prevision — c'est changer cette ligne.
 */
export const SLUG_PHARE = "simpson";

/* Le produit phare passe devant. `CATALOGUE_EN_LIGNE` est la source d'ordre de
   toutes les listes du site : la grille des collections, les colonnes du menu,
   le repli mobile. Trier ici evite d'avoir a le refaire dans chacune. */
export const CATALOGUE_EN_LIGNE = (() => {
  const enLigne = CATALOGUE.filter((p) => p.enLigne);
  const phare = enLigne.find((p) => p.slug === SLUG_PHARE);
  return phare ? [phare, ...enLigne.filter((p) => p !== phare)] : enLigne;
})();

export const SLUGS_PRODUIT = CATALOGUE_EN_LIGNE.map((p) => p.slug);

const PAR_SLUG = new Map(CATALOGUE.map((p) => [p.slug, p]));

/* ─── slugs localises ──────────────────────────────────────────────────── */

/**
 * Six univers gardent leur slug dans toutes les langues.
 *
 * Ce sont des noms de marque — « simpson », « dbz », « onepiece » — qui ne se
 * traduisent pas, et surtout : ce sont les seules fiches qui recoivent des
 * impressions aujourd'hui et vers lesquelles pointent les campagnes. Les
 * deplacer couterait plus que le mot francais qu'on y gagnerait.
 *
 * Les 29 autres portent un slug entierement francais — « portrait-naruto-
 * personnalise » servi sur /en, /de, /es, /it. Elles ne sont ni en production
 * ni indexees : les localiser maintenant ne coute rien, et coutera une
 * migration une fois qu'elles auront des positions.
 */
const SLUGS_HISTORIQUES = new Set(["simpson", "dbz", "disney", "ghibli", "onepiece", "rickandmorty"]);

/** Le francais encode la nature du produit dans le prefixe de son slug. */
type TypeProduit = "portrait" | "affiche" | "carte";

function typeProduit(p: Produit): TypeProduit {
  if (p.slug.startsWith("affiche-")) return "affiche";
  if (p.slug.startsWith("carte-")) return "carte";
  return "portrait";
}

const GABARIT_SLUG: Record<Locale, Record<TypeProduit, (u: string) => string>> = {
  fr: {
    portrait: (u) => `portrait-${u}-personnalise`,
    affiche: (u) => `affiche-${u}-personnalisee`,
    carte: (u) => `carte-${u}-personnalisee`,
  },
  en: {
    portrait: (u) => `custom-${u}-portrait`,
    affiche: (u) => `custom-${u}-poster`,
    carte: (u) => `custom-${u}-card`,
  },
  es: {
    portrait: (u) => `retrato-${u}-personalizado`,
    affiche: (u) => `poster-${u}-personalizado`,
    carte: (u) => `carta-${u}-personalizada`,
  },
  de: {
    portrait: (u) => `personalisiertes-${u}-portraet`,
    affiche: (u) => `personalisiertes-${u}-poster`,
    carte: (u) => `personalisierte-${u}-karte`,
  },
  it: {
    portrait: (u) => `ritratto-${u}-personalizzato`,
    affiche: (u) => `poster-${u}-personalizzato`,
    carte: (u) => `carta-${u}-personalizzata`,
  },
  /* « portret » est un het-woord : l'adjectif reste sans -e. « poster » et
     « kaart » sont des de-woorden et le prennent. */
  nl: {
    portrait: (u) => `gepersonaliseerd-${u}-portret`,
    affiche: (u) => `gepersonaliseerde-${u}-poster`,
    carte: (u) => `gepersonaliseerde-${u}-kaart`,
  },
  /* L'adjectif s'accorde au genre du nom : « portret » et « plakat » sont
     masculins, « karta » est feminin. Et le polonais place l'univers apres
     le nom, la ou les autres langues l'intercalent. */
  pl: {
    portrait: (u) => `spersonalizowany-portret-${u}`,
    affiche: (u) => `spersonalizowany-plakat-${u}`,
    carte: (u) => `spersonalizowana-karta-${u}`,
  },
  /* Le suedois accorde l'adjectif au genre du nom : « porträtt » et « kort »
     sont neutres et prennent -t, « affisch » est commun et reste nu. */
  sv: {
    portrait: (u) => `personligt-${u}-portratt`,
    affiche: (u) => `personlig-${u}-affisch`,
    carte: (u) => `personligt-${u}-kort`,
  },
};

/** Article defini en tete de slug : « les-indestructibles » → « indestructibles ». */
const ARTICLE_EN_TETE = /^(?:die|der|das|the|les|las|los|gli|la|le|el|il|lo|i|l)-/;

/**
 * Transforme un libelle en fragment d'URL.
 *
 * Les umlauts passent par leur transcription allemande — ä → ae, ß → ss — et
 * non par le depouillement d'accent generique, qui donnerait « portrat » la ou
 * l'allemand ecrit « portraet ».
 */
export function slugifie(texte: string, locale?: Locale): string {
  let t = texte.toLowerCase();

  /* Le trema ne se translittere pas partout pareil. L'allemand developpe —
     ä devient ae — mais le suedois ecrit simplement a : « Superhjältarna »
     donne superhjaltarna, pas superhjaeltarna. Appliquer la regle allemande
     a toutes les langues produisait un slug qu'aucun Suedois ne tape. */
  if (locale === "de") {
    t = t.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
  }

  return t
    /* Le eszett ne se decompose pas et n'existe qu'en allemand. */
    .replace(/ß/g, "ss")
    /* Le l polonais barre est un caractere a part entiere, pas un l porteur
       d'un signe : la decomposition Unicode ne le touche pas et il
       disparaitrait du slug. */
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug d'une fiche dans une langue donnee. */
export function slugProduit(p: Produit, locale: Locale): string {
  const impose = p.slugLocalise?.[locale];
  if (impose) return impose;

  if (SLUGS_HISTORIQUES.has(p.slug)) return p.slug;
  if (locale === "fr") return p.slug;

  const univers = slugifie(universProduit(p, locale), locale).replace(ARTICLE_EN_TETE, "");
  return GABARIT_SLUG[locale][typeProduit(p)](univers);
}

/** Tous les slugs d'une fiche, par langue — pour les hreflang et le sitemap. */
export function slugsProduit(p: Produit): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, slugProduit(p, l)])) as Record<Locale, string>;
}

const PAR_SLUG_LOCALISE = new Map<string, Produit>();
for (const p of CATALOGUE) {
  for (const l of locales) PAR_SLUG_LOCALISE.set(`${l}:${slugProduit(p, l)}`, p);
}

/**
 * Retrouve une fiche a partir d'un segment d'URL.
 *
 * Sans langue, seul le slug canonique est reconnu — c'est le comportement
 * d'origine. Avec une langue, le slug localise est essaye d'abord, puis le
 * canonique : ce repli est ce qui permet a l'ancienne URL francaise servie sur
 * /en de continuer a repondre, le temps que la redirection permanente soit
 * suivie.
 */
export function produitParSlug(slug: string, locale?: Locale): Produit | undefined {
  const p = (locale ? PAR_SLUG_LOCALISE.get(`${locale}:${slug}`) : undefined) ?? PAR_SLUG.get(slug);
  return p?.enLigne ? p : undefined;
}

/** Slugs a prerendre pour une langue. */
export function slugsProduitDe(locale: Locale): string[] {
  return CATALOGUE_EN_LIGNE.map((p) => slugProduit(p, locale));
}

/**
 * Tous les slugs de fiche, toutes langues confondues.
 *
 * Sert a reconnaitre une fiche produit depuis un chemin sans savoir dans
 * quelle langue on se trouve — la coque de mise en page, par exemple, qui
 * n'affiche la relance de sortie que sur une fiche. `SLUGS_PRODUIT` seul ne
 * suffit plus depuis que les slugs sont localises : il ne contient que la
 * forme francaise et laisserait passer /en/custom-naruto-portrait.
 */
export const SLUGS_PRODUIT_TOUTES_LANGUES: readonly string[] = [
  ...new Set(locales.flatMap((l) => CATALOGUE_EN_LIGNE.map((p) => slugProduit(p, l)))),
];

/** Le produit phare, ou `undefined` s'il a ete depublie. */
export function produitPhare(): Produit | undefined {
  return produitParSlug(SLUG_PHARE);
}

/**
 * Ordre d'affichage des familles : celle du produit phare passe devant.
 *
 * `CATEGORIES` reste la liste de reference — c'est elle qui definit le type.
 * Celle-ci est son ordre a l'ecran : barre de navigation, repli mobile,
 * carrousel de l'accueil, groupes de la page collections. Sans elle, un
 * visiteur qui ouvrait le catalogue tombait d'abord sur « Portrait Manga »,
 * alors que la famille qui pese 70 % des ventes venait en deuxieme.
 *
 * Derive de `SLUG_PHARE` : changer de produit phare reordonne tout le site.
 */
export const CATEGORIES_AFFICHAGE: readonly Categorie[] = (() => {
  const phare = produitPhare();
  if (!phare) return CATEGORIES;
  return [phare.categorie, ...CATEGORIES.filter((c) => c !== phare.categorie)];
})();

export function produitsParCategorie(categorie: Categorie): Produit[] {
  return CATALOGUE_EN_LIGNE.filter((p) => p.categorie === categorie);
}

/** Les quatre univers mis en avant dans le menu et sur l'accueil. */
export const VEDETTES = ["simpson", "dbz", "onepiece", "rickandmorty"] as const;

export function produitsVedettes(): Produit[] {
  return VEDETTES.map((slug) => PAR_SLUG.get(slug)).filter(
    (p): p is Produit => Boolean(p?.enLigne)
  );
}

/**
 * Quatre suggestions de la même catégorie, en excluant la fiche courante.
 *
 * Le produit phare y figure toujours, en tête, meme s'il vient d'une autre
 * categorie. C'est le seul endroit du site ou les 37 autres fiches peuvent
 * renvoyer vers lui : sans cela, quelqu'un arrive sur « Portrait Naruto » par
 * une recherche ne croisait jamais l'univers qui fait 70 % des ventes.
 */
export function produitsSimilaires(p: Produit, nombre = 4): Produit[] {
  const phare = p.slug === SLUG_PHARE ? undefined : produitPhare();
  const exclus = new Set([p.slug, phare?.slug].filter(Boolean));

  const memeCategorie = produitsParCategorie(p.categorie).filter((q) => !exclus.has(q.slug));
  const complement = CATALOGUE_EN_LIGNE.filter(
    (q) => !exclus.has(q.slug) && q.categorie !== p.categorie
  );

  return [...(phare ? [phare] : []), ...memeCategorie, ...complement].slice(0, nombre);
}
