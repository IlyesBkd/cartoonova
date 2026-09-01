/**
 * Sonde de citation : est-ce que les assistants parlent de Cartoonova ?
 *
 *   node scripts/sonde-citations.mjs
 *
 * Pourquoi elle existe. Au 26 aout 2026, ChatGPT est la premiere source de
 * trafic externe du site — huit visiteurs en quatorze jours contre quatre pour
 * Google — et la seule vente reelle du mois en vient. Personne ne mesure ca.
 * Le jour ou les assistants cessent de citer le site, on l'apprendra six
 * semaines plus tard en regardant les ventes.
 *
 * Deux semaines avant l'ecriture de ce script, ChatGPT a divise par quatre-vingt
 * ses citations de Reddit du jour au lendemain. Ce genre de bascule ne se
 * previent pas : il se constate, a condition de mesurer tous les jours.
 *
 * ── Ce que la sonde est, et n'est pas ────────────────────────────────────
 *
 * C'est un THERMOMETRE, pas un agent. Elle pose exactement les memes questions,
 * dans le meme ordre, avec les memes parametres, tous les jours. Toute sa
 * valeur vient de cette constance : si la mesure bouge, c'est que le marche a
 * bouge. Un outil qui « apprendrait » a mieux formuler ses questions
 * detruirait la seule chose qu'on lui demande.
 *
 * Elle ne demande jamais a un modele « suis-je cite ? ». Elle lit les
 * citations la ou l'API les renvoie en structure — annotations OpenAI,
 * references SerpAPI, tableau de citations Perplexity — et compare des noms de
 * domaine. Un juge qui interprete aurait son humeur du jour.
 *
 * ── Les surfaces ─────────────────────────────────────────────────────────
 *
 * Chacune s'active si sa cle est presente, et se tait sinon. C'est la meme
 * convention que le reste du depot : une cle absente desactive une
 * fonctionnalite, elle ne fait pas echouer le programme.
 *
 *   OPENAI_API_KEY (ou AI_API_KEY)  approche ChatGPT Search
 *   PERPLEXITY_API_KEY              Perplexity — la meilleure fidelite
 *   SERPAPI_API_KEY                 Google AI Overviews — VOIR LE PLAFOND
 *
 * Le plafond SerpAPI n'est pas un detail : le quota est deja calibre au plus
 * juste pour le moteur de contenu. La surface est donc DESACTIVEE par defaut
 * et ne s'allume qu'en fixant `SONDE_SERPAPI_MAX` a un nombre de requetes
 * qu'on accepte de depenser chaque jour.
 */

import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

/* ═══ reglages ══════════════════════════════════════════════════════════ */

const NOTRE_DOMAINE = "cartoonova.com";
const CORPUS = path.join("data", "seo", "corpus-requetes.csv");

/** Questions posees chaque jour, par langue. Voir `choisirQuestions`. */
const PAR_LANGUE = Number(process.env.SONDE_PAR_LANGUE || 10);

/* L'univers phare et le nombre de places qui lui sont reservees.
   Simpson represente environ 70 % des ventes attendues. Un echantillon d'un
   pivot par univers lui donnait 2 questions sur 20 — 10 % de la mesure pour
   70 % du chiffre. On lui reserve donc plusieurs places, prises dans ses
   propres variantes (« caricature simpson personnalisee », « acheter portrait
   simpson »…), le reste allant a la tete des autres univers.
   Pas 70 % de l'echantillon pour autant : la longue traine des autres univers
   est justement le terrain ou un petit site peut se faire citer, et le perdre
   de vue serait se priver du seul angle gagnable. */
/* Le phare n'est pas celui des ventes, c'est celui des assistants. Releve
   PostHog sur 60 jours des arrivees depuis chatgpt.com : carte Pokemon 12
   sessions (fr, de, it), page pilier 6, Simpson 5, Disney 2. On mesurait
   Simpson parce qu'il fait le chiffre ; c'est la carte Pokemon qu'il faut
   surveiller, parce que c'est elle qu'on recommande. */
const PHARE = process.env.SONDE_PHARE || "carte-pokemon-personnalisee";
const PHARE_PAR_LANGUE = Number(process.env.SONDE_PHARE_PAR_LANGUE || 4);

/* Meme releve : fr 17, en 9, de 2, it 2. L'allemand et l'italien envoyaient du
   trafic sans jamais etre mesures. */
const LANGUES = (process.env.SONDE_LANGUES || "fr,en,de,it").split(",").map((l) => l.trim());

