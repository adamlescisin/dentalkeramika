ALTER TABLE dk_booking_rules
  ADD COLUMN IF NOT EXISTS contact_phone varchar(30),
  ADD COLUMN IF NOT EXISTS support_email varchar(254);
