import { neon } from "@neondatabase/serverless";
import type { Prices } from "./types";
import { DEFAULT_PRICES } from "./types";

// ─── SQL Connection ──────────────────────────────────────────────────
export const sql = neon(process.env.DATABASE_URL!);

// ─── Orders ──────────────────────────────────────────────────────────
export interface OrderOptions {
  format: string;
  people: number;
  animals: number;
  background: string;
  printOption: string;
  description?: string;
  phone?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export interface DbOrder {
  id: string;
  payment_intent_id: string;
  customer_email: string;
  customer_name: string | null;
  customer_address: string | null;
  total_price: number;
  currency: string;
  options: OrderOptions;
  photo_urls: string[];
  status: string;
  created_at: string;
}

export async function getOrders(): Promise<DbOrder[]> {
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
  return rows as unknown as DbOrder[];
}

export async function getOrderByPaymentId(paymentIntentId: string): Promise<DbOrder | null> {
  const rows = await sql`
    SELECT * FROM orders WHERE payment_intent_id = ${paymentIntentId}
  `;
  return (rows[0] as unknown as DbOrder) || null;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  await sql`
    UPDATE orders SET status = ${status} WHERE id = ${orderId}::uuid
  `;
}

// ─── Prices ──────────────────────────────────────────────────────────
export async function getPrices(): Promise<Prices> {
  const rows = await sql`SELECT * FROM prices WHERE id = 'singleton'`;
  if (!rows.length) return DEFAULT_PRICES;
  const r = rows[0] as Record<string, unknown>;
  return {
    base: Number(r.base),
    fullbodyExtra: Number(r.fullbody_extra),
    extraPerson: Number(r.extra_person),
    extraAnimal: Number(r.extra_animal),
    digital: Number(r.digital),
    canvas: Number(r.canvas),
    poster: Number(r.poster),
    posterSimple: Number(r.poster_simple),
  };
}

export async function updatePrices(prices: Prices): Promise<void> {
  await sql`
    UPDATE prices SET
      base = ${prices.base},
      fullbody_extra = ${prices.fullbodyExtra},
      extra_person = ${prices.extraPerson},
      extra_animal = ${prices.extraAnimal},
      digital = ${prices.digital},
      canvas = ${prices.canvas},
      poster = ${prices.poster},
      poster_simple = ${prices.posterSimple}
    WHERE id = 'singleton'
  `;
}