/* Part des questions explicatives dans l'echantillon.
 *
 * La sonde ne testait que des requetes transactionnelles — « portrait simpson
 * personnalise » et ses variantes. Elle a renvoye zero citation pendant des
 * semaines, ce qui etait exact et trompeur : pendant ce temps ChatGPT etait la
 * PREMIERE source de trafic du site, devant Google. Les gens ne dictent pas
 * une requete commerciale a un assistant, ils lui posent une question.
 *
 * On garde des transactionnelles — c'est la ou une citation vaut le plus — et
 * on ajoute des explicatives, qui sont ce qu'on demande reellement. */
const PART_EXPLICATIVE = Number(process.env.SONDE_PART_EXPLICATIVE || 0.4);

/** Nombre de requetes SerpAPI autorisees par passage. 0 = surface eteinte. */
const SERPAPI_MAX = Number(process.env.SONDE_SERPAPI_MAX || 0);

const MODELE_OPENAI = process.env.SONDE_MODELE_OPENAI || "gpt-5.6";
const MODELE_PERPLEXITY = process.env.SONDE_MODELE_PERPLEXITY || "sonar";
/* Perplexity a deplace son point d'entree : ce n'est plus
   `/chat/completions` mais `/v1/sonar`. Rendu configurable pour ne pas avoir a
   toucher au code au prochain deplacement. */
const URL_PERPLEXITY = process.env.SONDE_URL_PERPLEXITY || "https://api.perplexity.ai/v1/sonar";

const CLE_OPENAI = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
const CLE_PERPLEXITY = process.env.PERPLEXITY_API_KEY || "";
const CLE_SERPAPI = process.env.SERPAPI_API_KEY || "";

/* Connexion ouverte a la demande. `neon()` leve des l'import si l'URL est
   absente, ce qui faisait echouer le script sur une trace de pile avant meme
   d'avoir pu dire quelle variable manquait. */
let _sql = null;
const sql = (...args) => (_sql ??= neon(process.env.DATABASE_URL))(...args);

/* ═══ choix des questions ═══════════════════════════════════════════════
   Elles ne sont pas inventees : elles sortent du corpus deja qualifie du
   depot (15 112 lignes), en ne gardant que les PIVOTS transactionnels — la
   requete de tete de chaque univers, celle qu'un acheteur tape vraiment.

   La selection est deterministe : meme tri, meme nombre, donc meme liste
   demain qu'aujourd'hui. C'est la condition pour que deux jours soient
   comparables. Changer `SONDE_PAR_LANGUE` casse la serie — a ne faire qu'en
   connaissance de cause. */

function choisirQuestions() {
  const brut = fs.readFileSync(CORPUS, "utf8").replace(/^﻿/, "");
  const lignes = brut.split(/\r?\n/).filter(Boolean);
  const colonnes = lignes[0].split(",");
  const idx = (nom) => colonnes.indexOf(nom);

  const toutes = lignes.slice(1).map((l) => {
    /* Decoupage simple : le corpus ne contient ni guillemets ni virgules dans
       les valeurs — verifie a l'ecriture. Un vrai analyseur CSV serait du luxe
       ici et une dependance de plus. */
    const c = l.split(",");
    return {
      langue: c[idx("langue")],
      requete: c[idx("requete")],
      rang: c[idx("rang")],
      intention: c[idx("intention")],
      entite: c[idx("entite")],
    };
  });

  const retenues = [];
  for (const langue of LANGUES) {
    const dansLaLangue = toutes.filter(
      (q) => q.langue === langue && q.intention === "transactionnel"
    );
    const explicatives = toutes.filter(
      (q) => q.langue === langue && q.intention === "informationnel"
    );

    /* L'univers phare d'abord, avec ses variantes : c'est la ou se fera le
       chiffre, donc la ou une perte de citation coute le plus cher. */
    const duPhare = dansLaLangue
      .filter((q) => q.entite === PHARE && (q.rang === "pivot" || q.rang === "variante"))
      .slice(0, PHARE_PAR_LANGUE);

    /* Puis la tete des autres univers. Ordre du fichier, pas ordre
       alphabetique : un tri par nom ferait remonter « aquaman », « black
       panther », « deadpool »… et l'echantillon perdrait toute logique
       editoriale. L'ordre d'ecriture porte une intention ; on la garde, et
       elle reste deterministe. */
    /* Les questions explicatives : ce qu'on pose vraiment a un assistant. */
    const reste = Math.max(0, PAR_LANGUE - duPhare.length);
    const nbExplicatives = Math.min(explicatives.length, Math.round(reste * PART_EXPLICATIVE));
    const questions = explicatives.slice(0, nbExplicatives);

    const autres = dansLaLangue
      .filter((q) => q.entite !== PHARE && q.rang === "pivot")
      .slice(0, reste - questions.length);

    retenues.push(...duPhare, ...questions, ...autres);
  }
  return retenues;
}

