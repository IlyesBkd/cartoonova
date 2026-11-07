-- One fixed row, no browser reports or customer data stored.
CREATE TABLE IF NOT EXISTS csp_alert_clock (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  alerted_at TIMESTAMPTZ NOT NULL
);
