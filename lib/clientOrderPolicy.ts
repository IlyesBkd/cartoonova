import type { DbOrder } from "./db";

/** Authorization follows persisted business milestones, not editable admin labels.
 * paid_at is the payment receipt. The preview invitation ends the reference-photo
 * phase; delivery/dispatch end preview editing. See tests/ten-cards-client-report.md.
 */
export type ClientOrderState = Pick<DbOrder,
  "paid_at" | "poster_confirmation_sent_at" | "final_image_sent_at" | "expedie_le"
> & Partial<Pick<DbOrder, "poster_confirmation_token" | "final_image_url" |
  "poster_confirmation_image_url" | "poster_confirmation_email" | "customer_email">>;

export function canRespondToPreview(order: ClientOrderState | null | undefined): boolean {
  return Boolean(order?.paid_at && order.poster_confirmation_sent_at &&
    order.poster_confirmation_token && order.final_image_url &&
    order.poster_confirmation_image_url === order.final_image_url &&
    order.poster_confirmation_email === order.customer_email &&
    !order.final_image_sent_at && !order.expedie_le);
}

/** Existing lifecycle uses GREATEST(final_image_sent_at, expedie_le) for reviews.
 * There is no carrier-delivered milestone: dispatch is the physical proxy. */
export function canReviewOrder(order: ClientOrderState | null | undefined): boolean {
  return Boolean(order?.paid_at && (order.final_image_sent_at || order.expedie_le));
}

export function canDepositPhotos(order: ClientOrderState | null | undefined): boolean {
  return Boolean(order?.paid_at && !order.poster_confirmation_sent_at &&
    !order.final_image_sent_at && !order.expedie_le);
}
