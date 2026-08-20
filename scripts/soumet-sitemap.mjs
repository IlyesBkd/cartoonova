/**
 * Soumet le sitemap a Search Console.
 *
 *   node scripts/soumet-sitemap.mjs [url-du-sitemap]
 *
 * A relancer apres un deploiement qui change la structure d'URL : c'est le
 * signal le plus direct pour demander une reexploration. Google ne garantit
 * aucun delai, mais un sitemap resoumis passe devant un sitemap decouvert.
 *
 * Demande la portee `webmasters` en ecriture, la ou gsc-baseline se contente
 * de `webmasters.readonly` — d'ou la permission « Complet » sur la propriete.
 */

import crypto from "node:crypto";
import fs from "node:fs";

const PORTEE = "https://www.googleapis.com/auth/webmasters";
const SITEMAP = process.argv[2] ?? "https://www.cartoonova.com/sitemap.xml";

function chargerEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const ligne of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!ligne || ligne.startsWith("#")) continue;
    const i = ligne.indexOf("=");
    if (i === -1) continue;
    const cle = ligne.slice(0, i).trim();
    if (!process.env[cle]) process.env[cle] = ligne.slice(i + 1).replace(/^"|"$/g, "");
  }
}

chargerEnv();

const EMAIL = process.env.GSC_CLIENT_EMAIL;
const SITE = process.env.GSC_SITE_URL;
const CLE_B64 = process.env.GSC_PRIVATE_KEY_B64;

if (!EMAIL || !SITE || !CLE_B64) {
  console.error("Identifiants absents. Lancez d'abord : node scripts/gsc-setup.mjs");
  process.exit(1);
}

const clePrivee = Buffer.from(CLE_B64, "base64").toString("utf8");
const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

const now = Math.floor(Date.now() / 1000);
const entete = b64url({ alg: "RS256", typ: "JWT" });
const charge = b64url({
  iss: EMAIL,
  scope: PORTEE,
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
});
const signature = crypto
  .sign("RSA-SHA256", Buffer.from(`${entete}.${charge}`), clePrivee)
  .toString("base64url");

const reponseJeton = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${entete}.${charge}.${signature}`,
  }),
});
const jeton = await reponseJeton.json();
if (!reponseJeton.ok) {
  console.error(`Authentification refusee : ${jeton.error_description ?? jeton.error}`);
  process.exit(1);
}

const cible = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps/${encodeURIComponent(SITEMAP)}`;

const soumission = await fetch(cible, {
  method: "PUT",
  headers: { authorization: `Bearer ${jeton.access_token}` },
});

if (!soumission.ok) {
  const e = await soumission.json().catch(() => ({}));
  console.error(`Soumission refusee : ${soumission.status} — ${e.error?.message ?? "erreur inconnue"}`);
  if (soumission.status === 403) {
    console.error("La permission « Complet » est requise sur la propriete ; « Restreint » ne suffit pas.");
  }
  process.exit(1);
}

console.log(`✓ ${SITEMAP} soumis pour ${SITE}`);

/* Etat vu par Google. Vide juste apres la soumission : le traitement prend
   quelques heures, et c'est normal. */
const etat = await fetch(cible, { headers: { authorization: `Bearer ${jeton.access_token}` } });
if (etat.ok) {
  const s = await etat.json();
  console.log(`  dernier telechargement : ${s.lastDownloaded ?? "pas encore"}`);
  console.log(`  URL relevees           : ${s.contents?.[0]?.submitted ?? "en attente de traitement"}`);
  console.log(`  avertissements/erreurs : ${s.warnings ?? 0} / ${s.errors ?? 0}`);
}
