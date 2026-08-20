/**
 * Corpus de requetes cibles — source unique du mapping requete → URL.
 *
 *   node --experimental-strip-types --env-file=.env.local \
 *        --import ./scripts/charge-ts.mjs scripts/genere-corpus-requetes.mjs
 *
 * Ce que ce fichier est : l'espace de requetes que le site doit couvrir,
 * derive du catalogue reel, avec pour chaque ligne sa langue, son intention,
 * son cluster et l'URL censee la servir.
 *
 * Ce que ce fichier n'est PAS : une etude de volumes. Aucune source de donnees
 * de recherche n'est branchee sur ce depot. Les colonnes `volume` et
 * `difficulte` sont donc absentes plutot que devinees — elles se joindront sur
 * la colonne `requete` le jour ou un export Ahrefs, Semrush ou Keyword Planner
 * sera disponible. Le classement `rang` (pivot / variante / longue_traine)
 * traduit une structure linguistique, pas une demande mesuree.
 *
 * Les motifs sont ecrits langue par langue, pas traduits. L'allemand en est la
 * demonstration : on n'y cherche pas « portrait personnalise » mais
 * « ... zeichnen lassen » — faire dessiner. Le releve Search Console du
 * 2026-08-17 le confirme, la seule requete commerciale allemande sur laquelle
 * le site apparait est « karikatur erstellen lassen ».
 */

import fs from "node:fs";
import path from "node:path";

import { locales } from "../i18n/config.ts";
import { CATALOGUE_EN_LIGNE, slugProduit, universProduit } from "../lib/catalogue.ts";
import { OCCASION_KEYS, buildGiftSlug } from "../lib/giftOccasions.ts";
import { GIFT_PRODUCTS } from "../lib/productFeed.ts";
import { SITE_URL } from "../lib/site.ts";

const SORTIE = "data/seo/corpus-requetes.csv";

/* ─── vocabulaire par langue ───────────────────────────────────────────── */

/** Occasions, telles qu'on les tape dans une barre de recherche. */
const OCCASION_MOTS = {
  fr: { anniversaire: "anniversaire", noel: "noël", "saint-valentin": "saint valentin", "fete-des-meres": "fête des mères", mariage: "mariage", depart: "départ à la retraite" },
  en: { anniversaire: "birthday", noel: "christmas", "saint-valentin": "valentines day", "fete-des-meres": "mothers day", mariage: "wedding", depart: "retirement" },
  es: { anniversaire: "cumpleaños", noel: "navidad", "saint-valentin": "san valentín", "fete-des-meres": "día de la madre", mariage: "boda", depart: "jubilación" },
  de: { anniversaire: "geburtstag", noel: "weihnachten", "saint-valentin": "valentinstag", "fete-des-meres": "muttertag", mariage: "hochzeit", depart: "ruhestand" },
  it: { anniversaire: "compleanno", noel: "natale", "saint-valentin": "san valentino", "fete-des-meres": "festa della mamma", mariage: "matrimonio", depart: "pensionamento" },
  nl: { anniversaire: "verjaardag", noel: "kerst", "saint-valentin": "valentijnsdag", "fete-des-meres": "moederdag", mariage: "bruiloft", depart: "pensioen" },
};

/** Supports d'impression proposes au configurateur. */
const FORMAT_MOTS = {
  fr: ["poster", "toile", "cadre", "numérique"],
  en: ["poster", "canvas", "framed", "digital"],
  es: ["póster", "lienzo", "enmarcado", "digital"],
  de: ["poster", "leinwand", "gerahmt", "digital"],
  it: ["poster", "tela", "incorniciato", "digitale"],
  nl: ["poster", "canvas", "ingelijst", "digitaal"],
};

