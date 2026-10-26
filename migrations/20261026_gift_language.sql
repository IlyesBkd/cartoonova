-- Apply before deploying FLOW-04. No guessed locale backfill for historical rewards.
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS gift_lang text;
