-- Run once: psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0003_overrun_buffer_tech_email.sql

-- Extra gap kept free after every busy block coming from Google Calendar
-- (overrun / departure from a non-portal appointment).
ALTER TABLE dk_booking_rules
  ADD COLUMN IF NOT EXISTS gcal_overrun_buffer_min integer NOT NULL DEFAULT 30;

-- Notification address for reservation change e-mails and the weekly digest.
ALTER TABLE dk_technicians
  ADD COLUMN IF NOT EXISTS email varchar(254);
