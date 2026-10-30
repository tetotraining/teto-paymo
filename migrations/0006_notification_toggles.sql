ALTER TABLE payment_notification_settings ADD COLUMN two_days_time TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE payment_notification_settings ADD COLUMN same_day_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payment_notification_settings ADD COLUMN one_day_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE payment_notification_settings ADD COLUMN two_days_enabled INTEGER NOT NULL DEFAULT 1;

UPDATE payment_notification_settings
SET two_days_time = three_days_time,
    same_day_enabled = enabled,
    one_day_enabled = enabled,
    two_days_enabled = enabled;
