CREATE TABLE IF NOT EXISTS spending_threshold_settings (
  user_id TEXT PRIMARY KEY,
  threshold_amount INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS spending_threshold_events (
  user_id TEXT NOT NULL,
  month_key TEXT NOT NULL,
  threshold_amount INTEGER NOT NULL,
  crossed_at INTEGER NOT NULL,
  sending_at INTEGER,
  sent_at INTEGER,
  PRIMARY KEY(user_id,month_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_spending_threshold_events_due
  ON spending_threshold_events(month_key,sent_at,crossed_at);
