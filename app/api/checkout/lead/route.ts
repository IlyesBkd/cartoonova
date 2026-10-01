import { NextRequest, NextResponse } from "next/server";
import { locales } from "@/i18n/config";
import { currencies } from "@/lib/currency";
import { PRINT_KEYS } from "@/lib/pricing";
import { enregistrerLead } from "@/lib/leadsCaisse";
import { cleDepuisRequete, enregistrerEchec, verifierLimite } from "@/lib/rateLimit";

/**
 * Passage a la caisse : l'e-mail est saisi, le paiement n'a pas encore eu lieu.
 *
 * Appele sans attendre la reponse depuis l'etape 1 de la modale de paiement.
 * Repond 204 dans tous les cas acceptes — doublon compris — pour ne rien
 * reveler de ce qui est deja en base ; 400 si l'entree est inexploitable.
 * La relance elle-meme part du cron (app/api/cron/lifecycle-emails).
 */

export const dynamic = "force-dynamic";

// Meme filtre permissif que la newsletter : la vraie validation, c'est l'envoi.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Un style est un segment d'URL du site : il finit dans le lien de la relance.
const STYLE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function vide(status: 204 | 400 | 429) {
  return new NextResponse(null, { status });
}

export async function POST(req: NextRequest) {
  /* La route est publique et ecrit en base : sans plafond, n'importe qui
     pourrait y verser des adresses de tiers pour leur faire envoyer des
     relances. Chaque enregistrement compte comme une « tentative » dans le
     compteur en memoire : huit par dix minutes et par IP, largement assez
     pour un vrai visiteur. */
  const cle = `lead:${cleDepuisRequete(req)}`;
  if (verifierLimite(cle).bloque) return vide(429);

  let body: Record<string, unknown>;
  try {
    const brut = (await req.json()) as unknown;
    if (!brut || typeof brut !== "object") return vide(400);
    body = brut as Record<string, unknown>;
  } catch {
    return vide(400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return vide(400);

  const locale = typeof body.locale === "string" ? body.locale : "";
  if (!(locales as readonly string[]).includes(locale)) return vide(400);

  // Facultatifs : un champ absent n'empeche pas la relance, un champ mal forme si.
  const style = body.style === undefined || body.style === null ? null : body.style;
  if (style !== null && (typeof style !== "string" || style.length > 80 || !STYLE_RE.test(style))) {
    return vide(400);
  }

  const printKey = body.printKey === undefined || body.printKey === null ? null : body.printKey;
  if (printKey !== null && !(PRINT_KEYS as readonly unknown[]).includes(printKey)) return vide(400);

  const total = body.total === undefined || body.total === null ? null : Number(body.total);
  if (total !== null && (!Number.isFinite(total) || total < 0 || total > 100_000)) return vide(400);

  const currency = body.currency === undefined || body.currency === null ? null : body.currency;
  if (currency !== null && !(currencies as readonly unknown[]).includes(currency)) return vide(400);

  try {
    const cree = await enregistrerLead({
      email,
      locale,
      style: style as string | null,
      printKey: printKey as string | null,
      total: total === null ? null : Math.round(total * 100) / 100,
      currency: currency as string | null,
    });
    if (cree) enregistrerEchec(cle);
  } catch (error: unknown) {
    /* Un lead perdu ne coute qu'une relance : on journalise et on repond
       comme si de rien n'etait, l'appelant n'attend de toute facon rien. */
    console.error(
      "[POST /api/checkout/lead] enregistrement impossible:",
      error instanceof Error ? error.message : error
    );
  }

  return vide(204);
}
