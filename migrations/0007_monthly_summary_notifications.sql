CREATE TABLE IF NOT EXISTS monthly_summary_notification_settings (
  user_id TEXT PRIMARY KEY,
  notify_time TEXT NOT NULL DEFAULT '09:00',
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monthly_summary_notification_deliveries (
  user_id TEXT NOT NULL,
  month_key TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, month_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO monthly_summary_notification_settings(user_id, notify_time, enabled, updated_at)
SELECT id, '09:00', 1, unixepoch() * 1000 FROM users;
