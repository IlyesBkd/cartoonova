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
  addressLine2?: string;
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
  poster_confirmation_note: string | null;
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
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_note TEXT`;
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
        poster_confirmation_responded_at = NULL,
        poster_confirmation_note = NULL
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
  status: "confirmed" | "changes_requested",
  note?: string | null
): Promise<DbOrder | null> {
  await ensurePosterConfirmationSchema();
  const rows = await sql`
    UPDATE orders
    SET poster_confirmation_status = ${status},
        poster_confirmation_responded_at = NOW(),
        poster_confirmation_note = ${note || null}
    WHERE poster_confirmation_token = ${token}
    RETURNING *
  `;
  return (rows[0] as unknown as DbOrder) || null;
}

// ─── Support inbox (IMAP sync) ────────────────────────────────────────

export type SupportMessageCategory = "customer" | "notification" | "spam";

export interface SupportMessage {
  id: number;
  message_id: string;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  order_id: string | null;
  read_at: string | null;
  created_at: string;
  category: SupportMessageCategory | null;
}

let supportInboxSchemaReady: Promise<void> | null = null;

async function ensureSupportInboxSchema(): Promise<void> {
  if (supportInboxSchemaReady) return supportInboxSchemaReady;
  supportInboxSchemaReady = (async () => {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_outbound_message_id TEXT`;
    await sql`
      CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        message_id TEXT UNIQUE NOT NULL,
        from_email TEXT NOT NULL,
        subject TEXT,
        body_text TEXT,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        order_id UUID REFERENCES orders(id),
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS category TEXT`;
    await sql`
      CREATE TABLE IF NOT EXISTS imap_sync_state (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        last_uid INTEGER NOT NULL DEFAULT 0,
        last_synced_at TIMESTAMPTZ
      )
    `;
    await sql`INSERT INTO imap_sync_state (id, last_uid) VALUES ('singleton', 0) ON CONFLICT (id) DO NOTHING`;
  })().catch((e) => {
    supportInboxSchemaReady = null;
    throw e;
  });
  return supportInboxSchemaReady;
}

export async function setOrderLastOutboundMessageId(orderId: string, messageId: string): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`UPDATE orders SET last_outbound_message_id = ${messageId} WHERE id = ${orderId}::uuid`;
}

export async function findOrderByOutboundMessageId(messageId: string): Promise<{ id: string } | null> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT id FROM orders WHERE last_outbound_message_id = ${messageId} LIMIT 1`;
  return (rows[0] as { id: string }) || null;
}

export async function findOrderByCustomerEmail(email: string): Promise<{ id: string } | null> {
  const rows = await sql`
    SELECT id FROM orders WHERE lower(customer_email) = lower(${email}) ORDER BY created_at DESC LIMIT 1
  `;
  return (rows[0] as { id: string }) || null;
}

export async function getImapSyncState(): Promise<{ lastUid: number }> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT last_uid FROM imap_sync_state WHERE id = 'singleton'`;
  return { lastUid: Number(rows[0]?.last_uid ?? 0) };
}

export async function setImapSyncState(lastUid: number): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`
    UPDATE imap_sync_state SET last_uid = ${lastUid}, last_synced_at = NOW() WHERE id = 'singleton'
  `;
}

export async function insertSupportMessage(msg: {
  messageId: string;
  fromEmail: string;
  subject: string | null;
  bodyText: string | null;
  receivedAt: Date;
  orderId: string | null;
  category: SupportMessageCategory | null;
}): Promise<{ isNew: boolean }> {
  await ensureSupportInboxSchema();
  const rows = await sql`
    INSERT INTO support_messages (message_id, from_email, subject, body_text, received_at, order_id, category)
    VALUES (
      ${msg.messageId}, ${msg.fromEmail}, ${msg.subject}, ${msg.bodyText}, ${msg.receivedAt.toISOString()},
      ${msg.orderId ? msg.orderId : null}::uuid, ${msg.category}
    )
    ON CONFLICT (message_id) DO NOTHING
    RETURNING id
  `;
  return { isNew: rows.length > 0 };
}

export async function getSupportMessages(): Promise<SupportMessage[]> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT * FROM support_messages ORDER BY received_at DESC LIMIT 200`;
  return rows as unknown as SupportMessage[];
}

export async function markSupportMessageRead(id: number): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`UPDATE support_messages SET read_at = NOW() WHERE id = ${id}`;
}

export async function getUnclassifiedSupportMessages(limit: number): Promise<SupportMessage[]> {
  await ensureSupportInboxSchema();
  const rows = await sql`
    SELECT * FROM support_messages WHERE category IS NULL ORDER BY received_at DESC LIMIT ${limit}
  `;
  return rows as unknown as SupportMessage[];
}

export async function countUnclassifiedSupportMessages(): Promise<number> {
  await ensureSupportInboxSchema();
  const rows = await sql`SELECT COUNT(*)::int AS c FROM support_messages WHERE category IS NULL`;
  return Number(rows[0]?.c ?? 0);
}

export async function setSupportMessageCategory(id: number, category: SupportMessageCategory): Promise<void> {
  await ensureSupportInboxSchema();
  await sql`UPDATE support_messages SET category = ${category} WHERE id = ${id}`;
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