/** Destinataires : c'est la que se joue la longue traine commerciale. */
const DESTINATAIRE_MOTS = {
  fr: ["couple", "famille", "enfant", "meilleure amie", "collègue", "chien"],
  en: ["couple", "family", "kids", "best friend", "coworker", "dog"],
  es: ["pareja", "familia", "niños", "mejor amiga", "compañero de trabajo", "perro"],
  de: ["paar", "familie", "kinder", "beste freundin", "kollegen", "hund"],
  it: ["coppia", "famiglia", "bambini", "migliore amica", "collega", "cane"],
  nl: ["koppel", "gezin", "kinderen", "beste vriendin", "collega", "hond"],
};

/* ─── motifs de requete, par langue ────────────────────────────────────── */

const T = "transactionnel";
const I = "informationnel";

/** Motifs appliques a chaque univers du catalogue. */
const MOTIFS_STYLE = {
  fr: [
    ["pivot", T, (s) => `portrait ${s} personnalisé`],
    ["variante", T, (s) => `caricature ${s} personnalisée`],
    ["variante", T, (s) => `dessin ${s} personnalisé`],
    ["variante", T, (s) => `portrait ${s} sur mesure`],
    ["variante", T, (s) => `acheter portrait ${s}`],
    ["variante", T, (s) => `affiche ${s} personnalisée`],
    ["variante", T, (s) => `poster ${s} personnalisé`],
    ["variante", T, (s) => `cadeau ${s} personnalisé`],
    ["longue_traine", T, (s) => `portrait ${s} à partir d'une photo`],
    ["longue_traine", T, (s) => `commander un portrait ${s}`],
    ["longue_traine", T, (s) => `portrait ${s} personnalisé pas cher`],
    ["longue_traine", T, (s) => `portrait de famille ${s}`],
    ["longue_traine", T, (s) => `portrait ${s} dessiné à la main`],
    ["longue_traine", I, (s) => `transformer sa photo en ${s}`],
    ["variante", I, (s) => `se transformer en ${s}`],
    ["longue_traine", I, (s) => `devenir un personnage ${s}`],
    ["longue_traine", I, (s) => `comment se dessiner en ${s}`],
  ],
  en: [
    ["pivot", T, (s) => `custom ${s} portrait`],
    ["variante", T, (s) => `personalized ${s} portrait`],
    ["variante", T, (s) => `${s} caricature from photo`],
    ["variante", T, (s) => `custom ${s} poster`],
    ["variante", T, (s) => `${s} portrait gift`],
    ["variante", T, (s) => `buy custom ${s} portrait`],
    ["variante", T, (s) => `${s} portrait commission`],
    ["longue_traine", T, (s) => `${s} portrait from photo`],
    ["longue_traine", T, (s) => `hand drawn ${s} portrait`],
    ["longue_traine", T, (s) => `order ${s} portrait online`],
    ["longue_traine", T, (s) => `custom ${s} family portrait`],
    ["longue_traine", T, (s) => `${s} portrait maker`],
    // La famille « turn me … » est le reflexe anglophone du secteur : c'est
    // sur elle que TurnedYellow s'est construit.
    ["variante", I, (s) => `turn me into ${s}`],
    ["longue_traine", I, (s) => `turn your photo into ${s}`],
    ["longue_traine", I, (s) => `become a ${s} character`],
    ["longue_traine", I, (s) => `how to draw yourself as ${s}`],
  ],
  es: [
    ["pivot", T, (s) => `retrato ${s} personalizado`],
    ["variante", T, (s) => `caricatura ${s} personalizada`],
    ["variante", T, (s) => `dibujo ${s} personalizado`],
    ["variante", T, (s) => `póster ${s} personalizado`],
    ["variante", T, (s) => `regalo retrato ${s}`],
    ["variante", T, (s) => `comprar retrato ${s} personalizado`],
    ["longue_traine", T, (s) => `retrato ${s} a partir de una foto`],
    ["longue_traine", T, (s) => `retrato ${s} hecho a mano`],
    ["longue_traine", T, (s) => `encargar retrato ${s}`],
    ["longue_traine", T, (s) => `retrato familiar ${s} personalizado`],
    ["variante", I, (s) => `convertirse en ${s}`],
    ["longue_traine", I, (s) => `convertir foto en ${s}`],
    ["longue_traine", I, (s) => `cómo dibujarse como ${s}`],
  ],
  de: [
    // « zeichnen lassen » — faire dessiner — est la formulation allemande de
    // la commande sur mesure. La traduction litterale de « portrait
    // personnalise » ne se cherche pas.
    ["pivot", T, (s) => `${s} porträt zeichnen lassen`],
    ["pivot", T, (s) => `personalisiertes ${s} porträt`],
    ["variante", T, (s) => `${s} karikatur zeichnen lassen`],
    ["variante", T, (s) => `${s} zeichnung nach foto`],
    ["variante", T, (s) => `individuelles ${s} porträt`],
    ["variante", T, (s) => `${s} poster personalisiert`],
    ["variante", T, (s) => `${s} porträt geschenk`],
    ["variante", T, (s) => `${s} porträt kaufen`],
    ["longue_traine", T, (s) => `handgezeichnetes ${s} porträt`],
    ["longue_traine", T, (s) => `${s} familienporträt personalisiert`],
    ["longue_traine", T, (s) => `${s} porträt vom foto erstellen lassen`],
    ["variante", I, (s) => `sich in ${s} verwandeln`],
    ["longue_traine", I, (s) => `foto in ${s} verwandeln`],
    // Un motif du type « wie werde ich zu {s} » a ete ecarte : il exige un
    // article decline selon le genre et le nombre de l'univers, que le
    // catalogue ne porte pas. Une requete grammaticalement fausse ne se
    // cherche pas.
    ["variante", T, (s) => `${s} cartoon porträt`],
  ],
  it: [
    ["pivot", T, (s) => `ritratto ${s} personalizzato`],
    ["variante", T, (s) => `caricatura ${s} personalizzata`],
    ["variante", T, (s) => `disegno ${s} personalizzato`],
    ["variante", T, (s) => `poster ${s} personalizzato`],
    ["variante", T, (s) => `regalo ritratto ${s}`],
    ["variante", T, (s) => `comprare ritratto ${s} personalizzato`],
    ["longue_traine", T, (s) => `ritratto ${s} da foto`],
    ["longue_traine", T, (s) => `ritratto ${s} fatto a mano`],
    ["longue_traine", T, (s) => `ordinare ritratto ${s}`],
    ["longue_traine", T, (s) => `ritratto di famiglia ${s} personalizzato`],
    ["variante", I, (s) => `diventare un personaggio ${s}`],
    ["longue_traine", I, (s) => `trasformare foto in ${s}`],
    ["longue_traine", I, (s) => `come disegnarsi come ${s}`],
  ],
  nl: [
    // « laten tekenen » — faire dessiner — est au neerlandais ce que
    // « zeichnen lassen » est a l'allemand : la formulation de la commande sur
    // mesure. Elle ne se devine pas depuis le francais.
    ["pivot", T, (s) => `${s} portret laten tekenen`],
    ["pivot", T, (s) => `gepersonaliseerd ${s} portret`],
    ["variante", T, (s) => `${s} karikatuur laten maken`],
    ["variante", T, (s) => `${s} tekening naar foto`],
    ["variante", T, (s) => `${s} portret op maat`],
    ["variante", T, (s) => `${s} poster gepersonaliseerd`],
    ["variante", T, (s) => `${s} portret cadeau`],
    ["variante", T, (s) => `${s} portret kopen`],
    ["variante", T, (s) => `${s} cartoon portret`],
    ["longue_traine", T, (s) => `handgetekend ${s} portret`],
    ["longue_traine", T, (s) => `${s} familieportret gepersonaliseerd`],
    ["longue_traine", T, (s) => `${s} portret van foto laten maken`],
    ["longue_traine", T, (s) => `${s} portret bestellen`],
    ["variante", I, (s) => `jezelf als ${s} figuur`],
    ["longue_traine", I, (s) => `foto omzetten naar ${s}`],
  ],
};

