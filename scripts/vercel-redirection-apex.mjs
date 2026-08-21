/**
 * Usage : node scripts/vercel-redirection-apex.mjs [code]   (308 par defaut)
 * Passe la redirection de l'apex en permanente.
 *
 * Sans `redirectStatusCode`, Vercel emet un 307 : un temporaire, qui demande
 * explicitement a Google de garder l'ancienne URL dans l'index. C'est pour ca
 * que cartoonova.com et www.cartoonova.com vivent aujourd'hui comme deux
 * sites — l'apex portant 21 des 26 clics du releve du 2026-08-17.
 *
 * Reversible : il suffit de rejouer ce script avec 307.
 */
import fs from "node:fs";

const JETON = fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .find((l) => l.startsWith("VERCEL_TOKEN="))
  ?.slice("VERCEL_TOKEN=".length).replace(/^"|"$/g, "");

const PROJET = "cartoonova";
const APEX = "cartoonova.com";
const CIBLE = "www.cartoonova.com";
const CODE = Number(process.argv[2] ?? 308);

const api = async (chemin, options = {}) => {
  const r = await fetch(`https://api.vercel.com${chemin}`, {
    ...options,
    headers: {
      authorization: `Bearer ${JETON}`,
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, statut: r.status, corps: j };
};

const avant = await api(`/v9/projects/${PROJET}/domains/${APEX}`);
console.log(`avant : ${APEX} → ${avant.corps?.redirect ?? "—"} [${avant.corps?.redirectStatusCode ?? "aucun, donc 307"}]`);

const patch = await api(`/v9/projects/${PROJET}/domains/${APEX}`, {
  method: "PATCH",
  body: JSON.stringify({ redirect: CIBLE, redirectStatusCode: CODE }),
});

if (!patch.ok) {
  console.error(`\n✗ refuse : ${patch.statut} — ${patch.corps?.error?.message ?? "erreur inconnue"}`);
  process.exit(1);
}

const apres = await api(`/v9/projects/${PROJET}/domains/${APEX}`);
console.log(`apres : ${APEX} → ${apres.corps?.redirect} [${apres.corps?.redirectStatusCode}]`);
