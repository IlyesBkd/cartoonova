/**
 * Fabrique la file de sujets du blog a partir du corpus de requetes.
 *
 *   node scripts/genere-sujets.mjs
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 *
 * Le moteur tournait sur dix-sept sujets ecrits a la main, qu'il recyclait.
 * A cote, le depot contient 15 112 requetes deja qualifiees par langue, par
 * grappe et par intention, dont 11 947 de longue traine.
 *
 * Surtout, ces requetes disent ou le terrain est libre. « portrait simpson
 * personnalise » est dispute par Etsy et par le concurrent direct, et un
 * domaine sans notoriete ne le prendra pas cette annee. « cadeau noel portrait
 * simpson » n'interesse presque personne d'autre — c'est la que quelques
 * articles peuvent reellement se classer.
 *
 * ── Ce qu'il produit ─────────────────────────────────────────────────────
 *
 * Un sujet par couple univers x occasion, plus les requetes de type « comment
 * faire ». Chacun porte l'adresse que le corpus lui destine : la page cadeau
 * de l'occasion, ou la fiche produit pour les sujets explicatifs. L'article
 * naitra donc avec un lien vers ce qu'il sert, ce qui manquait entierement —
 * aucun article du blog ne pointait vers une page de vente.
 *
 * Une part de la file est reservee aux sujets explicatifs. Sans cela, la
 * saison les balaie : en aout, les cadeaux de Noel raflent toute la place,
 * alors que « comment transformer une photo » se cherche toute l'annee.
 *
 * ── Ce qui evite de refaire la meme erreur ───────────────────────────────
 *
 * Deux cent dix articles moules sur le meme gabarit seraient le probleme des
 * fiches, transpose au blog. Trois precautions : la file est plafonnee, les
 * intitules alternent entre plusieurs tournures, et le resume porte les vraies
 * requetes de la grappe — un cadeau de mariage Naruto et un cadeau de Noel
 * Simpson n'ont ni le meme angle ni le meme lecteur.
 *
 * ── Pourquoi il tourne a chaque passage du moteur ────────────────────────
 *
 * La fraicheur depend du calendrier : la Saint-Valentin ne vaut rien en juin.
 * Recalculer le fichier avant chaque execution evite d'avoir a le versionner
 * et le garde toujours de saison. Le script ne depend que de Node.
 */

import fs from "node:fs";
import path from "node:path";

const CORPUS = path.join("data", "seo", "corpus-requetes.csv");
const SORTIE = path.join("portable-content-publisher", "fixtures", "cartoonova-topics.json");

/** Langue de redaction du moteur ; les autres sont obtenues par traduction. */
const LANGUE = "fr";

/** Plafond de la file. Au-dela, on empile des sujets que le moteur n'atteindra
    jamais, et on augmente le risque de se repeter. */
const MAX_SUJETS = Number(process.env.SUJETS_MAX || 90);

/* ═══ lecture du corpus ═════════════════════════════════════════════════ */

