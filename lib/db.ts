import { neon } from "@neondatabase/serverless";
import type { Prices, PriceSet, PricesByCurrency } from "./types";
import { DEFAULT_PRICES, DEFAULT_PRICES_BY_CURRENCY } from "./types";
import type { Currency } from "./currency";
import { convertPrice } from "./currency";

// ─── SQL Connection ──────────────────────────────────────────────────
export const sql = neon(process.env.DATABASE_URL!);

// ─── Orders ──────────────────────────────────────────────────────────
export interface OrderOptions {
  format: string;
  people: number;
  animals: number;
  background: string;
  printOption: string;
  style?: string;
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
  detected_country: string | null;
  final_image_url: string | null;
  final_image_sent_at: string | null;
  poster_confirmation_token: string | null;
  poster_confirmation_sent_at: string | null;
  poster_confirmation_status: "confirmed" | "changes_requested" | null;
  poster_confirmation_responded_at: string | null;
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

export async function updateOrderFinalImage(orderId: string, finalImageUrl: string): Promise<void> {
  await sql`
    UPDATE orders SET final_image_url = ${finalImageUrl} WHERE id = ${orderId}::uuid
  `;
}

export async function markFinalImageSent(orderId: string): Promise<void> {
  await sql`
    UPDATE orders SET final_image_sent_at = NOW() WHERE id = ${orderId}::uuid
  `;
}

// ─── Poster confirmation ─────────────────────────────────────────────

let posterConfirmationSchemaReady: Promise<void> | null = null;

async function ensurePosterConfirmationSchema(): Promise<void> {
  if (posterConfirmationSchemaReady) return posterConfirmationSchemaReady;
  posterConfirmationSchemaReady = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_token TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_sent_at TIMESTAMPTZ`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_status TEXT`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_responded_at TIMESTAMPTZ`;
  })().catch((e) => {
    posterConfirmationSchemaReady = null;
    throw e;
  });
  return posterConfirmationSchemaReady;
}

export async function setPosterConfirmationToken(orderId: string, token: string): Promise<void> {
  await ensurePosterConfirmationSchema();
  await sql`
    UPDATE orders
    SET poster_confirmation_token = ${token},
        poster_confirmation_sent_at = NOW(),
        poster_confirmation_status = NULL,
        poster_confirmation_responded_at = NULL
    WHERE id = ${orderId}::uuid
  `;
}

export async function getOrderByConfirmationToken(token: string): Promise<DbOrder | null> {
  await ensurePosterConfirmationSchema();
  const rows = await sql`
    SELECT * FROM orders WHERE poster_confirmation_token = ${token}
  `;
  return (rows[0] as unknown as DbOrder) || null;
}

export async function recordPosterConfirmationResponse(
  token: string,
  status: "confirmed" | "changes_requested"
): Promise<DbOrder | null> {
  await ensurePosterConfirmationSchema();
  const rows = await sql`
    UPDATE orders
    SET poster_confirmation_status = ${status},
        poster_confirmation_responded_at = NOW()
    WHERE poster_confirmation_token = ${token}
    RETURNING *
  `;
  return (rows[0] as unknown as DbOrder) || null;
}

// ─── Prices ──────────────────────────────────────────────────────────

let pricesSchemaReady: Promise<void> | null = null;

async function ensurePricesSchema(): Promise<void> {
  if (pricesSchemaReady) return pricesSchemaReady;
  pricesSchemaReady = (async () => {
    await sql`ALTER TABLE prices ADD COLUMN IF NOT EXISTS data JSONB`;
    const rows = await sql`SELECT data, base, fullbody_extra, extra_person, extra_animal, digital, canvas, poster, poster_simple FROM prices WHERE id = 'singleton'`;
    if (!rows.length) return;
    const r = rows[0] as Record<string, unknown>;
    if (r.data) return;
    const eur: PriceSet = {
      base: Number(r.base),
      fullbodyExtra: Number(r.fullbody_extra),
      extraPerson: Number(r.extra_person),
      extraAnimal: Number(r.extra_animal),
      digital: Number(r.digital),
      canvas: Number(r.canvas),
      poster: Number(r.poster),
      posterSimple: Number(r.poster_simple),
    };
    const scale = (rate: number): PriceSet =>
      Object.fromEntries(
        Object.entries(eur).map(([k, v]) => [k, k === "digital" ? v : Math.ceil((v as number) * rate)])
      ) as unknown as PriceSet;
    const seeded: PricesByCurrency = {
      EUR: eur,
      USD: scale(1.08),
      GBP: scale(0.86),
      CAD: scale(1.48),
      AUD: scale(1.66),
    };
    await sql`UPDATE prices SET data = ${JSON.stringify(seeded)}::jsonb WHERE id = 'singleton'`;
  })().catch((e) => {
    pricesSchemaReady = null;
    throw e;
  });
  return pricesSchemaReady;
}

export async function getPrices(): Promise<Prices> {
  return getPricesForCurrency("EUR");
}

export async function getPricesForCurrency(currency: Currency): Promise<PriceSet> {
  await ensurePricesSchema();
  const rows = await sql`SELECT data FROM prices WHERE id = 'singleton'`;
  if (!rows.length || !rows[0].data) {
    const eur = DEFAULT_PRICES_BY_CURRENCY.EUR;
    return currency === "EUR" ? eur : DEFAULT_PRICES_BY_CURRENCY[currency];
  }
  const data = rows[0].data as PricesByCurrency;
  const set = data[currency];
  if (set) return set;
  const eur = data.EUR;
  return Object.fromEntries(
    Object.entries(eur).map(([k, v]) => [k, k === "digital" ? v : convertPrice(v as number, currency)])
  ) as unknown as PriceSet;
}

export async function getAllPrices(): Promise<PricesByCurrency> {
  await ensurePricesSchema();
  const rows = await sql`SELECT data FROM prices WHERE id = 'singleton'`;
  if (!rows.length || !rows[0].data) return DEFAULT_PRICES_BY_CURRENCY;
  return rows[0].data as PricesByCurrency;
}

export async function updateAllPrices(data: PricesByCurrency): Promise<void> {
  await ensurePricesSchema();
  await sql`UPDATE prices SET data = ${JSON.stringify(data)}::jsonb WHERE id = 'singleton'`;
}
