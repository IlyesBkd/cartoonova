/**
 * Redige le contenu propre a chaque fiche produit.
 *
 *   npx tsx scripts/genere-contenu-fiches.mts
 *
 * ── Le probleme qu'il resout ─────────────────────────────────────────────
 *
 * Les 35 fiches en ligne partagent 6 163 caracteres de gabarit identique pour
 * 140 caracteres propres : 2 % de texte unique. Google en a indexe trois sur
 * trente-huit, un clic organique hors marque en quatre-vingt-onze jours, zero
 * citation sur les vingt requetes de la sonde. Trente-cinq pages quasi
 * identiques sont un doublon, et un moteur n'en garde qu'une.
 *
 * ── Ce qu'il ecrit ───────────────────────────────────────────────────────
 *
 * Une accroche, trois sections et cinq questions par fiche et par langue,
 * dans `contenus_fiche`. Le brief ne sort pas de nulle part : il vient du
 * corpus de 15 112 requetes deja qualifiees du depot, filtre sur l'univers et
 * la langue. On ecrit contre des requetes reelles, pas contre une idee de ce
 * que les gens cherchent. Verifie : chacune des 35 fiches a des requetes dans
 * les dix langues.
 *
 * ── Ce qui l'empeche de reintroduire le probleme ─────────────────────────
 *
 * Generer trente-cinq variantes du meme paragraphe remplacerait un doublon par
 * un autre. Trois gardes s'y opposent :
 *
 *   - longueur minimale, sinon la fiche n'a rien gagne sur le gabarit ;
 *   - l'univers doit etre nomme, sinon le texte est interchangeable ;
 *   - ressemblance avec les fiches deja ecrites DANS LA MEME LANGUE, relues
 *     en base et pas seulement celles du passage courant.
 *
 * Un texte refuse n'est pas ecrit, et la fiche repasse au lancement suivant.
 * Mieux vaut une fiche au gabarit qu'une fiche remplie de bruit : la premiere
 * est ignoree, la seconde est penalisante.
 *
 * ── Comment il avance, sans personne ─────────────────────────────────────
 *
 * Une langue est epuisee avant que la suivante commence : le francais d'abord,
 * puis l'anglais, puis les huit autres. Les vagues se font donc d'elles-memes,
 * et un passage nocturne suffit a faire progresser le catalogue.
 *
 * Personne ne relit les lots. Ce qui tient lieu de relecture, ce sont les trois
 * gardes ci-dessus, plus le compte rendu Discord de fin de passage : une panne
 * d'API ou un gabarit qui se mettrait a produire la meme chose partout se voit
 * le lendemain matin. Et le juge de fond reste la sonde de citation — si la
 * part de requetes citees ne monte pas quelques semaines apres un lot, c'est le
 * gabarit qu'il faut revoir, pas le volume.
 */

import { CATALOGUE_EN_LIGNE, universProduit } from "../lib/catalogue";
import type { Locale } from "../i18n/config";
import {
  enregistrerContenuFiche,
  textesDeLangue,
  couvertureContenus,
} from "../lib/contenuFiche";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/* ═══ reglages ══════════════════════════════════════════════════════════ */

/**
 * Fiches redigees par passage. A douze par nuit, les 350 fiches des dix
 * langues sont couvertes en un mois, pour un cout quotidien negligeable.
 */
const PAR_PASSAGE = Number(process.env.CONTENU_PAR_PASSAGE || 12);

/**
 * Ordre de traitement. Le script epuise une langue avant de passer a la
 * suivante : le francais est donc entierement redige, puis l'anglais, puis le
 * reste. La progression par vagues se fait toute seule, sans que personne ait
 * a relancer quoi que ce soit langue par langue.
 */
const LANGUES = (process.env.CONTENU_LANGUES || "fr,en,es,de,it,nl,pl,sv,da,pt")
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean) as Locale[];

/* Memes variables que le moteur de contenu (`portable-content-publisher`) :
   les secrets existent deja en Actions, il n'y en a pas de nouveaux a poser. */
const CLE = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
const POINT = process.env.AI_ENDPOINT || "https://api.openai.com/v1/chat/completions";
const MODELE = process.env.AI_MODEL || "gpt-4o";

/** En dessous, la fiche n'a rien gagne sur le gabarit. */
const LONGUEUR_MIN = Number(process.env.CONTENU_LONGUEUR_MIN || 900);
/** Au-dela, deux fiches se ressemblent trop — c'est le defaut qu'on corrige. */
const SIMILARITE_MAX = Number(process.env.CONTENU_SIMILARITE_MAX || 0.45);

const CORPUS = path.join("data", "seo", "corpus-requetes.csv");

/* ═══ brief : les vraies requetes de l'univers ══════════════════════════ */

interface Requete {
  langue: string;
  requete: string;
  entite: string;
  intention: string;
}

let corpusCache: Requete[] | null = null;

/* Decoupage naif volontaire : le fichier est verifie sans guillemet et a
   exactement neuf champs sur ses 15 112 lignes. Un vrai analyseur CSV serait
   du ceremonial pour un fichier du depot dont on controle la forme. */