/** Motifs croisant un univers et une occasion. */
const MOTIFS_OCCASION = {
  fr: [(s, o) => `cadeau ${o} portrait ${s}`, (s, o) => `portrait ${s} pour ${o}`, (s, o) => `idée cadeau ${o} ${s}`],
  en: [(s, o) => `${s} portrait ${o} gift`, (s, o) => `custom ${s} gift for ${o}`, (s, o) => `${o} gift ${s} portrait`],
  es: [(s, o) => `regalo ${o} retrato ${s}`, (s, o) => `retrato ${s} para ${o}`, (s, o) => `idea regalo ${o} ${s}`],
  de: [(s, o) => `${s} porträt geschenk ${o}`, (s, o) => `${o} geschenk ${s} porträt`, (s, o) => `geschenkidee ${o} ${s}`],
  it: [(s, o) => `regalo ${o} ritratto ${s}`, (s, o) => `ritratto ${s} per ${o}`, (s, o) => `idea regalo ${o} ${s}`],
  nl: [(s, o) => `${s} portret cadeau ${o}`, (s, o) => `${o} cadeau ${s} portret`, (s, o) => `cadeau-idee ${o} ${s}`],
};

const MOTIFS_FORMAT = {
  fr: (s, f) => `portrait ${s} personnalisé ${f}`,
  en: (s, f) => `custom ${s} portrait ${f}`,
  es: (s, f) => `retrato ${s} personalizado ${f}`,
  de: (s, f) => `${s} porträt personalisiert ${f}`,
  it: (s, f) => `ritratto ${s} personalizzato ${f}`,
  nl: (s, f) => `${s} portret gepersonaliseerd ${f}`,
};