/**
 * Sous-ensemble mesure sur Google AI Overviews, quand le budget SerpAPI est
 * serre — et il l'est : 250 recherches par mois, partagees avec le moteur de
 * contenu.
 *
 * Alterne les langues plutot que de prendre les premieres venues, et garde
 * l'ordre du corpus a l'interieur de chaque langue : avec trois appels on
 * mesure donc l'univers phare en francais, le meme en anglais, puis le second
 * univers francais. Deterministe, comme le reste.
 */
function questionsSerpapi() {
  const parLangue = new Map();
  for (const q of choisirQuestions()) {
    if (!parLangue.has(q.langue)) parLangue.set(q.langue, []);
    parLangue.get(q.langue).push(q);
  }
  const files = [...parLangue.values()];
  const retenues = [];
  for (let i = 0; retenues.length < SERPAPI_MAX; i++) {
    const avant = retenues.length;
    for (const file of files) {
      if (retenues.length >= SERPAPI_MAX) break;
      if (file[i]) retenues.push(file[i]);
    }
    if (retenues.length === avant) break; // plus rien a prendre
  }
  return retenues;
}

/* ═══ lecture des citations ═════════════════════════════════════════════ */

/** Nom de domaine d'une URL, sans `www.`, ou null si l'URL est illisible. */
function domaine(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Reduit une liste d'URL citees a ce qui nous interesse : sommes-nous dedans,
 * a quelle place, et qui d'autre est la.
 *
 * La position compte a partir de 1 dans l'ordre de citation. C'est une mesure
 * grossiere — un assistant ne « classe » pas vraiment — mais elle capte
 * l'essentiel : etre nomme en premier n'est pas etre nomme en huitieme.
 */
/** Notre domaine, ou l'un de ses sous-domaines — et rien d'autre.
    Un simple `endsWith` comptait `notcartoonova.com` comme une citation. */
function estNous(d) {
  return d === NOTRE_DOMAINE || d.endsWith(`.${NOTRE_DOMAINE}`);
}

function analyser(urls) {
  const vus = [];
  for (const u of urls) {
    const d = domaine(u);
    if (d && !vus.some((v) => v.domaine === d)) vus.push({ domaine: d, url: u });
  }
  const rang = vus.findIndex((v) => estNous(v.domaine));
  return {
    cite: rang >= 0,
    position: rang >= 0 ? rang + 1 : null,
    url_citee: rang >= 0 ? vus[rang].url : null,
    concurrents: vus.filter((v) => !estNous(v.domaine)).map((v) => v.domaine),
  };
}

/* ═══ surfaces ══════════════════════════════════════════════════════════ */

/**
 * OpenAI, outil `web_search`. Les citations arrivent dans les `annotations`
 * du message, typees `url_citation` — c'est de la structure, pas du texte a
 * deviner.
 *
 * Reserve a connaitre : ce n'est PAS ChatGPT le produit, qui a sa propre
 * couche de recuperation. C'est l'approximation la plus proche accessible par
 * API, et il faut la lire comme telle.
 */
async function surfaceOpenAI(question) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${CLE_OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELE_OPENAI,
      tools: [{ type: "web_search" }],
      input: question,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status} ${(await r.text()).slice(0, 160)}`);
  const data = await r.json();

  const urls = [];
  let texte = "";
  for (const item of data.output ?? []) {
    for (const bloc of item.content ?? []) {
      if (typeof bloc.text === "string") texte += bloc.text;
      for (const a of bloc.annotations ?? []) {
        if (a.type === "url_citation" && a.url) urls.push(a.url);
      }
    }
  }
  return { urls, texte };
}

/**
 * Perplexity : la surface la plus lisible des trois. La reponse porte deux
 * champs de sources — `citations`, un simple tableau d'URL dans l'ordre, et
 * `search_results`, plus detaille. On lit le premier, on retombe sur le second.
 */
async function surfacePerplexity(question) {
  const r = await fetch(URL_PERPLEXITY, {
    method: "POST",
    headers: { Authorization: `Bearer ${CLE_PERPLEXITY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELE_PERPLEXITY,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!r.ok) throw new Error(`Perplexity ${r.status} ${(await r.text()).slice(0, 160)}`);
  const data = await r.json();
  const urls = data.citations ?? (data.search_results ?? []).map((s) => s.url).filter(Boolean);
  return { urls, texte: data.choices?.[0]?.message?.content ?? "" };
}

