import { neon } from "@neondatabase/serverless";
import type { Prices } from "./types";
import { DEFAULT_PRICES } from "./types";

// ─── SQL tagged template ─────────────────────────────────────────────
const sql = neon(process.env.DATABASE_URL!);

// ─── Auto-create tables ──────────────────────────────────────────────
let _initialized = false;

export async function ensureTables() {
  if (_initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_email VARCHAR(255) NOT NULL,
      customer_name VARCHAR(255),
      customer_address TEXT,
      customer_city VARCHAR(255),
      customer_postal VARCHAR(50),
      customer_country VARCHAR(100),
      customer_phone VARCHAR(50),
      total_price DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'EUR',
      options JSONB DEFAULT '{}',
      status VARCHAR(50) DEFAULT 'new',
      photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
      stripe_payment_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS prices (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'singleton',
      base DECIMAL(10,2) DEFAULT 49,
      fullbody_extra DECIMAL(10,2) DEFAULT 20,
      extra_person DECIMAL(10,2) DEFAULT 15,
      extra_animal DECIMAL(10,2) DEFAULT 15,
      digital DECIMAL(10,2) DEFAULT 0,
      canvas DECIMAL(10,2) DEFAULT 89,
      poster DECIMAL(10,2) DEFAULT 79,
      poster_simple DECIMAL(10,2) DEFAULT 19
    )
  `;
  await sql`
    INSERT INTO prices (id) VALUES ('singleton')
    ON CONFLICT (id) DO NOTHING
  `;
  _initialized = true;
}

// ─── Orders ──────────────────────────────────────────────────────────
export interface DbOrder {
  id: string;
  customer_email: string;
  customer_name: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_postal: string | null;
  customer_country: string | null;
  customer_phone: string | null;
  total_price: number;
  currency: string;
  options: Record<string, unknown>;
  status: string;
  photo_urls: string[];
  stripe_payment_id: string | null;
  created_at: string;
}

export async function getOrders(): Promise<DbOrder[]> {
  await ensureTables();
  const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
  return rows as unknown as DbOrder[];
}

export async function insertOrder(data: {
  customerEmail: string;
  customerName?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerPostal?: string | null;
  customerCountry?: string | null;
  customerPhone?: string | null;
  totalPrice: number;
  currency?: string;
  options: Record<string, unknown>;
  photoUrls: string[];
  stripePaymentId?: string | null;
}): Promise<DbOrder> {
  await ensureTables();
  const opts = JSON.stringify(data.options);
  const cur = data.currency || "EUR";
  const name = data.customerName || null;
  const addr = data.customerAddress || null;
  const city = data.customerCity || null;
  const postal = data.customerPostal || null;
  const country = data.customerCountry || null;
  const phone = data.customerPhone || null;
  const stripe = data.stripePaymentId || null;
  const rows = await sql`
    INSERT INTO orders (
      customer_email, customer_name, customer_address, customer_city,
      customer_postal, customer_country, customer_phone,
      total_price, currency, options, photo_urls, stripe_payment_id
    ) VALUES (
      ${data.customerEmail}, ${name}, ${addr}, ${city},
      ${postal}, ${country}, ${phone},
      ${data.totalPrice}, ${cur}, ${opts}::jsonb, ${data.photoUrls}, ${stripe}
    ) RETURNING *
  `;
  return rows[0] as unknown as DbOrder;
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  await ensureTables();
  await sql`UPDATE orders SET status = ${status} WHERE id = ${id}::uuid`;
}

// ─── Prices ──────────────────────────────────────────────────────────
export async function getPrices(): Promise<Prices> {
  await ensureTables();
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
  await ensureTables();
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
