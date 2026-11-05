-- Set a default only for accounts with no saved spending-alert preference.
-- Existing user-chosen thresholds and ON/OFF choices remain unchanged.
INSERT OR IGNORE INTO spending_threshold_settings (user_id,threshold_amount,enabled,updated_at)
SELECT id,30000,1,unixepoch() * 1000 FROM users;
