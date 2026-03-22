import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { Order, Prices } from "./types";
import { DEFAULT_PRICES } from "./types";

// On Vercel, only /tmp is writable. Locally, use project data/ dir.
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? "/tmp" : join(process.cwd(), "data");
const ORDERS_FILE = join(DATA_DIR, "orders.json");
const PRICES_FILE = join(DATA_DIR, "prices.json");

async function ensureDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

// ─── Orders ──────────────────────────────────────────────────────────
export async function getOrders(): Promise<Order[]> {
  await ensureDir();
  try {
    const raw = await readFile(ORDERS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addOrder(order: Order): Promise<void> {
  const orders = await getOrders();
  orders.unshift(order);
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

export async function updateOrderStatus(id: string, status: Order["status"]): Promise<void> {
  const orders = await getOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    orders[idx].status = status;
    await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
  }
}

// ─── Prices ──────────────────────────────────────────────────────────
export async function getPrices(): Promise<Prices> {
  await ensureDir();
  try {
    const raw = await readFile(PRICES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    await writeFile(PRICES_FILE, JSON.stringify(DEFAULT_PRICES, null, 2));
    return DEFAULT_PRICES;
  }
}

export async function updatePrices(prices: Prices): Promise<void> {
  await ensureDir();
  await writeFile(PRICES_FILE, JSON.stringify(prices, null, 2));
}
