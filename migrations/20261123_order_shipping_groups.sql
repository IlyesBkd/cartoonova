-- Additive only. No historical backfill, no provider call, no new runtime DDL.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_details JSONB;
CREATE TABLE IF NOT EXISTS order_shipping_effects (
  supplier_ref TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  details JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending','sent','uncertain')),
  email_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN orders.shipping_details IS 'Supplier shipment group and all tracking links; no parcel/product attribution.';
