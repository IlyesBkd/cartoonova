import { NextResponse } from "next/server";

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
    const rapport = e["csp-report"] ?? e.body ?? e;
    if (!rapport || typeof rapport !== "object") continue;
    const r = rapport as Record<string, unknown>;
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
    if (/^\/(?:[a-z]{2}\/?)?$/.test(chemin)) return chemin;
    const publique = chemin.match(/^\/(?:[a-z]{2}\/)?(checkout|commander|collections|cadeau|contact|faq|blog|admin|success)(?:\/|$)/);
    return publique ? `/${publique[1]}/[…]` : "[autre page — chemin masqué]";
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
    const url = new URL(valeur);
    // Only fixed integration families leave the server: arbitrary hostnames can
    // themselves contain emails or access tokens. Never retain their subdomains.
    if (["https:", "http:"].includes(url.protocol)) {
      const familles = ["cartoonova.com", "stripe.com", "stripe.network", "google-analytics.com", "googletagmanager.com", "googleadservices.com", "doubleclick.net", "googlesyndication.com", "facebook.com", "facebook.net", "posthog.com", "vercel.com", "vercel.live", "vercel-storage.com", "googleapis.com", "gstatic.com", "data.gouv.fr", "geopf.fr", "komoot.io", "openai.com", "pusher.com"];
      const famille = familles.find(d => url.hostname === d || url.hostname.endsWith(`.${d}`));
      if (famille) return `${url.protocol}//${famille} (service)`;
      if (/^(?:www\.)?google\.(?:com|fr|de|es|it|nl|pl|se|dk|pt|co\.uk|ch|be|at|ie|lu|no|fi|ca|com\.au|co\.nz|com\.br|com\.mx)$/.test(url.hostname)) return `${url.protocol}//${url.hostname}`;
      return `${url.protocol} [domaine externe non reconnu]`;
    }
    if (["data:", "blob:"].includes(url.protocol)) return url.protocol;
  } catch { /* not a URL */ }
  return "[ressource]";
}

function directiveCsp(valeur: string): string {
  return /^(?:default|script|style|img|font|connect|media|object|frame|child|worker|manifest|prefetch)-src(?:-elem|-attr)?$|^(?:base-uri|form-action|frame-ancestors|upgrade-insecure-requests|trusted-types|require-trusted-types-for)$/.test(valeur) ? valeur : "[directive]";
}

export async function POST(req: Request) {
  let corps: unknown;
  try {
    const texte = await req.text();
    if (texte.length > 65536) return new NextResponse(null, { status: 204 });
    corps = JSON.parse(texte);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const violations = normaliser(corps).filter((v) => !estDuBruit(v));
  for (const v of violations) {
    const directive = directiveCsp(v.directive);
    const bloque = ressourceCsp(v.bloque);
    const source = ressourceCsp(v.source);
    console.warn("[csp]", directive, bloque, cheminPropre(v.page), source);
  }

  return new NextResponse(null, { status: 204 });
}
