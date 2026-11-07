import { timingSafeEqual } from "crypto";
import Stripe from "stripe";
import { sql } from "@/lib/db";

/**
 * Commandes synthetiques : l'achat de bout en bout lance chaque matin depuis
 * le VPS.
 *
 * Une requete portant l'en-tete secret passe par la vraie caisse de
 * production (memes routes, meme base, memes controles), mais son paiement est
 * fait en mode TEST Stripe et sa commande vit sous ses propres statuts. Ils ne
 * valent jamais PENDING ni PAID et `paid_at` reste vide : aucun cron, aucune
 * statistique, aucune notification ne la voit, aucun e-mail ne part. Le
 * controleur la supprime apres l'avoir verifiee.
 */

export const SYNTHETIC_HEADER = "x-synthetic-order";
export const SYNTHETIC_PENDING = "SYNTHETIC_PENDING";
export const SYNTHETIC_PAID = "SYNTHETIC_PAID";

export function isSyntheticStatus(status: string | null | undefined): boolean {
  return status === SYNTHETIC_PENDING || status === SYNTHETIC_PAID;
}

/** Vrai seulement si l'en-tete vaut SYNTHETIC_ORDER_SECRET (comparaison a temps constant). */
export function isSyntheticHeaders(headers: Headers | null | undefined): boolean {
  const expected = process.env.SYNTHETIC_ORDER_SECRET;
  const given = headers?.get?.(SYNTHETIC_HEADER);
  if (!expected || expected.length < 32 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

let testStripe: Stripe | null = null;

/** Client Stripe en mode TEST ; refuse toute autre cle qu'une cle de test. */
export function syntheticStripe(): Stripe {
  const key = process.env.STRIPE_TEST_SECRET_KEY;
  if (!key || !key.startsWith("sk_test_")) {
    throw new Error("STRIPE_TEST_SECRET_KEY absente ou pas une cle de test");
  }
  testStripe ??= new Stripe(key, { apiVersion: "2026-02-25.clover" });
  return testStripe;
}

/** Equivalent synthetique de `payerAvecConfirmation` : statut a part, sans `paid_at` ni e-mail. */
export async function marquerSynthetiquePayee(orderId: string): Promise<boolean> {
  const rows = await sql`
    UPDATE orders SET status = ${SYNTHETIC_PAID}
    WHERE id = ${orderId}::uuid AND status = ${SYNTHETIC_PENDING}
    RETURNING id
  `;
  return rows.length === 1;
}
