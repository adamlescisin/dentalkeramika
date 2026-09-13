-- Seed the first technician and their default working hours.
-- Run once: psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0001_seed_technician.sql
-- After running, copy the printed technician ID into your records.

DO $$
DECLARE
  tech_id UUID;
BEGIN
  -- Insert technician (idempotent by display_name)
  INSERT INTO dk_technicians (display_name, active)
  VALUES ('Technik', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO tech_id FROM dk_technicians WHERE display_name = 'Technik' LIMIT 1;

  RAISE NOTICE 'Technician ID: %', tech_id;

  -- Working hours: Mon–Fri 08:00–17:00, valid from today indefinitely
  -- Weekday: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  INSERT INTO dk_working_hours (technician_id, weekday, is_open, opens_at, closes_at, valid_from)
  VALUES
    (tech_id, 1, true, '08:00', '17:00', CURRENT_DATE),
    (tech_id, 2, true, '08:00', '17:00', CURRENT_DATE),
    (tech_id, 3, true, '08:00', '17:00', CURRENT_DATE),
    (tech_id, 4, true, '08:00', '17:00', CURRENT_DATE),
    (tech_id, 5, true, '08:00', '17:00', CURRENT_DATE),
    (tech_id, 6, false, null,    null,    CURRENT_DATE),
    (tech_id, 0, false, null,    null,    CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- Booking rules (lead time, slot step, buffers)
  INSERT INTO dk_booking_rules (id, lead_time_hours, slot_step_min, buffers_inside_working_hours)
  VALUES (1, 24, 30, true)
  ON CONFLICT (id) DO NOTHING;

END $$;
