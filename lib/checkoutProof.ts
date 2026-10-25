import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

const PROOF_MAX_AGE = 7 * 24 * 60 * 60;

export function newCheckoutProof() {
  const token = randomBytes(32).toString("hex");
  return {
    token, hash: createHash("sha256").update(token).digest("hex"),
    expiresAt: String(Math.floor(Date.now() / 1000) + PROOF_MAX_AGE),
  };
}

export function setCheckoutProofCookie(response: NextResponse, paymentIntentId: string, token: string) {
  const name = checkoutProofCookieName(paymentIntentId);
  if (!name) throw new Error("Invalid checkout payment identifier");
  // Lax allows top-level GET returns from bank/PayPal/3DS; never expose in URL/JS.
  response.cookies.set(name, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: PROOF_MAX_AGE,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

type CheckoutPayment = { id: string; object: string; metadata: Record<string, string> | null };
export type CheckoutPaymentType = "portrait_order" | "bon_cadeau";

export function checkoutProofCookieName(paymentIntentId: string): string | null {
  return /^pi_[A-Za-z0-9_]{1,200}$/.test(paymentIntentId)
    ? `__Host-cartoonova-checkout-${paymentIntentId}` : null;
}

export function checkoutProofFromRequest(req: Pick<Request, "headers">, paymentIntentId: string): string | null {
  const name = checkoutProofCookieName(paymentIntentId);
  if (!name) return null;
  const values = (req.headers?.get("cookie") ?? "").split(";")
    .map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (values.length !== 1) return null;
  return values[0].slice(name.length + 1);
}

/** A PaymentIntent ID, email, client secret or photo capability is not proof.
 * The random browser capability is separate; only its digest lives on Stripe. */
export function verifyCheckoutProof(payment: CheckoutPayment, proof: unknown, expectedType?: CheckoutPaymentType): boolean {
  if (payment.object !== "payment_intent" || !checkoutProofCookieName(payment.id)) return false;
  const type = payment.metadata?.type;
  if ((type !== "portrait_order" && type !== "bon_cadeau") || (expectedType && type !== expectedType)) return false;
  const hash = payment.metadata?.checkout_proof_hash;
  const expiresAt = Number(payment.metadata?.checkout_proof_expires_at);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
  if (typeof proof !== "string" || !/^[a-f0-9]{64}$/.test(proof) || !hash || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(hash, "hex"), createHash("sha256").update(proof).digest());
}
