CREATE TABLE IF NOT EXISTS expenses (
  owner_key TEXT NOT NULL,
  id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  payee TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_key, id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_owner_date
  ON expenses (owner_key, date DESC);
