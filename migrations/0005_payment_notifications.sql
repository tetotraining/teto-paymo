CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS payment_notification_settings (
  user_id TEXT PRIMARY KEY,
  three_days_time TEXT NOT NULL DEFAULT '09:00',
  one_day_time TEXT NOT NULL DEFAULT '09:00',
  same_day_time TEXT NOT NULL DEFAULT '09:00',
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_notification_deliveries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  installment_index INTEGER NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  days_before INTEGER NOT NULL,
  sent_at INTEGER NOT NULL,
  UNIQUE(user_id, expense_id, installment_index, due_date, days_before),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payment_notification_deliveries_lookup
  ON payment_notification_deliveries(user_id, due_date, days_before);
