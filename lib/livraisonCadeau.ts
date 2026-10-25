import type { OrderOptions } from "./db";

export class LivraisonCadeauInvalide extends Error {}

/** Validate legacy persisted values too: never silently deliver a malformed gift. */
export function validerLivraisonCadeau(options: Pick<OrderOptions, "gift"> | null): void {
  const gift = options?.gift;
  if (!gift) return;
  const email = gift.recipientEmail;
  if (email != null && (typeof email !== "string" ||
      (email.trim() && (email.length > 254 || !/^[^\s@<>,;:"\\]+@[^\s@<>,;:"\\]+\.[^\s@<>,;:"\\]+$/.test(email.trim()))))) {
    throw new LivraisonCadeauInvalide("Email destinataire cadeau invalide.");
  }
  const date = gift.deliverAfter;
  if (date != null && date !== "") {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new LivraisonCadeauInvalide("Date cadeau invalide.");
    }
  }
  if (gift.message != null && typeof gift.message !== "string") {
    throw new LivraisonCadeauInvalide("Message cadeau invalide.");
  }
}

/** Stored order options may be JSON text on older read paths. */
export function optionsLivraisonCadeau(raw: unknown): OrderOptions | null {
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as OrderOptions; }
    catch { throw new LivraisonCadeauInvalide("Options cadeau invalides."); }
  }
  return (raw ?? null) as OrderOptions | null;
}

export function echapperMessageCadeau(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