/**
 * Google AI Overviews via SerpAPI. La seule facon realiste de voir cette
 * surface, qui n'a aucune API publique.
 *
 * L'apercu n'est pas toujours present — Google ne le declenche pas sur toutes
 * les requetes. Absence d'apercu et absence de citation sont deux choses
 * differentes : la premiere renvoie `null` et n'est pas enregistree, pour ne
 * pas polluer la serie avec des zeros qui n'en sont pas.
 */
async function surfaceSerpapi(question, langue) {
  const p = new URLSearchParams({
    engine: "google",
    q: question,
    api_key: CLE_SERPAPI,
    hl: langue,
    gl: langue === "fr" ? "fr" : "us",
  });
  const r = await fetch(`https://serpapi.com/search.json?${p}`);
  if (!r.ok) throw new Error(`SerpAPI ${r.status} ${(await r.text()).slice(0, 160)}`);
  const data = await r.json();

  const apercu = data.ai_overview;
  if (!apercu) return null; // pas d'apercu genere : rien a mesurer
  const urls = (apercu.references ?? []).map((ref) => ref.link).filter(Boolean);
  const texte = (apercu.text_blocks ?? [])
    .map((b) => b.snippet ?? "")
    .join(" ")
    .trim();
  return { urls, texte };
}

/* ═══ stockage ══════════════════════════════════════════════════════════ */