function corpus() {
  const lignes = fs
    .readFileSync(CORPUS, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  const cols = lignes[0].split(",");
  const i = (n) => cols.indexOf(n);
  const [iL, iC, iQ, iR, iI, iE, iU] = [
    i("langue"), i("cluster"), i("requete"), i("rang"),
    i("intention"), i("entite"), i("url_destination"),
  ];
  return lignes.slice(1).map((l) => {
    const c = l.split(",");
    return {
      langue: c[iL], cluster: c[iC], requete: c[iQ], rang: c[iR],
      intention: c[iI], entite: c[iE], url: c[iU],
    };
  });
}

/* ═══ nom lisible de l'univers ══════════════════════════════════════════ */

/* Les six univers historiques portent un slug qui ne se lit pas ; les autres
   suivent une regle. On ne recopie pas le catalogue : le script doit rester
   sans dependance pour tourner dans le workflow du moteur, qui n'installe pas
   les paquets du site. */
const NOMS = {
  simpson: "Simpson",
  dbz: "Dragon Ball",
  onepiece: "One Piece",
  ghibli: "Studio Ghibli",
  disney: "Disney",
  rickandmorty: "Rick et Morty",
};

function nomUnivers(entite) {
  /* Le corpus suffixe l'entite par l'occasion pour les grappes cadeau
     (« simpson/noel ») : seule la partie avant la barre nomme l'univers. */
  const base = String(entite).split("/")[0];
  if (NOMS[base]) return NOMS[base];
  return base
    .replace(/^(portrait|affiche|carte)-/, "")
    .replace(/-personnalise[e]?$/, "")
    .split("-")
    .map((m) => (m.length > 2 ? m[0].toUpperCase() + m.slice(1) : m))
    .join(" ");
}

/* ═══ saison ════════════════════════════════════════════════════════════ */

/* Mois de l'occasion, en base 1. Les occasions sans saison valent null : elles
   se vendent toute l'annee et n'ont pas a monter ni descendre. */
const SAISON = {
  "cadeau-noel": 12,
  "cadeau-saint-valentin": 2,
  "cadeau-fete-des-meres": 5,
  "cadeau-mariage": 6,
  "cadeau-anniversaire": null,
  "cadeau-depart": null,
};

/**
 * Un article doit paraitre avant l'occasion, pas pendant : le temps qu'il soit
 * explore et classe, la date est passee. La fraicheur culmine donc deux mois
 * avant, et retombe une fois l'occasion franchie.
 */
function fraicheur(occasion) {
  const mois = SAISON[occasion];
  if (mois == null) return 70;
  const courant = new Date().getUTCMonth() + 1;
  let ecart = mois - courant;
  if (ecart < -1) ecart += 12; // l'occasion de l'an prochain
  if (ecart < 0) return 35; // vient de passer
  if (ecart <= 2) return 100; // la bonne fenetre
  if (ecart <= 4) return 75;
  return 45;
}

const LIBELLE = {
  "cadeau-noel": "Noël",
  "cadeau-saint-valentin": "la Saint-Valentin",
  "cadeau-fete-des-meres": "la fête des mères",
  "cadeau-mariage": "un mariage",
  "cadeau-anniversaire": "un anniversaire",
  "cadeau-depart": "un départ",
};

/* Plusieurs tournures par occasion, choisies selon l'univers : trente-cinq
   titres identiques a un mot pres seraient exactement le defaut qu'on vient de
   corriger sur les fiches. */
const TOURNURES = {
  "cadeau-noel": [
    (u) => `Offrir un portrait ${u} à Noël : ce qu'il faut prévoir`,
    (u) => `Un portrait ${u} sous le sapin : délais, formats, budget`,
    (u) => `Pourquoi un portrait ${u} fait un bon cadeau de Noël`,
  ],
  "cadeau-saint-valentin": [
    (u) => `Un portrait ${u} pour la Saint-Valentin`,
    (u) => `Offrir un portrait ${u} à deux : nos conseils`,
    (u) => `Saint-Valentin : le portrait ${u} en cadeau`,
  ],
  "cadeau-fete-des-meres": [
    (u) => `Un portrait ${u} pour la fête des mères`,
    (u) => `Offrir un portrait ${u} à sa mère : comment s'y prendre`,
    (u) => `Fête des mères : le portrait ${u} de toute la famille`,
  ],
  "cadeau-mariage": [
    (u) => `Offrir un portrait ${u} pour un mariage`,
    (u) => `Un portrait ${u} en cadeau de mariage : formats et délais`,
    (u) => `Mariage : le portrait ${u} des mariés`,
  ],
  "cadeau-anniversaire": [
    (u) => `Un portrait ${u} en cadeau d'anniversaire`,
    (u) => `Offrir un portrait ${u} pour un anniversaire`,
    (u) => `Anniversaire : pourquoi le portrait ${u} plaît`,
  ],
  "cadeau-depart": [
    (u) => `Un portrait ${u} pour un départ de collègue`,
    (u) => `Offrir un portrait ${u} à quelqu'un qui s'en va`,
    (u) => `Pot de départ : le portrait ${u} en cadeau collectif`,
  ],
};

/** Choix stable : le meme univers garde toujours la meme tournure. */
function tournure(occasion, univers, entite) {
  const liste = TOURNURES[occasion];
  if (!liste) return null;
  let somme = 0;
  for (const c of entite) somme = (somme + c.charCodeAt(0)) % 9973;
  return liste[somme % liste.length](univers);
}

/* ═══ construction ══════════════════════════════════════════════════════ */

function main() {
  const lignes = corpus().filter((l) => l.langue === LANGUE && l.requete);

  /* Les grappes « fiche » appartiennent aux pages produit. Un article qui les
     viserait entrerait en concurrence avec la fiche qu'il est cense servir. */
  const grappes = new Map();
  for (const l of lignes) {
    const parts = l.cluster.split(":");
    const occasion = parts[2] ?? "";
    if (!occasion || occasion === "fiche") continue;
    if (!grappes.has(l.cluster)) {
      /* `parts[1]` est l'entite nue ; la colonne `entite` y accole l'occasion. */
      grappes.set(l.cluster, { entite: parts[1], occasion, url: l.url, requetes: [], traine: 0 });
    }
    const g = grappes.get(l.cluster);
    g.requetes.push(l.requete);
    if (l.rang === "longue_traine") g.traine++;
  }

  const sujets = [];

  for (const [cluster, g] of grappes) {
    const univers = nomUnivers(g.entite);
    const titre = tournure(g.occasion, univers, g.entite);
    if (!titre) continue;

    /* La part de longue traine mesure a quel point le terrain est libre : plus
       les requetes sont specifiques, moins elles sont disputees, et plus nos
       chances de nous y classer sont reelles. C'est ce que le moteur appelle
       « authority » — sa capacite a tenir le sujet, pas la notoriete du site. */
    const partTraine = g.requetes.length ? g.traine / g.requetes.length : 0;
    const authority = Math.round(45 + partTraine * 50);
    const demand = Math.min(100, 30 + g.requetes.length * 6);

    sujets.push({
      id: cluster.replace(/:/g, "-"),
      title: titre,
      summary:
        `Ce que vaut un portrait ${univers} offert pour ${LIBELLE[g.occasion]} : ` +
        `a qui il s'adresse, quel format choisir, et le delai a prevoir pour l'avoir a temps. ` +
        `Angle tire des recherches reelles : ${g.requetes.slice(0, 3).join(", ")}.`,
      sourceUrls: [g.url],
      keywords: [...new Set(g.requetes)].slice(0, 8),
      category: "gift-guides",
      freshness: fraicheur(g.occasion),
      demand,
      authority,
      discoveredAt: new Date().toISOString(),
    });
  }

  /* ── les requetes « comment faire », par univers ── */
  const parEntite = new Map();
  for (const l of lignes) {
    if (l.intention !== "informationnel") continue;
    if (!parEntite.has(l.entite)) parEntite.set(l.entite, { url: l.url, requetes: [] });
    parEntite.get(l.entite).requetes.push(l.requete);
  }
  for (const [entite, e] of parEntite) {
    const univers = nomUnivers(entite);
    sujets.push({
      id: `fr-${entite}-comment`,
      title: `Transformer une photo en portrait ${univers} : comment ça se passe`,
      summary:
        `Les etapes concretes, de la photo envoyee au fichier livre : ce qui fait une bonne photo de depart, ` +
        `ce que l'illustrateur peut ajuster, et combien de temps cela prend. ` +
        `Recherches visees : ${e.requetes.slice(0, 3).join(", ")}.`,
      sourceUrls: [e.url],
      keywords: [...new Set(e.requetes)].slice(0, 8),
      category: "tutorials",
      // Sans saison : la question se pose toute l'annee.
      freshness: 65,
      demand: Math.min(100, 30 + e.requetes.length * 6),
      authority: 85,
      discoveredAt: new Date().toISOString(),
    });
  }

  /* Le moteur classe par freshness*0.4 + demand*0.35 + authority*0.25.
     On trie pareil pour que le plafond coupe les sujets les moins prometteurs
     plutot qu'une tranche arbitraire. */
  sujets.sort(
    (a, b) =>
      b.freshness * 0.4 + b.demand * 0.35 + b.authority * 0.25 -
      (a.freshness * 0.4 + a.demand * 0.35 + a.authority * 0.25)
  );

  /* Les sujets ecrits a la main restent : ils sont generiques et hors univers,
     donc ils ne font doublon avec rien de ce qui precede. */
  let existants = [];
  try {
    existants = JSON.parse(fs.readFileSync(SORTIE, "utf8")).filter(
      (t) => !String(t.id).startsWith("fr-") && !String(t.id).startsWith("fr:")
    );
  } catch {
    /* Premier passage, ou fichier illisible : on repart des seuls sujets calcules. */
  }

  const vus = new Set(existants.map((t) => t.id));
  const retenus = [...existants];

  /* Un cinquieme de la file revient aux sujets explicatifs, servis en premier
     pour que la saison ne les evince pas. Ils sont peu nombreux : la reserve
     suffit largement a les faire tous entrer. */
  const budget = Math.max(0, MAX_SUJETS - existants.length);
  const reserve = Math.round(budget * 0.2);

  const ajouter = (liste, place) => {
    for (const s of liste) {
      if (place-- <= 0) break;
      if (vus.has(s.id)) continue;
      vus.add(s.id);
      retenus.push(s);
    }
  };

  ajouter(sujets.filter((s) => s.category === "tutorials"), reserve);
  ajouter(sujets, budget - (retenus.length - existants.length));

  fs.writeFileSync(SORTIE, JSON.stringify(retenus, null, 2) + "\n", "utf8");

  const parCategorie = {};
  for (const t of retenus) parCategorie[t.category] = (parCategorie[t.category] ?? 0) + 1;
  console.log(`[sujets] ${retenus.length} sujet(s) écrits dans ${SORTIE}`);
  console.log(
    `[sujets] dont ${existants.length} conservés · ` +
      Object.entries(parCategorie).map(([c, n]) => `${c} ${n}`).join(" · ")
  );
  console.log(`[sujets] tête de file :`);
  for (const t of retenus.slice(existants.length, existants.length + 5)) {
    console.log(`   f${t.freshness} d${t.demand} a${t.authority}  ${t.title}`);
  }
}

main();