const MOTIFS_DESTINATAIRE = {
  fr: (s, d) => `portrait ${s} personnalisé ${d}`,
  en: (s, d) => `custom ${s} portrait for ${d}`,
  es: (s, d) => `retrato ${s} personalizado ${d}`,
  de: (s, d) => `${s} porträt für ${d}`,
  it: (s, d) => `ritratto ${s} personalizzato ${d}`,
  nl: (s, d) => `${s} portret voor ${d}`,
};

/** Requetes sans univers : elles visent la page pilier ou le catalogue. */
const MOTIFS_GENERIQUES = {
  fr: [
    ["pivot", T, "portrait personnalisé cartoon", "pilier"],
    ["variante", T, "caricature personnalisée", "pilier"],
    ["variante", T, "portrait dessiné à la main d'après photo", "pilier"],
    ["variante", T, "dessin personnalisé d'après photo", "pilier"],
    ["longue_traine", T, "portrait de famille personnalisé cartoon", "pilier"],
    ["longue_traine", I, "transformer une photo en dessin animé", "pilier"],
    ["variante", T, "portrait cartoon en ligne", "catalogue"],
    ["variante", T, "styles de portraits personnalisés", "catalogue"],
  ],
  en: [
    ["pivot", T, "custom cartoon portrait", "pilier"],
    ["variante", T, "personalized caricature from photo", "pilier"],
    ["variante", T, "hand drawn portrait from photo", "pilier"],
    ["variante", T, "cartoon yourself", "pilier"],
    ["longue_traine", T, "custom family cartoon portrait", "pilier"],
    ["longue_traine", I, "turn photo into cartoon", "pilier"],
    ["variante", T, "cartoon portrait styles", "catalogue"],
    ["variante", T, "custom portrait online", "catalogue"],
  ],
  es: [
    ["pivot", T, "retrato cartoon personalizado", "pilier"],
    ["variante", T, "caricatura personalizada a partir de foto", "pilier"],
    ["variante", T, "retrato dibujado a mano por encargo", "pilier"],
    ["longue_traine", T, "retrato familiar cartoon personalizado", "pilier"],
    ["longue_traine", I, "convertir foto en dibujo animado", "pilier"],
    ["variante", T, "estilos de retratos personalizados", "catalogue"],
  ],
  de: [
    ["pivot", T, "karikatur erstellen lassen", "pilier"],
    ["pivot", T, "personalisiertes cartoon porträt", "pilier"],
    ["variante", T, "porträt zeichnen lassen nach foto", "pilier"],
    ["variante", T, "karikatur vom foto zeichnen lassen", "pilier"],
    ["longue_traine", T, "familienporträt zeichnen lassen", "pilier"],
    ["longue_traine", I, "foto in cartoon verwandeln", "pilier"],
    ["variante", T, "cartoon porträt stile", "catalogue"],
  ],
  it: [
    ["pivot", T, "ritratti personalizzati cartoon", "pilier"],
    ["variante", T, "caricatura personalizzata da foto", "pilier"],
    ["variante", T, "ritratto disegnato a mano da foto", "pilier"],
    ["longue_traine", T, "ritratto di famiglia cartoon personalizzato", "pilier"],
    ["longue_traine", I, "trasformare foto in cartone animato", "pilier"],
    ["variante", T, "stili di ritratti personalizzati", "catalogue"],
  ],
  nl: [
    ["pivot", T, "portret laten tekenen", "pilier"],
    ["pivot", T, "gepersonaliseerd cartoonportret", "pilier"],
    ["variante", T, "karikatuur laten maken van foto", "pilier"],
    ["variante", T, "handgetekend portret naar foto", "pilier"],
    ["longue_traine", T, "familieportret laten tekenen", "pilier"],
    ["longue_traine", I, "foto omzetten naar cartoon", "pilier"],
    ["variante", T, "cartoon portret stijlen", "catalogue"],
  ],
};

