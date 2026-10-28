ALTER TABLE expenses ADD COLUMN split_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE expenses ADD COLUMN installments_json TEXT;
