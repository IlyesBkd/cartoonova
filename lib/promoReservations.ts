import { sql } from "./db";
import type { OrderQuote } from "./orderQuote";
import type Stripe from "stripe";

/** Bounded, lazy reaping: expiration alone NEVER releases a payable intent.
 * A successful cancel fences the old client secret at Stripe. Succeeded,
 * processing and unknown outcomes stay reserved until confirmation/recovery.
 * No transaction/row lock is held during provider I/O.
 */
export async function releaseExpiredPromoReservations(rawCode: unknown, stripe: Stripe): Promise<void> {
  if (typeof rawCode !== "string" || !rawCode.trim()) return;
  const code = rawCode.trim().toUpperCase().slice(0, 40);
  const rows = await sql`
    SELECT payment_intent_id FROM promo_reservations
    WHERE code = ${code} AND state = 'reserved' AND expires_at <= now()
    ORDER BY expires_at LIMIT 10
  `;
  for (const row of rows) {
    const id = String(row.payment_intent_id);
    let canceled = false;
    try {
      canceled = (await stripe.paymentIntents.cancel(id)).status === "canceled";
    } catch {
      // Includes an already-canceled PI and cancellation racing confirmation.
      try { canceled = (await stripe.paymentIntents.retrieve(id)).status === "canceled"; }
      catch { /* unknown is not permission to reallocate */ }
    }
    if (canceled) await sql`SELECT release_canceled_promo_reservation(${id})`;
  }
}

/** The intent exists at Stripe but its secret has not been exposed yet. */
export async function reservePromoForCheckout(paymentIntentId: string, quote: OrderQuote): Promise<boolean> {
  if (!quote.promoCode || quote.discount <= 0) return true;
  const [row] = await sql`
    SELECT reserve_checkout_promo(${paymentIntentId}, ${quote.promoCode},
      ${quote.discount}::numeric, ${quote.subtotal}::numeric, ${quote.currency}) AS reserved
  `;
  return row.reserved === true;
}