/**
 * Marques concurrentes.
 *
 * Se positionner dessus est legitime par le contenu comparatif — une page
 * « alternative a X » qui compare honnetement prix, delais et rendu releve de
 * l'usage nominatif de la marque. Ce qui ne l'est pas : reprendre la marque
 * dans un `title`, un slug ou une annonce, ni suggerer une affiliation.
 * Ces lignes visent donc un article de blog, jamais une fiche produit.
 */
const CONCURRENTS = [
  { marque: "turnedyellow", styleAssocie: "simpson" },
  { marque: "yellowify", styleAssocie: "simpson" },
  { marque: "simpsonize me", styleAssocie: "simpson" },
  { marque: "cartoontoi", styleAssocie: null },
  { marque: "portraitflip", styleAssocie: null },
  { marque: "photolamus", styleAssocie: null },
];

const MOTIFS_CONCURRENT = {
  fr: [(m) => `${m} avis`, (m) => `alternative à ${m}`, (m) => `${m} prix`],
  en: [(m) => `${m} review`, (m) => `${m} alternative`, (m) => `${m} vs`],
  es: [(m) => `${m} opiniones`, (m) => `alternativa a ${m}`],
  de: [(m) => `${m} erfahrungen`, (m) => `${m} alternative`],
  it: [(m) => `${m} recensioni`, (m) => `alternativa a ${m}`],
  nl: [(m) => `${m} ervaringen`, (m) => `${m} alternatief`],
};

/* ─── generation ───────────────────────────────────────────────────────── */

/**
 * Nom de l'univers tel qu'on le tape.
 *
 * `universProduit` sert l'affichage : « Die Simpsons », « Los Increíbles »,
 * « L'attacco dei giganti ». Dans une barre de recherche, l'article ne se
 * comporte pas pareil selon la langue :
 *
 *   - allemand et anglais : on tape « simpsons porträt zeichnen lassen »,
 *     « custom simpsons portrait ». L'article tombe, on le retire.
 *   - langues romanes : « retrato increíbles » ne se dit pas. Le naturel
 *     serait « retrato de los increíbles » — une preposition que le gabarit
 *     ne sait pas placer, et qui varie avec le genre et le nombre.
 *
 * On ne bricole donc pas les langues romanes : le nom d'affichage est
 * conserve tel quel et la ligne est marquee `a_relire`, pour qu'un locuteur
 * natif tranche. Une quinzaine de clusters sont concernes, sur 1 265.
 */
