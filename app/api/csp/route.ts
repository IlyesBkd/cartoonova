import { NextResponse } from "next/server";
import { alerteDiscord, COULEUR_ATTENTION } from "@/lib/discord";

/* Reception des rapports de la politique de securite du contenu (CSP).

   La CSP est publiee en Report-Only (next.config.ts) : elle ne bloque rien,
   elle signale ce qu'elle aurait bloque. Le but est de verifier pendant une a
   deux semaines qu'aucune ressource legitime (Stripe, Google Ads, PostHog…)
   n'est oubliee avant de la rendre bloquante.

   Deux formats arrivent selon le navigateur : l'ancien `report-uri`
   (`{"csp-report": {...}}`) et la Reporting API (`[{type, body}]`). */

export const dynamic = "force-dynamic";

interface Violation {
  directive: string;
  bloque: string;
  page: string;
  /** Script fautif et ligne, quand le navigateur les donne. */
  source: string;
}

function normaliser(brut: unknown): Violation[] {
  const liste = Array.isArray(brut) ? brut : [brut];
  const sortie: Violation[] = [];
  for (const entree of liste) {
    if (!entree || typeof entree !== "object") continue;
    const e = entree as Record<string, unknown>;
    const r = (e["csp-report"] ?? e.body ?? e) as Record<string, unknown>;
    const directive = String(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"] ?? "");
    const bloque = String(r["blocked-uri"] ?? r.blockedURL ?? "");
    const page = String(r["document-uri"] ?? r.documentURL ?? "");
    const fichier = String(r["source-file"] ?? r.sourceFile ?? "");
    const ligne = r["line-number"] ?? r.lineNumber;
    const source = fichier ? `${fichier}${ligne ? `:${ligne}` : ""}` : "";
    if (directive) sortie.push({ directive, bloque, page, source });
  }
  return sortie;
}

const EXTENSION = /^(chrome|moz|safari|ms-browser)-extension:/;

/* Les extensions du navigateur injectent leurs propres scripts : ce bruit ne
   dit rien du site et noierait les vrais oublis. */
function estDuBruit(v: Violation): boolean {
  return EXTENSION.test(v.bloque) || EXTENSION.test(v.source) || v.bloque === "about";
}

/* Chemin de la page sans sa requete, et sans le jeton des pages apres-vente :
   un rapport ne doit pas faire sortir un lien d'acces a une commande. */
function cheminPropre(page: string): string {
  try {
    return new URL(page).pathname.replace(/\/(suivi|depot|bonus|bon|confirm-poster)\/[^/]+/, "/$1/<jeton>");
  } catch {
    return page ? "?" : "";
  }
}

/* Une alerte Discord par heure et par instance au plus : une page mal
   configuree enverrait sinon un rapport a chaque visite. Les rapports restent
   tous dans les journaux Vercel. */
let derniereAlerte = 0;
const recents = new Set<string>();

export async function POST(req: Request) {
  let corps: unknown;
  try {
    corps = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const violations = normaliser(corps).filter((v) => !estDuBruit(v));
  for (const v of violations) {
    console.warn("[csp]", v.directive, v.bloque, cheminPropre(v.page), v.source);
    /* Page et script fautif : sans eux, une alerte ne disait pas ou chercher
       (rapport « wasm-eval » du 3 octobre 2026, introuvable). */
    const lignes = [`${v.directive} ← ${v.bloque || "(inline)"}`, `   page : ${cheminPropre(v.page) || "?"}`];
    if (v.source) lignes.push(`   script : ${v.source.slice(0, 150)}`);
    recents.add(lignes.join("\n"));
  }

  if (recents.size > 0 && Date.now() - derniereAlerte > 3600_000) {
    derniereAlerte = Date.now();
    const resume = [...recents].slice(0, 8).join("\n");
    recents.clear();
    await alerteDiscord({
      titre: "CSP : ressources qui seraient bloquees",
      couleur: COULEUR_ATTENTION,
      champs: [{ name: "Directive ← origine, page, script", value: resume.slice(0, 1000) }],
      piedDePage: "Report-Only — rien n'est bloque pour l'instant",
    });
  }

  return new NextResponse(null, { status: 204 });
}
