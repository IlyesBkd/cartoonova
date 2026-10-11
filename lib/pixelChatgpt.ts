/**
 * Pixel de mesure ChatGPT Ads (`oaiq`).
 *
 * ── Quand il tourne ──────────────────────────────────────────────────────
 *
 * Sur toutes les pages, avec le pixel du compte Ads Manager Cartoonova
 * (identifiant public, visible dans le code de toute page qui le charge ;
 * `NEXT_PUBLIC_OPENAI_PIXEL_ID` le remplace si besoin), sans bandeau de
 * consentement : choix du proprietaire le 11 octobre 2026, en connaissance
 * du risque (la CNIL exige un accord avant tout cookie publicitaire, et le
 * pixel pose `__oppref`). Pour le soumettre a un accord plus tard, il suffit
 * de n'appeler `chargerPixelChatgpt` qu'apres l'« Accepter » du bandeau
 * (`components/BandeauConsentement.tsx`).
 *
 * ── File d'attente ───────────────────────────────────────────────────────
 *
 * La page de succes declenche `order_created` dans son propre effet, qui
 * passe avant celui du fournisseur (React execute les effets des enfants
 * d'abord). Les mesures attendent donc ici que le SDK soit initialise.
 *
 * ── Format ───────────────────────────────────────────────────────────────
 *
 * Montants en centimes (`amount: 2599` = 25,99), `event_id` dans le dernier
 * argument : c'est la cle qui dedoublonne avec une future Conversions API
 * cote serveur. On y met l'identifiant de la commande.
 */

export const PIXEL_CHATGPT_ID = process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID || "CF7ccMxDL9Zr9yqjGSsRpb";
const ACTIF = Boolean(PIXEL_CHATGPT_ID);
const SCRIPT = "https://bzrcdn.openai.com/sdk/oaiq.min.js";

type Oaiq = ((...args: unknown[]) => void) & { q?: unknown[][] };
declare global {
  interface Window {
    oaiq?: Oaiq;
  }
}

/** Evenements standard : seuls ceux-ci servent a l'optimisation (oCPC). */
export type EvenementPixel = "page_viewed" | "contents_viewed" | "checkout_started" | "order_created";

let charge = false;
const enAttente: unknown[][] = [];

function appeler(args: unknown[]): void {
  window.oaiq?.(...args);
}

/** Charge le SDK, l'initialise et vide la file. Sans effet si deja fait. */
export function chargerPixelChatgpt(): void {
  if (!ACTIF || charge || typeof window === "undefined") return;
  charge = true;
  if (!window.oaiq) {
    const q: Oaiq = (...args: unknown[]) => {
      q.q!.push(args);
    };
    q.q = [];
    window.oaiq = q;
    const js = document.createElement("script");
    js.async = true;
    js.src = SCRIPT;
    document.head.appendChild(js);
  }
  /* Journal du SDK dans la console avec ?oaiq_debug=1 dans l URL, pour
     verifier les envois sans encombrer la console de chaque visiteur. */
  const debug = new URLSearchParams(window.location.search).has("oaiq_debug");
  appeler(["init", { pixelId: PIXEL_CHATGPT_ID, debug }]);
  while (enAttente.length) appeler(enAttente.shift()!);
}

export function mesurerPixelChatgpt(
  evenement: EvenementPixel,
  donnees: Record<string, unknown>,
  eventId?: string,
): void {
  if (!ACTIF || typeof window === "undefined") return;
  const args: unknown[] = ["measure", evenement, donnees];
  if (eventId) args.push({ event_id: eventId });
  if (charge) appeler(args);
  else enAttente.push(args);
}

/** Montant en centimes, comme l'attend le pixel. */
export function enCentimes(montant: number): number {
  return Math.round(montant * 100);
}