const ARTICLE_RETIRABLE = { de: /^(?:die|der|das)\s+/i, en: /^the\s+/i };
const ARTICLE_QUELCONQUE = /^(?:die|der|das|the|les|la|le|los|las|el|gli|il|lo|i)\s+|^l['']/i;

function nomPourRequete(produit, langue) {
  const affichage = universProduit(produit, langue);
  const retirable = ARTICLE_RETIRABLE[langue];
  const nom = retirable ? affichage.replace(retirable, "").trim() : affichage;
  return { nom, aRelire: !retirable && ARTICLE_QUELCONQUE.test(affichage) };
}

const SLUGS_CADEAU_EXISTANTS = new Set(GIFT_PRODUCTS.map((p) => p.slug));

const lignes = [];
const vues = new Map(); // requete+langue → URL, pour detecter les conflits

function ajoute({ langue, cluster, requete, rang, intention, entite, url, statut, aRelire = false }) {
  const propre = requete.toLowerCase().replace(/\s+/g, " ").trim();
  const cle = `${langue}::${propre}`;

  if (vues.has(cle)) {
    const precedente = vues.get(cle);
    if (precedente.url !== url) {
      conflits.push({ langue, requete: propre, url1: precedente.url, url2: url, cluster1: precedente.cluster, cluster2: cluster });
    }
    return; // doublon : une requete n'entre qu'une fois dans le corpus
  }

  vues.set(cle, { url, cluster });
  lignes.push({ langue, cluster, requete: propre, rang, intention, entite, url, statut, aRelire: aRelire ? "oui" : "" });
}

const conflits = [];

for (const langue of locales) {
  const occasionMots = OCCASION_MOTS[langue];
  const formats = FORMAT_MOTS[langue];
  const destinataires = DESTINATAIRE_MOTS[langue];

  /* — univers du catalogue — */
  for (const produit of CATALOGUE_EN_LIGNE) {
    const { nom, aRelire } = nomPourRequete(produit, langue);
    const url = `${SITE_URL}/${langue}/${slugProduit(produit, langue)}`;
    const cluster = `${langue}:${produit.slug}:fiche`;

    for (const [rang, intention, modele] of MOTIFS_STYLE[langue]) {
      ajoute({ langue, cluster, requete: modele(nom), rang, intention, entite: produit.slug, url, statut: "existante", aRelire });
    }

    for (const format of formats) {
      ajoute({ langue, cluster, requete: MOTIFS_FORMAT[langue](nom, format), rang: "longue_traine", intention: T, entite: produit.slug, url, statut: "existante", aRelire });
    }

    for (const destinataire of destinataires) {
      ajoute({ langue, cluster, requete: MOTIFS_DESTINATAIRE[langue](nom, destinataire), rang: "longue_traine", intention: T, entite: produit.slug, url, statut: "existante", aRelire });
    }

    /* — croisement univers × occasion — */
    for (const occasion of OCCASION_KEYS) {
      const existe = SLUGS_CADEAU_EXISTANTS.has(produit.slug);
      const urlCadeau = `${SITE_URL}/${langue}/cadeau/${buildGiftSlug(langue, produit.slug, occasion)}`;
      const clusterCadeau = `${langue}:${produit.slug}:cadeau-${occasion}`;

      for (const modele of MOTIFS_OCCASION[langue]) {
        ajoute({
          langue,
          cluster: clusterCadeau,
          requete: modele(nom, occasionMots[occasion]),
          rang: "longue_traine",
          intention: T,
          entite: `${produit.slug}/${occasion}`,
          url: urlCadeau,
          statut: existe ? "existante" : "a_creer",
          aRelire,
        });
      }
    }
  }

  /* — requetes sans univers — */
  for (const [rang, intention, requete, cible] of MOTIFS_GENERIQUES[langue]) {
    const url =
      cible === "pilier"
        ? `${SITE_URL}/${langue}/portrait-personnalise-cartoon`
        : `${SITE_URL}/${langue}/collections`;
    ajoute({ langue, cluster: `${langue}:generique:${cible}`, requete, rang, intention, entite: "generique", url, statut: "existante" });
  }

  /* — marques concurrentes — */
  for (const { marque, styleAssocie } of CONCURRENTS) {
    for (const modele of MOTIFS_CONCURRENT[langue]) {
      ajoute({
        langue,
        cluster: `${langue}:concurrent:${marque}`,
        requete: modele(marque),
        rang: "longue_traine",
        intention: "navigationnel",
        entite: styleAssocie ?? "generique",
        url: `${SITE_URL}/${langue}/blog/comparatif-${marque.replace(/\s+/g, "-")}`,
        statut: "a_creer",
      });
    }
  }
}

