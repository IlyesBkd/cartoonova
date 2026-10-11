/**
 * API de conversions ChatGPT Ads : la vente envoyee de serveur a serveur.
 *
 * Le pixel (`lib/pixelChatgpt.ts`) ne voit l'achat que si le navigateur
 * affiche la page de succes, sans bloqueur de publicite. Cet envoi part au
 * moment ou la commande passe en payee (webhook Stripe ou page de succes,
 * le premier des deux), et il porte l'identifiant du clic (`oppref`) garde
 * avec la commande : la vente reste attribuee meme quand le pixel n'a rien vu.
 *
 * Dedoublonnage : `id` = identifiant de la commande, la meme valeur que
 * l'`event_id` du pixel. OpenAI ne compte qu'une fois un couple (pixel,
 * evenement, id).
 *
 * Inactif sans `OPENAI_CONVERSIONS_API_KEY` (cle secrete, Vercel seulement).
 * Ne leve jamais : une conversion perdue ne doit pas bloquer la confirmation
 * de commande.
 *
 * Documentation : https://developers.openai.com/ads/conversions-api
 */
import { createHash } from "node:crypto";
import type { DbOrder } from "@/lib/db";
import { PIXEL_CHATGPT_ID, enCentimes } from "@/lib/pixelChatgpt";
import { SITE_URL } from "@/lib/site";

const CLE = process.env.OPENAI_CONVERSIONS_API_KEY || "";
const ENDPOINT = "https://bzr.openai.com/v1/events";

function safeJson(texte: string): DbOrder["origine"] {
  try {
    return JSON.parse(texte);
  } catch {
    return null;
  }
}

function sha256(valeur: string): string {
  return createHash("sha256").update(valeur, "utf8").digest("hex");
}

/** L'evenement `order_created` d'une commande, au format de l'API. */
export function evenementCommande(order: DbOrder, maintenant = Date.now()) {
  /* Selon le pilote, la colonne JSONB revient parfois en texte (double
     encodage, voir lib/db.ts) : on accepte les deux formes. */
  const origine = typeof order.origine === "string" ? safeJson(order.origine) : order.origine;
  const pub = origine?.pub;
  const oppref = pub?.plateforme === "chatgpt" ? pub.clic : undefined;
  const pays = order.detected_country ? [order.detected_country.toUpperCase()] : undefined;
  return {
    id: order.id,
    type: "order_created",
    timestamp_ms: maintenant,
    ...(oppref ? { oppref } : {}),
    source_url: `${SITE_URL}/success`,
    action_source: "web",
    opt_out: false,
    user: {
      // Adresse normalisee comme l'exige l'API : sans espaces autour, en minuscules.
      emails_sha256: [sha256(order.customer_email.trim().toLowerCase())],
      ...(pays ? { countries: pays } : {}),
    },
    data: {
      type: "contents",
      amount: enCentimes(Number(order.total_price)),
      currency: order.currency,
      contents: [{ id: "portrait", name: "Portrait cartoon personnalisé", content_type: "product", quantity: 1 }],
    },
  };
}

/** Envoie la vente. `validateOnly` : verifie le format sans rien enregistrer. */
export async function envoyerConversionChatgpt(
  order: DbOrder,
  { validateOnly = false }: { validateOnly?: boolean } = {},
): Promise<{ ok: boolean; statut?: number; corps?: string }> {
  if (!CLE) return { ok: false, corps: "OPENAI_CONVERSIONS_API_KEY absente" };
  try {
    const r = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(PIXEL_CHATGPT_ID)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ validate_only: validateOnly, events: [evenementCommande(order)] }),
      signal: AbortSignal.timeout(8000),
    });
    const corps = await r.text();
    if (!r.ok) console.error(`[conversions chatgpt] ${order.id} refusée (${r.status}):`, corps.slice(0, 300));
    return { ok: r.ok, statut: r.status, corps: corps.slice(0, 300) };
  } catch (erreur) {
    console.error(`[conversions chatgpt] ${order.id} non envoyée:`, erreur);
    return { ok: false, corps: String(erreur) };
  }
}
