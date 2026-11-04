-- Private bytes are kept in PostgreSQL, never in public Blob URLs.
-- Apply before enabling any feature that depends on this table.
CREATE TABLE IF NOT EXISTS support_private_attachments (
  id UUID PRIMARY KEY,
  reply_id INTEGER NOT NULL REFERENCES support_replies(id) ON DELETE CASCADE,
  filename TEXT NOT NULL CHECK (length(filename) BETWEEN 1 AND 180),
  content_type TEXT NOT NULL CHECK (length(content_type) BETWEEN 1 AND 100),
  content BYTEA NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 2097152),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_private_attachments_reply ON support_private_attachments(reply_id);