/* ─── controle de cannibalisation ──────────────────────────────────────── */

/* La regle : un cluster est servi par une URL et une seule. Deux URL sur un
   meme cluster, c'est deux pages qui se disputent la meme requete — chacune
   affaiblissant l'autre. */
const urlsParCluster = new Map();
for (const l of lignes) {
  if (!urlsParCluster.has(l.cluster)) urlsParCluster.set(l.cluster, new Set());
  urlsParCluster.get(l.cluster).add(l.url);
}
const clustersMultiUrl = [...urlsParCluster.entries()].filter(([, urls]) => urls.size > 1);

/* ─── ecriture ─────────────────────────────────────────────────────────── */

const COLONNES = ["langue", "cluster", "requete", "rang", "intention", "entite", "url_destination", "statut_url", "a_relire"];

const echappe = (v) => {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(
  SORTIE,
  // BOM : sans lui Excel ouvre le fichier en ANSI et casse les accents.
  "﻿" +
    [COLONNES.join(","), ...lignes.map((l) => [l.langue, l.cluster, l.requete, l.rang, l.intention, l.entite, l.url, l.statut, l.aRelire].map(echappe).join(","))].join("\n") +
    "\n"
);

/* ─── rapport ──────────────────────────────────────────────────────────── */

const compte = (predicat) => lignes.filter(predicat).length;

console.log(`corpus : ${lignes.length} requetes distinctes\n`);

console.log("par langue");
for (const l of locales) {
  const n = compte((x) => x.langue === l);
  const aCreer = compte((x) => x.langue === l && x.statut === "a_creer");
  console.log(`  ${l}  ${String(n).padStart(5)}   dont ${String(aCreer).padStart(4)} sans page`);
}

console.log("\npar rang");
for (const r of ["pivot", "variante", "longue_traine"]) {
  console.log(`  ${r.padEnd(14)} ${String(compte((x) => x.rang === r)).padStart(5)}`);
}

console.log("\npar intention");
for (const i of [T, I, "navigationnel"]) {
  console.log(`  ${i.padEnd(16)} ${String(compte((x) => x.intention === i)).padStart(5)}`);
}

console.log("\ncouverture");
console.log(`  servies par une page existante : ${compte((x) => x.statut === "existante")}`);
console.log(`  sans page                      : ${compte((x) => x.statut === "a_creer")}`);
console.log(`  clusters                       : ${urlsParCluster.size}`);
console.log(`  URL de destination distinctes  : ${new Set(lignes.map((l) => l.url)).size}`);

console.log("\na relire par un locuteur natif");
const aRelire = compte((x) => x.aRelire === "oui");
console.log(`  ${aRelire} requetes — univers dont le nom porte un article dans une langue romane`);
for (const l of ["fr", "es", "it"]) {
  const ex = lignes.find((x) => x.langue === l && x.aRelire === "oui");
  if (ex) console.log(`    ${l} : « ${ex.requete} »`);
}

console.log("\ncannibalisation");
console.log(`  clusters vises par plusieurs URL : ${clustersMultiUrl.length}`);
console.log(`  requetes reclamees par deux URL  : ${conflits.length}`);
for (const c of conflits.slice(0, 10)) {
  console.log(`    « ${c.requete} » (${c.langue}) : ${c.url1} vs ${c.url2}`);
}

console.log(`\necrit dans ${SORTIE}`);