async function preparerTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS citations_llm (
      id           BIGSERIAL PRIMARY KEY,
      jour         DATE        NOT NULL,
      surface      TEXT        NOT NULL,
      langue       TEXT        NOT NULL,
      requete      TEXT        NOT NULL,
      entite       TEXT,
      cite         BOOLEAN     NOT NULL,
      position     INTEGER,
      url_citee    TEXT,
      concurrents  JSONB,
      extrait      TEXT,
      releve_le    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  /* Une seule mesure par question, par surface et par jour : relancer le
     workflow ne cree pas de doublon, il corrige la ligne du jour. */
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS citations_llm_unique
    ON citations_llm (jour, surface, requete)
  `;
}

async function enregistrer(ligne) {
  await sql`
    INSERT INTO citations_llm (jour, surface, langue, requete, entite, cite, position, url_citee, concurrents, extrait)
    VALUES (
      ${ligne.jour}, ${ligne.surface}, ${ligne.langue}, ${ligne.requete}, ${ligne.entite},
      ${ligne.cite}, ${ligne.position}, ${ligne.url_citee},
      ${JSON.stringify(ligne.concurrents)}::jsonb, ${ligne.extrait}
    )
    ON CONFLICT (jour, surface, requete) DO UPDATE SET
      cite = EXCLUDED.cite, position = EXCLUDED.position, url_citee = EXCLUDED.url_citee,
      concurrents = EXCLUDED.concurrents, extrait = EXCLUDED.extrait, releve_le = NOW()
  `;
}

/* ═══ comparaison et alerte ═════════════════════════════════════════════ */

/**
 * Compare au dernier releve ANTERIEUR, pas a « hier » : un passage manque ne
 * doit pas transformer une serie stable en fausse alerte.
 */
async function comparer(jour) {
  const [precedent] = await sql`
    SELECT max(jour) AS jour FROM citations_llm WHERE jour < ${jour}
  `;
  if (!precedent?.jour) return null;

  const lignes = await sql`
    SELECT a.surface, a.requete, a.cite AS avant, b.cite AS apres
    FROM citations_llm a
    JOIN citations_llm b ON b.surface = a.surface AND b.requete = a.requete AND b.jour = ${jour}
    WHERE a.jour = ${precedent.jour} AND a.cite <> b.cite
  `;
  return {
    depuis: precedent.jour,
    gagnees: lignes.filter((l) => l.apres),
    perdues: lignes.filter((l) => !l.apres),
  };
}

async function alerterDiscord(resume, delta) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const champs = Object.entries(resume).map(([surface, r]) => ({
    name: surface,
    value: `${r.cites}/${r.total} citées${r.erreurs ? ` · ${r.erreurs} erreur(s)` : ""}`,
    inline: true,
  }));

  if (delta?.perdues.length) {
    champs.push({
      name: `❌ Citations perdues depuis le ${delta.depuis}`,
      value: delta.perdues.map((l) => `${l.surface} — ${l.requete}`).slice(0, 8).join("\n"),
      inline: false,
    });
  }
  if (delta?.gagnees.length) {
    champs.push({
      name: `✅ Citations gagnées depuis le ${delta.depuis}`,
      value: delta.gagnees.map((l) => `${l.surface} — ${l.requete}`).slice(0, 8).join("\n"),
      inline: false,
    });
  }

  const alerte = Boolean(delta?.perdues.length);
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: alerte ? "🛰️ Sonde de citation — CITATIONS PERDUES" : "🛰️ Sonde de citation",
          color: alerte ? 15158332 : 3447003,
          fields: champs,
          footer: { text: "Cartoonova • visibilité dans les assistants" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch((e) => console.error("[sonde] alerte Discord impossible:", e));
}

/* ═══ passage ═══════════════════════════════════════════════════════════ */

/** Surfaces actives, deduites des cles presentes. */
function surfacesActives() {
  const surfaces = [];
  if (CLE_OPENAI) surfaces.push({ nom: "openai", appel: (q) => surfaceOpenAI(q.requete) });
  if (CLE_PERPLEXITY) surfaces.push({ nom: "perplexity", appel: (q) => surfacePerplexity(q.requete) });
  if (CLE_SERPAPI && SERPAPI_MAX > 0) {
    /* Le budget se depense sur un ECHANTILLON reparti, pas sur les premieres
       questions venues. Consomme dans l'ordre, trois appels seraient partis sur
       trois requetes francaises et n'auraient jamais rien dit de l'anglais.
       `questionsSerpapi` alterne les langues — voir sa definition. */
    const eligibles = new Set(questionsSerpapi().map((q) => q.requete));
    surfaces.push({
      nom: "ai_overview",
      appel: (q) => (eligibles.has(q.requete) ? surfaceSerpapi(q.requete, q.langue) : Promise.resolve(null)),
    });
  }

  return surfaces;
}

async function main() {
  const jour = new Date().toISOString().slice(0, 10);
  const questions = choisirQuestions();
  const surfaces = surfacesActives();

  console.log(`[sonde] ${jour} — ${questions.length} questions × ${surfaces.length} surface(s)`);

  const resume = {};
  for (const surface of surfaces) {
    resume[surface.nom] = { total: 0, cites: 0, erreurs: 0 };

    /* En serie, volontairement. Le parallelisme ferait gagner quelques minutes
       sur un travail de nuit, au prix de limites de debit et de resultats
       moins reproductibles. */
    for (const q of questions) {
      try {
        const reponse = await surface.appel(q);
        if (!reponse) continue; // surface silencieuse pour cette question

        const a = analyser(reponse.urls);
        resume[surface.nom].total++;
        if (a.cite) resume[surface.nom].cites++;

        await enregistrer({
          jour,
          surface: surface.nom,
          langue: q.langue,
          requete: q.requete,
          entite: q.entite,
          ...a,
          extrait: a.cite ? (reponse.texte || "").slice(0, 900) : null,
        });

        console.log(`  ${a.cite ? "✓" : "·"} [${surface.nom}] ${q.requete}${a.cite ? ` (position ${a.position})` : ""}`);
      } catch (erreur) {
        resume[surface.nom].erreurs++;
        console.error(`  ! [${surface.nom}] ${q.requete} — ${erreur.message}`);
      }
    }
  }

  const delta = await comparer(jour);
  await alerterDiscord(resume, delta);

  console.log("\n[sonde] " + Object.entries(resume)
    .map(([s, r]) => `${s} ${r.cites}/${r.total}`)
    .join(" · "));
  if (delta) {
    console.log(`[sonde] depuis le ${delta.depuis} : +${delta.gagnees.length} / -${delta.perdues.length}`);
  }
}

/* La configuration se verifie avant d'ouvrir la base : une cle oubliee doit
   donner un message qui la nomme, pas une erreur de connexion. */
if (!process.env.DATABASE_URL) {
  console.error("[sonde] DATABASE_URL manquante.");
  process.exit(1);
}
if (!surfacesActives().length) {
  console.error("[sonde] aucune surface active : renseignez au moins OPENAI_API_KEY.");
  process.exit(1);
}

await preparerTable();
await main();