function corpus(): Requete[] {
  if (corpusCache) return corpusCache;
  const lignes = fs
    .readFileSync(CORPUS, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  const cols = lignes[0].split(",");
  const i = (n: string) => cols.indexOf(n);
  const [iL, iQ, iE, iI] = [i("langue"), i("requete"), i("entite"), i("intention")];
  corpusCache = lignes.slice(1).map((l) => {
    const c = l.split(",");
    return { langue: c[iL], requete: c[iQ], entite: c[iE], intention: c[iI] };
  });
  return corpusCache;
}

/** Requetes reelles pour cet univers et cette langue. */
function requetesPour(cles: string[], langue: string, max = 25): string[] {
  const vues = new Set<string>();
  for (const q of corpus()) {
    if (q.langue !== langue || !q.requete) continue;
    if (!cles.includes(q.entite)) continue;
    vues.add(q.requete);
    if (vues.size >= max) break;
  }
  return [...vues];
}

/* ═══ gardes ════════════════════════════════════════════════════════════ */

/** Jaccard sur les mots de plus de quatre lettres. Grossier, mais on cherche
    deux textes visiblement moules l'un sur l'autre, pas un plagiat subtil. */
function similarite(a: string, b: string): number {
  const mots = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, " ")
        .split(/\s+/)
        .filter((m) => m.length > 4)
    );
  const A = mots(a);
  const B = mots(b);
  if (!A.size || !B.size) return 0;
  let commun = 0;
  for (const m of A) if (B.has(m)) commun++;
  return commun / (A.size + B.size - commun);
}

/* Le mot le plus long du nom d'univers, pas le premier : « Les Indestructibles »
   commence par un article present dans n'importe quel texte francais, la garde
   ne verifierait rien. */
function motSignificatif(univers: string): string {
  return univers
    .split(/[\s-]+/)
    .sort((a, b) => b.length - a.length)[0]
    .toLowerCase();
}

/* ═══ redaction ═════════════════════════════════════════════════════════ */

interface Redige {
  intro: string;
  sections: { titre: string; corps: string }[];
  faq: { question: string; reponse: string }[];
}

const CONSIGNE = `Tu rediges le contenu d'une fiche produit pour Cartoonova, qui dessine a la main des portraits personnalises a partir des photos du client, dans le style d'un univers de fiction.

Regles absolues :
- Ecris DANS LA LANGUE demandee, entierement, y compris les titres de section.
- Parle de CE style precis : ce qui le rend reconnaissable, a qui il plait, pour quelles occasions on l'offre. Un texte qui marcherait tel quel pour un autre univers est un echec.
- Nomme l'univers demande : c'est ce que le lecteur cherche, et le texte doit dire de quel style il parle.
- En revanche, ne laisse jamais entendre qu'il s'agit d'un produit officiel : aucune mention de licence, de partenariat, d'ayant droit ou d'approbation. C'est un portrait dans un style inspire, et rien d'autre.
- Aucun superlatif invente, aucune promesse chiffree qui ne soit pas dans la liste ci-dessous. N'invente ni delai, ni garantie, ni nombre de clients, ni avis.
- Ton simple et concret, phrases courtes, pas de remplissage.

Faits utilisables, et rien d'autre :
- dessine a la main par un illustrateur, a partir des photos envoyees
- apercu sous 2 jours ouvres, retouches illimitees
- a partir de 5 EUR par personnage
- supports : fichier numerique, poster, toile, poster encadre

Reponds en JSON strict, sans texte autour :
{"intro":"2 phrases","sections":[{"titre":"...","corps":"2 paragraphes separes par une ligne vide"}],"faq":[{"question":"...","reponse":"..."}]}
Exactement 3 sections et 5 questions.`;

async function rediger(univers: string, langue: string, requetes: string[]): Promise<Redige | null> {
  let r: Response;
  try {
    r = await fetch(POINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELE,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CONSIGNE },
          {
            role: "user",
            content: `Univers : ${univers}\nLangue : ${langue}\n\nRequetes reelles des acheteurs, a couvrir naturellement :\n${requetes
              .map((q) => `- ${q}`)
              .join("\n")}`,
          },
        ],
      }),
    });
  } catch (e) {
    console.log(`échec réseau (${(e as Error).message})`);
    return null;
  }

  if (!r.ok) {
    console.log(`échec ${r.status} — ${(await r.text()).slice(0, 140)}`);
    return null;
  }

  const brut = (await r.json())?.choices?.[0]?.message?.content;
  if (!brut) {
    console.log("échec — réponse vide");
    return null;
  }
  try {
    const j = JSON.parse(brut);
    if (!Array.isArray(j.sections) || !Array.isArray(j.faq) || typeof j.intro !== "string") {
      console.log("refusé — structure inattendue");
      return null;
    }
    return j as Redige;
  } catch {
    console.log("refusé — réponse hors JSON");
    return null;
  }
}

/* ═══ passage ═══════════════════════════════════════════════════════════ */

