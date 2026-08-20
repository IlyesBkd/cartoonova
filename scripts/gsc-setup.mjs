/**
 * Installe les identifiants Search Console dans .env.local, puis verifie
 * qu'ils fonctionnent reellement contre l'API Google.
 *
 *   node scripts/gsc-setup.mjs [chemin/vers/la/cle.json]
 *
 * Par defaut la cle est lue dans ~/.gcp/cartoonova-gsc.json. Elle ne doit
 * jamais se trouver dans le depot : `public/` est servi publiquement par Next,
 * et tout le reste finit tot ou tard dans un commit.
 *
 * La cle privee est stockee en base64 plutot qu'avec des `\n` echappes : les
 * antislashs ne survivent pas de maniere fiable au passage par un shell, un
 * fichier .env et l'interface de Vercel. Le base64 traverse les trois intact.
 *
 * Ce script n'affiche jamais de matiere cryptographique — uniquement des
 * longueurs et des booleens.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FICHIER_ENV = ".env.local";
const MARQUEUR = "# Google Search Console";
const PORTEE = "https://www.googleapis.com/auth/webmasters.readonly";
const SITE_PAR_DEFAUT = "sc-domain:cartoonova.com";

const cheminCle =
  process.argv[2] ?? path.join(os.homedir(), ".gcp", "cartoonova-gsc.json");

/* ─── 1. lecture de la cle ─────────────────────────────────────────────── */

if (!fs.existsSync(cheminCle)) {
  console.error(`Cle introuvable : ${cheminCle}`);
  console.error("Telechargez le JSON du compte de service et deposez-le la.");
  process.exit(1);
}

const cle = JSON.parse(fs.readFileSync(cheminCle, "utf8"));

if (cle.type !== "service_account") {
  console.error(`Ce fichier n'est pas une cle de compte de service (type: ${cle.type}).`);
  process.exit(1);
}

console.log("compte de service :", cle.client_email);
console.log("projet            :", cle.project_id);
console.log("empreinte de cle  :", String(cle.private_key_id).slice(0, 8) + "…");

/* ─── 2. ecriture dans .env.local ──────────────────────────────────────── */

const privateKeyB64 = Buffer.from(cle.private_key, "utf8").toString("base64");

// Verification de l'aller-retour avant d'ecrire quoi que ce soit.
const relu = Buffer.from(privateKeyB64, "base64").toString("utf8");
if (relu !== cle.private_key) {
  console.error("L'encodage base64 ne se decode pas a l'identique — abandon.");
  process.exit(1);
}
console.log("encodage base64   : aller-retour verifie");

let env = fs.existsSync(FICHIER_ENV) ? fs.readFileSync(FICHIER_ENV, "utf8") : "";

// Retire un bloc GSC precedent, quel qu'ait ete son etat.
const debut = env.indexOf(MARQUEUR);
if (debut !== -1) {
  env = env.slice(0, debut).replace(/\s+$/, "") + "\n";
  console.log("bloc GSC precedent: retire");
}
env = env
  .split(/\r?\n/)
  .filter((ligne) => !ligne.startsWith("GSC_"))
  .join("\n")
  .replace(/\s+$/, "");

const siteUrl = process.env.GSC_SITE_URL ?? SITE_PAR_DEFAUT;

env +=
  "\n\n" + MARQUEUR + " — compte de service.\n" +
  "# La cle privee est en base64 : la decoder avec\n" +
  "#   Buffer.from(process.env.GSC_PRIVATE_KEY_B64, 'base64').toString('utf8')\n" +
  `GSC_CLIENT_EMAIL=${cle.client_email}\n` +
  `GSC_PRIVATE_KEY_B64=${privateKeyB64}\n` +
  `GSC_SITE_URL=${siteUrl}\n`;

fs.writeFileSync(FICHIER_ENV, env);
console.log(`${FICHIER_ENV}       : GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY_B64, GSC_SITE_URL ecrits`);

/* ─── 3. verification contre l'API ─────────────────────────────────────── */

const b64url = (valeur) =>
  Buffer.from(typeof valeur === "string" ? valeur : JSON.stringify(valeur)).toString("base64url");

const maintenant = Math.floor(Date.now() / 1000);
const entete = b64url({ alg: "RS256", typ: "JWT" });
const charge = b64url({
  iss: cle.client_email,
  scope: PORTEE,
  aud: "https://oauth2.googleapis.com/token",
  iat: maintenant,
  exp: maintenant + 3600,
});
const signature = crypto
  .sign("RSA-SHA256", Buffer.from(`${entete}.${charge}`), cle.private_key)
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
  console.error(`\n✗ Authentification refusee : ${jeton.error} — ${jeton.error_description}`);
  if (String(jeton.error_description).includes("invalid_grant")) {
    console.error("  Cle revoquee ou horloge systeme desynchronisee.");
  }
  process.exit(1);
}

console.log("\n✓ authentification acceptee par Google");

const reponseSites = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
  headers: { authorization: `Bearer ${jeton.access_token}` },
});
const donnees = await reponseSites.json();

if (!reponseSites.ok) {
  console.error(`✗ API Search Console : ${reponseSites.status} — ${donnees.error?.message}`);
  if (reponseSites.status === 403) {
    console.error("  L'API n'est probablement pas activee dans le projet Cloud.");
  }
  process.exit(1);
}

const proprietes = donnees.siteEntry ?? [];
console.log(`✓ API Search Console joignable — ${proprietes.length} propriete(s) accessible(s)`);
for (const p of proprietes) {
  console.log(`   ${p.siteUrl}  [${p.permissionLevel}]`);
}

if (proprietes.length === 0) {
  console.log(
    "\n→ Le compte de service n'est autorise sur aucune propriete.\n" +
      "  Search Console › Parametres › Utilisateurs et autorisations › Ajouter un utilisateur\n" +
      `  puis coller : ${cle.client_email}`
  );
} else if (!proprietes.some((p) => p.siteUrl === siteUrl)) {
  console.log(`\n→ GSC_SITE_URL vaut « ${siteUrl} », absent de la liste ci-dessus.`);
  console.log("  Corrigez la valeur dans .env.local avec l'un des identifiants listes.");
}
