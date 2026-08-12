import { createHmac, timingSafeEqual } from "crypto";

// Les liens de desinscription sont signes : sans signature, n'importe qui
// pourrait desabonner n'importe quelle adresse en devinant l'URL.
function secret(): string {
  const value = process.env.NEWSLETTER_SECRET || process.env.CRON_SECRET;
  if (!value) throw new Error("NEWSLETTER_SECRET (ou CRON_SECRET) manquant");
  return value;
}

export function signEmail(email: string): string {
  return createHmac("sha256", secret())
    .update(email.trim().toLowerCase())
    .digest("hex");
}

export function verifyEmailToken(email: string, token: string): boolean {
  try {
    const expected = Buffer.from(signEmail(email));
    const received = Buffer.from(token);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