/**
 * Compte rendu sur Discord.
 *
 * Personne ne lit les journaux d'un travail planifie. Sans ce point, une panne
 * d'API ou une garde qui refuserait tout passerait inapercue des semaines, et
 * on croirait le catalogue en train de se remplir alors qu'il ne bouge pas.
 */
async function versDiscord(titre: string, texte: string, couleur: number) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: titre, description: texte.slice(0, 3800), color: couleur }],
      }),
    });
  } catch {
    /* Un compte rendu manque ne doit pas faire echouer des fiches deja ecrites. */
  }
}

const texteDe = (c: Redige) =>
  [
    c.intro,
    ...c.sections.map((s) => `${s.titre} ${s.corps}`),
    ...c.faq.map((f) => `${f.question} ${f.reponse}`),
  ].join(" ");

async function main() {
  if (!CLE) {
    console.error("[contenu] AI_API_KEY manquante.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("[contenu] DATABASE_URL manquante.");
    process.exit(1);
  }

  console.log(
    `[contenu] ${PAR_PASSAGE} fiche(s) max · modele ${MODELE} · langues ${LANGUES.join(",")}`
  );
  console.log("[contenu] couverture avant :", JSON.stringify(await couvertureContenus()));

  let ecrites = 0;
  let refusees = 0;

  for (const langue of LANGUES) {
    if (ecrites >= PAR_PASSAGE) break;

    /* Une seule lecture par langue : elle donne a la fois les fiches deja
       redigees (a sauter) et leurs textes (pour la garde anti-doublon). */
    const deja = await textesDeLangue(langue);
    const faites = new Set(deja.map((d) => d.produit));
    const voisins = deja.map((d) => d.texte);

    for (const produit of CATALOGUE_EN_LIGNE) {
      if (ecrites >= PAR_PASSAGE) break;
      if (faites.has(produit.slug)) continue;

      const univers = universProduit(produit, langue);
      const requetes = requetesPour([produit.slug, produit.handle].filter(Boolean), langue);
      if (!requetes.length) {
        console.log(`  · ${langue}/${produit.slug} — aucune requête au corpus, ignorée`);
        continue;
      }

      process.stdout.write(`  → ${langue}/${produit.slug} (${univers})… `);
      const redige = await rediger(univers, langue, requetes);
      if (!redige) {
        refusees++;
        continue;
      }

      const texte = texteDe(redige);

      if (texte.length < LONGUEUR_MIN) {
        refusees++;
        console.log(`refusé — trop court (${texte.length} car.)`);
        continue;
      }
      if (!texte.toLowerCase().includes(motSignificatif(univers))) {
        refusees++;
        console.log("refusé — l'univers n'est pas nommé");
        continue;
      }
      const pire = voisins.reduce((max, v) => Math.max(max, similarite(texte, v)), 0);
      if (pire > SIMILARITE_MAX) {
        refusees++;
        console.log(`refusé — trop proche d'une autre fiche (${pire.toFixed(2)})`);
        continue;
      }

      await enregistrerContenuFiche({
        produit: produit.slug,
        locale: langue,
        intro: redige.intro,
        sections: redige.sections,
        faq: redige.faq,
        empreinte: createHash("sha256").update(texte).digest("hex").slice(0, 32),
      });

      voisins.push(texte);
      ecrites++;
      console.log(`écrit (${texte.length} car., ressemblance max ${pire.toFixed(2)})`);
    }
  }

  const couverture = await couvertureContenus();
  const total = couverture.reduce((n, c) => n + c.redigees, 0);
  const objectif = CATALOGUE_EN_LIGNE.length * LANGUES.length;

  console.log(`\n[contenu] ${ecrites} écrite(s), ${refusees} refusée(s)`);
  console.log("[contenu] couverture après :", JSON.stringify(couverture));

  const detail = couverture
    .map((c) => `${c.locale} ${c.redigees}/${CATALOGUE_EN_LIGNE.length}`)
    .join(" · ");

  if (ecrites === 0 && refusees === 0) {
    /* Plus rien a ecrire. Un mot une seule fois, quand le catalogue est
       couvert : pas un rappel quotidien pour un travail qui tourne a vide. */
    if (total >= objectif) {
      await versDiscord(
        "Contenu des fiches — terminé",
        `${total} fiches rédigées sur ${objectif}.`,
        0x4f9d69
      );
    }
  } else if (ecrites === 0) {
    /* Tout a ete refuse : c'est le signal qui compte. Soit l'API repond mal,
       soit le gabarit produit des textes trop proches les uns des autres. */
    await versDiscord(
      "⚠️ Contenu des fiches — aucune fiche écrite",
      `${refusees} tentative(s), toutes refusées. Couverture inchangée : ${detail}`,
      0xd94f4f
    );
  } else {
    await versDiscord(
      "Contenu des fiches",
      `**${ecrites}** fiche(s) écrite(s), ${refusees} refusée(s). ` +
        `Couverture : ${total}/${objectif} — ${detail}`,
      0xe9ba3b
    );
  }
}

await main();
