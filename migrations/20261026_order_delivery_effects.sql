-- Additive, apply explicitly before enabling the delivery guard. No runtime DDL.
CREATE TABLE IF NOT EXISTS order_delivery_effects (
  order_id uuid NOT NULL REFERENCES orders(id),
  kind text NOT NULL CHECK (kind IN ('final_image','extras')),
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('preparing','sending','uncertain','sent')),
  artifacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_id,kind,version)
);
-- An unresolved provider result must block *all* newer versions of this effect.
CREATE UNIQUE INDEX IF NOT EXISTS order_delivery_one_unresolved
  ON order_delivery_effects(order_id,kind) WHERE status IN ('sending','uncertain');
