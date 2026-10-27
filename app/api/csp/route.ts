import { NextResponse } from "next/server";
import { alerteDiscord, COULEUR_ATTENTION } from "@/lib/discord";

/* Reception des rapports de la politique de securite du contenu (CSP).

   La CSP de next.config.ts est bloquante. Les rapports signalent les
   violations observées ; ils restent des données client non fiables et ne
   prouvent pas à eux seuls qu'un parcours métier complet fonctionne.

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
    const chemin = new URL(page).pathname;
    const route = chemin.match(/^\/(?:[a-z]{2}\/)?(suivi|depot|bonus|bon|confirm-poster|extras|telecharger|download)(?:\/|$)/);
    if (route) return `/${route[1]}/[prive]`;
    return /^\/(?:[a-z]{2}\/?)?$/.test(chemin) ? chemin : "[page]";
  } catch {
    return page ? "?" : "";
  }
}

/* Reports are untrusted client input, including directive and source-file.
   Keep actionable resource categories, never arbitrary URL/path/text values. */
function ressourceCsp(valeur: string): string {
  if (!valeur) return "";
  if (["inline", "eval", "wasm-eval", "self"].includes(valeur)) return valeur;
  try {
    const protocole = new URL(valeur).protocol;
    if (["https:", "http:", "data:", "blob:"].includes(protocole)) return protocole;
  } catch { /* not a URL */ }
  return "[ressource]";
}

function directiveCsp(valeur: string): string {
  return /^(?:default|script|style|img|font|connect|media|object|frame|child|worker|manifest|prefetch)-src(?:-elem|-attr)?$|^(?:base-uri|form-action|frame-ancestors|upgrade-insecure-requests|trusted-types|require-trusted-types-for)$/.test(valeur) ? valeur : "[directive]";
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
    const directive = directiveCsp(v.directive);
    const bloque = ressourceCsp(v.bloque);
    const source = ressourceCsp(v.source);
    console.warn("[csp]", directive, bloque, cheminPropre(v.page), source);
    const lignes = [`${directive} ← ${bloque || "(inline)"}`, `   page : ${cheminPropre(v.page) || "?"}`];
    if (source) lignes.push(`   script : ${source}`);
    recents.add(lignes.join("\n"));
  }

  if (recents.size > 0 && Date.now() - derniereAlerte > 3600_000) {
    derniereAlerte = Date.now();
    const resume = [...recents].slice(0, 8).join("\n");
    recents.clear();
    await alerteDiscord({
      titre: "CSP : violations signalées",
      couleur: COULEUR_ATTENTION,
      champs: [{ name: "Directive ← origine, page, script", value: resume.slice(0, 1000) }],
      piedDePage: "Politique bloquante — disposition rapportée par le navigateur",
    });
  }

  return new NextResponse(null, { status: 204 });
}
