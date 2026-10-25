import { createHash } from "node:crypto";

// This capability scopes photos only. It NEVER authorizes a PaymentIntent,
// payment, order read, or post-payment action. No PII or raw value is stored.
export const CHECKOUT_PHOTO_COOKIE = "__Host-cartoonova-photo";
export function checkoutPhotoSession(req: Request): string | null {
  const matches = (req.headers?.get("cookie") ?? "").split(";")
    .map(part => part.trim()).filter(part => part.startsWith(`${CHECKOUT_PHOTO_COOKIE}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(CHECKOUT_PHOTO_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function checkoutPhotoSubject(session: string): string {
  return `checkout:${createHash("sha256").update(session).digest("hex")}`;
}
