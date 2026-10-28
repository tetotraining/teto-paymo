ALTER TABLE expenses ADD COLUMN usage_date TEXT;

UPDATE expenses
SET usage_date = date
WHERE usage_date IS NULL OR usage_date = '';

CREATE INDEX IF NOT EXISTS idx_expenses_owner_usage_date
  ON expenses (owner_key, usage_date DESC);
