import { runtimeSchemaBootstrapEnabled, sql } from "./db";
import type { Currency } from "./currency";

export type PromoKind = "percent" | "amount";

export interface PromoCode {
  code: string;
  kind: PromoKind;
  value: number;
  /** Obligatoire pour un montant fixe, ignore pour un pourcentage. */
  currency: Currency | null;
  min_subtotal: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string;
  /** Bon cadeau : ce qu'il reste a utiliser. null pour un code promo classique. */
  solde: number | null;
  /** Bon cadeau : le paiement qui l'a achete. */
  achat_payment_intent?: string | null;
  acheteur_email?: string | null;
  /** Code de parrainage : l'adresse du client qui le partage (en minuscules). */
  parrain_email?: string | null;
  /** Code de parrainage : la langue du parrain, pour l'e-mail de recompense. */
  parrain_lang?: string | null;
}

export type PromoRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "min_subtotal"
  | "currency_mismatch";

export type PromoResult =
  | { ok: true; code: string; discount: number }
  | { ok: false; reason: PromoRejection };

// Un paiement doit rester au-dessus du minimum accepte par Stripe.
const MIN_PAYABLE = 1;

let promoSchemaReady: Promise<void> | null = null;

/** Exportee pour lib/parrainage.ts, qui ecrit dans la meme table. */
export async function ensurePromoSchema(): Promise<void> {
  if (!runtimeSchemaBootstrapEnabled) return;
  if (promoSchemaReady) return promoSchemaReady;
  promoSchemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS promo_codes (
        code TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        value NUMERIC NOT NULL,
        currency TEXT,
        min_subtotal NUMERIC NOT NULL DEFAULT 0,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // Bons cadeaux : voir migrations/2026-10-bons-cadeaux.sql (meme DDL).
    await sql`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS solde NUMERIC`;
    await sql`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS achat_payment_intent TEXT UNIQUE`;
    await sql`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS acheteur_email TEXT`;
    // Parrainage : voir migrations/2026-10-relances.sql (meme DDL).
    await sql`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS parrain_email TEXT`;
    await sql`ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS parrain_lang TEXT`;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_parrain_email_idx
      ON promo_codes (lower(parrain_email)) WHERE parrain_email IS NOT NULL
    `;
  })().catch((e) => {
    promoSchemaReady = null;
    throw e;
  });
  return promoSchemaReady;
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 40);
}

export async function getPromoCode(code: string): Promise<PromoCode | null> {
  await ensurePromoSchema();
  const rows = await sql`SELECT * FROM promo_codes WHERE code = ${normalizeCode(code)}`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...(row as unknown as PromoCode),
    value: Number(row.value),
    min_subtotal: Number(row.min_subtotal),
    used_count: Number(row.used_count),
    solde: row.solde === null || row.solde === undefined ? null : Number(row.solde),
  };
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  await ensurePromoSchema();
  const rows = await sql`SELECT * FROM promo_codes ORDER BY created_at DESC`;
  return (rows as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as PromoCode),
    value: Number(row.value),
    min_subtotal: Number(row.min_subtotal),
    used_count: Number(row.used_count),
    solde: row.solde === null || row.solde === undefined ? null : Number(row.solde),
  }));
}

/**
 * Calcule la remise applicable. Ne modifie rien : l'increment du compteur
 * d'utilisation se fait a l'enregistrement de la commande, pas ici, sinon une
 * simple saisie de code consommerait une utilisation.
 *
 * Codes de parrainage (AMI-…) : valides ici comme n'importe quel code a 20 %.
 * Le parrain qui saisit son propre code n'est PAS refuse a ce stade — l'adresse
 * de l'acheteur n'est pas connue au moment de la saisie. La garde est a la
 * recompense (lib/parrainage.ts) : pas de bon quand l'acheteur est le parrain.
 */
export async function validatePromoCode(
  rawCode: string,
  subtotal: number,
  currency: Currency
): Promise<PromoResult> {
  const promo = await getPromoCode(rawCode);
  if (!promo) return { ok: false, reason: "not_found" };
  if (!promo.active) return { ok: false, reason: "inactive" };

  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
    return { ok: false, reason: "not_started" };
  }
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) {
    return { ok: false, reason: "expired" };
  }
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    return { ok: false, reason: "exhausted" };
  }
  if (subtotal < promo.min_subtotal) {
    return { ok: false, reason: "min_subtotal" };
  }
  if (promo.kind === "amount" && promo.currency && promo.currency !== currency) {
    return { ok: false, reason: "currency_mismatch" };
  }

  /* Bon cadeau : la remise vaut ce qu'il reste sur le bon, pas sa valeur
     d'origine. Un bon vide est epuise. */
  if (promo.solde !== null && promo.solde <= 0) {
    return { ok: false, reason: "exhausted" };
  }
  const raw =
    promo.kind === "percent"
      ? (subtotal * promo.value) / 100
      : promo.solde !== null
        ? promo.solde
        : promo.value;
  const capped = Math.min(raw, Math.max(subtotal - MIN_PAYABLE, 0));
  const discount = Math.round(capped * 100) / 100;

  if (discount <= 0) return { ok: false, reason: "min_subtotal" };

  return { ok: true, code: promo.code, discount };
}

/** Increment atomique, borne par max_uses : deux commandes simultanees ne peuvent pas depasser le quota. */
export async function consumePromoCode(code: string): Promise<void> {
  await ensurePromoSchema();
  await sql`
    UPDATE promo_codes
    SET used_count = used_count + 1
    WHERE code = ${normalizeCode(code)}
      AND (max_uses IS NULL OR used_count < max_uses)
  `;
}

/**
 * Debite un bon cadeau apres paiement. Atomique et borne : deux commandes
 * simultanees ne peuvent pas faire passer le solde sous zero. Sans effet sur
 * un code promo classique (`solde` null).
 *
 * Appele depuis `finaliserCommande`, qui ne s'execute qu'une fois par
 * commande : le debit ne peut donc pas etre compte deux fois.
 */
export async function debiterBonCadeau(code: string, montant: number): Promise<void> {
  if (!(montant > 0)) return;
  await ensurePromoSchema();
  await sql`
    UPDATE promo_codes
    SET solde = GREATEST(solde - ${montant}, 0)
    WHERE code = ${normalizeCode(code)} AND solde IS NOT NULL
  `;
}

export async function createPromoCode(input: {
  code: string;
  kind: PromoKind;
  value: number;
  currency?: Currency | null;
  minSubtotal?: number;
  maxUses?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<void> {
  await ensurePromoSchema();
  await sql`
    INSERT INTO promo_codes (code, kind, value, currency, min_subtotal, max_uses, starts_at, ends_at)
    VALUES (
      ${normalizeCode(input.code)},
      ${input.kind},
      ${input.value},
      ${input.kind === "amount" ? input.currency ?? null : null},
      ${input.minSubtotal ?? 0},
      ${input.maxUses ?? null},
      ${input.startsAt ?? null},
      ${input.endsAt ?? null}
    )
    ON CONFLICT (code) DO UPDATE SET
      kind = EXCLUDED.kind,
      value = EXCLUDED.value,
      currency = EXCLUDED.currency,
      min_subtotal = EXCLUDED.min_subtotal,
      max_uses = EXCLUDED.max_uses,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      active = TRUE
  `;
}

export async function setPromoActive(code: string, active: boolean): Promise<void> {
  await ensurePromoSchema();
  await sql`UPDATE promo_codes SET active = ${active} WHERE code = ${normalizeCode(code)}`;
}
