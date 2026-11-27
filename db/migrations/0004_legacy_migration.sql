-- Run once: psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0004_legacy_migration.sql
--
-- Legacy (Bookly) reservation import — admin wizard at /admin/migrace.

-- Each legacy appointment can be imported at most once. This is what makes the
-- import safe to run repeatedly: a second insert of the same legacy ID fails
-- and is reported as "already migrated".
CREATE UNIQUE INDEX IF NOT EXISTS dk_reservations_legacy_bookly_idx
  ON dk_reservations (legacy_bookly_appointment_id)
  WHERE legacy_bookly_appointment_id IS NOT NULL;

-- Mapping decisions made in the wizard (legacy customer e-mail → portal user
-- + practice, legacy service name → portal service), remembered for the next run.
CREATE TABLE IF NOT EXISTS dk_legacy_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(16) NOT NULL,          -- 'customer' | 'service'
  legacy_key VARCHAR(255) NOT NULL,   -- lower-cased e-mail, or service name
  target_id UUID NOT NULL,            -- dk_users.id or dk_services.id
  target_account_id UUID REFERENCES dk_accounts(id) ON DELETE CASCADE, -- customer mappings only
  updated_by UUID REFERENCES dk_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dk_legacy_mappings_key_idx
  ON dk_legacy_mappings (kind, legacy_key);
