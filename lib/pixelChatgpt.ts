/** ChatGPT browser advertising attribution is disabled, including after consent.
 * No verified vendor shutdown API exists. Keep compatible no-op exports so
 * callers cannot load a script, initialize a global, queue or send data.
 * Re-enabling requires a verified withdrawal mechanism and transport tests.
 */

// Kept for compatibility with server-side conversions (outside browser scope).
export const PIXEL_CHATGPT_ID = process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID || "CF7ccMxDL9Zr9yqjGSsRpb";

export type EvenementPixel = "page_viewed" | "contents_viewed" | "checkout_started" | "order_created";

export function chargerPixelChatgpt(): void {}

export function mesurerPixelChatgpt(
  _evenement: EvenementPixel,
  _donnees: Record<string, unknown>,
  _eventId?: string,
): void {
  // Do not retain payloads or touch a browser/vendor global.
  void _evenement;
  void _donnees;
  void _eventId;
}

/** Montant en centimes, conserve pour les appelants existants. */
export function enCentimes(montant: number): number {
  return Math.round(montant * 100);
}
