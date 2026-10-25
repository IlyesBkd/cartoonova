-- FLOW-03: the token is the shared immutable invitation version.
-- Apply before deploying; no production application is performed by tests.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS poster_confirmation_message_id TEXT;
-- A legacy email's image cannot be reconstructed from today's mutable order.
-- Close its link; a new invitation is required. Preserve recorded responses
-- and attachments for admin history. Re-running preserves versioned links.
UPDATE orders SET poster_confirmation_token = NULL
WHERE poster_confirmation_token IS NOT NULL
  AND (poster_confirmation_image_url IS NULL OR poster_confirmation_email IS NULL);
