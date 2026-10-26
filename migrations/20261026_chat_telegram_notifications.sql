-- Appliquer après le provisionnement du schéma support, avant le déploiement de /api/chat.
CREATE TABLE IF NOT EXISTS chat_telegram_notifications (
  id BIGSERIAL PRIMARY KEY,
  support_message_id INTEGER NOT NULL UNIQUE REFERENCES support_messages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  lock_token UUID,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_telegram_notifications_ready ON chat_telegram_notifications (available_at, id) WHERE status <> 'sent';
