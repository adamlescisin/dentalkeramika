-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Enums
CREATE TYPE dk_account_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE dk_account_user_role AS ENUM ('owner', 'booker', 'viewer');
CREATE TYPE dk_account_user_status AS ENUM ('invited', 'active', 'removed');
CREATE TYPE dk_service_kind AS ENUM ('scan', 'day_rental');
CREATE TYPE dk_reservation_status AS ENUM (
  'pending', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show', 'rejected'
);
CREATE TYPE dk_reservation_event_type AS ENUM (
  'created', 'confirmed', 'rescheduled', 'cancelled', 'synced', 'conflict', 'rejected'
);

-- Accounts
CREATE TABLE dk_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  ico VARCHAR(20),
  dic VARCHAR(20),
  billing_email VARCHAR(255),
  billing_address TEXT,
  status dk_account_status NOT NULL DEFAULT 'pending',
  default_location_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID
);

-- Users (portal auth, not WordPress)
CREATE TABLE dk_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(32),
  totp_secret VARCHAR(64),
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dk_users_email_idx ON dk_users(email);

-- Account <-> User membership
CREATE TABLE dk_account_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES dk_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dk_users(id) ON DELETE CASCADE,
  role dk_account_user_role NOT NULL DEFAULT 'booker',
  invited_by UUID,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  status dk_account_user_status NOT NULL DEFAULT 'invited',
  UNIQUE(account_id, user_id)
);

-- Sessions (rotating refresh tokens)
CREATE TABLE dk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dk_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_hint VARCHAR(255),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dk_sessions_token_idx ON dk_sessions(token_hash);

-- Auth tokens: magic links, password reset, email verification
CREATE TABLE dk_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dk_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL, -- 'magic_link' | 'reset' | 'verify_email' | 'email_change'
  email VARCHAR(255),        -- new email for email_change type
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dk_auth_tokens_hash_idx ON dk_auth_tokens(token_hash);

-- Rate limiting (per email / per IP)
CREATE TABLE dk_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(key)
);

-- Distance zones
CREATE TABLE dk_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL,  -- 'praha' | 'do30' | 'do100'
  name VARCHAR(100) NOT NULL,
  max_km INTEGER,
  notes TEXT
);

-- Practice locations (where the technician drives)
CREATE TABLE dk_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES dk_accounts(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  zip VARCHAR(20) NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  access_note TEXT,
  contact_name VARCHAR(120),
  contact_phone VARCHAR(32),
  default_zone_id UUID REFERENCES dk_zones(id),
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE dk_accounts ADD CONSTRAINT fk_default_location
  FOREIGN KEY (default_location_id) REFERENCES dk_locations(id);

-- Services (a=Praha, b=do30km, c=do100km, d=celodenní)
CREATE TABLE dk_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(1) NOT NULL,  -- 'a'|'b'|'c'|'d'
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  kind dk_service_kind NOT NULL,
  zone_id UUID REFERENCES dk_zones(id),
  duration_min INTEGER NOT NULL,
  buffer_before_min INTEGER NOT NULL DEFAULT 0,
  buffer_after_min INTEGER NOT NULL DEFAULT 0,
  bookable_online BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Technicians
CREATE TABLE dk_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dk_users(id),
  display_name VARCHAR(120) NOT NULL,
  google_calendar_id VARCHAR(255),
  home_base_lat DOUBLE PRECISION,
  home_base_lng DOUBLE PRECISION,
  active BOOLEAN NOT NULL DEFAULT true
);

-- Working hours per weekday (0=Sun…6=Sat), with validity window
CREATE TABLE dk_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID REFERENCES dk_technicians(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  opens_at TIME,
  closes_at TIME,
  valid_from DATE NOT NULL,
  valid_to DATE,
  UNIQUE(technician_id, weekday, valid_from)
);

-- Exceptions: holidays, dovolená, one-off shortened days
CREATE TABLE dk_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID REFERENCES dk_technicians(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT false,
  opens_at TIME,
  closes_at TIME,
  reason VARCHAR(255)
);

-- Single-row global booking parameters
CREATE TABLE dk_booking_rules (
  id INTEGER PRIMARY KEY DEFAULT 1,
  slot_step_min INTEGER NOT NULL DEFAULT 30,
  lead_time_hours INTEGER NOT NULL DEFAULT 24,
  buffers_inside_working_hours BOOLEAN NOT NULL DEFAULT true,
  reschedule_cutoff_hours INTEGER NOT NULL DEFAULT 24,
  max_self_reschedules INTEGER NOT NULL DEFAULT 2,
  horizon_days INTEGER NOT NULL DEFAULT 90,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO dk_booking_rules DEFAULT VALUES;

-- Soft slot locks (10-minute hold during booking flow)
CREATE TABLE dk_slot_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES dk_services(id),
  technician_id UUID NOT NULL REFERENCES dk_technicians(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  session_token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reservations
CREATE TABLE dk_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES dk_accounts(id),
  location_id UUID NOT NULL REFERENCES dk_locations(id),
  service_id UUID NOT NULL REFERENCES dk_services(id),
  technician_id UUID REFERENCES dk_technicians(id),
  created_by_user_id UUID REFERENCES dk_users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  -- Denormalised extents for O(1) overlap checks (btree_gist EXCLUDE constraint below)
  blocks_from TIMESTAMPTZ NOT NULL,
  blocks_to TIMESTAMPTZ NOT NULL,
  status dk_reservation_status NOT NULL DEFAULT 'pending',
  requester_name VARCHAR(120) NOT NULL,
  requester_phone VARCHAR(32) NOT NULL,
  patient_name VARCHAR(120),    -- optional; purged 6 months post-visit (GDPR)
  note TEXT,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  google_event_id VARCHAR(255),
  google_ical_uid VARCHAR(255),
  google_etag VARCHAR(255),
  google_calendar_id VARCHAR(255),
  legacy_bookly_appointment_id INTEGER,   -- migration provenance only
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT
);
CREATE INDEX dk_reservations_blocks_idx ON dk_reservations(blocks_from, blocks_to);
CREATE INDEX dk_reservations_account_idx ON dk_reservations(account_id);
CREATE INDEX dk_reservations_technician_idx ON dk_reservations(technician_id, starts_at);
CREATE INDEX dk_reservations_gcal_idx ON dk_reservations(google_event_id);

-- Overlap exclusion: no two active reservations for the same technician may overlap
-- (cancelled / completed are excluded so they don't block future slots)
ALTER TABLE dk_reservations ADD CONSTRAINT dk_reservations_no_overlap
  EXCLUDE USING gist (
    technician_id WITH =,
    tstzrange(blocks_from, blocks_to, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'completed', 'no_show', 'rejected'));

-- Immutable audit trail
CREATE TABLE dk_reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES dk_reservations(id),
  actor VARCHAR(64) NOT NULL,  -- 'user:uuid' | 'staff:uuid' | 'google' | 'system'
  type dk_reservation_event_type NOT NULL,
  from_json TEXT,
  to_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dk_res_events_res_idx ON dk_reservation_events(reservation_id);

-- Google OAuth tokens per technician (access + refresh, encrypted at rest)
CREATE TABLE dk_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES dk_technicians(id) ON DELETE CASCADE,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(technician_id)
);

-- Google Calendar watch channels
CREATE TABLE dk_google_watch_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES dk_technicians(id),
  channel_id VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255),
  sync_token VARCHAR(1024),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Seed data ──────────────────────────────────────────────────────────────

INSERT INTO dk_zones (code, name, max_km, notes) VALUES
  ('praha',  'Praha',             15,  'Území hl. m. Prahy a nejbližší okolí'),
  ('do30',   'Do 30 km od Prahy', 30,  'Prstencové okolí Prahy, střední Čechy'),
  ('do100',  'Do 100 km od Prahy',100, 'Celé Čechy a blízká Morava');

-- Service catalogue (parameters per spec §6)
INSERT INTO dk_services (code, name, slug, kind, zone_id, duration_min, buffer_before_min, buffer_after_min, bookable_online, requires_approval)
SELECT
  s.code, s.name, s.slug, s.kind::dk_service_kind, z.id, s.dur, s.bb, s.ba, s.online, s.approval
FROM (VALUES
  ('a', 'Sken — Praha',                  'sken-praha',    'scan',       'praha', 60, 60, 30,  true, false),
  ('b', 'Sken — do 30 km od Prahy',      'sken-do-30km',  'scan',       'do30',  60, 60, 60,  true, false),
  ('c', 'Sken — do 100 km od Prahy',     'sken-do-100km', 'scan',       'do100', 60, 90, 90,  true, false),
  ('d', 'Celodenní pronájem s technikem','celodenni',     'day_rental', NULL,   480,  0,  0,  true, false)
) AS s(code, name, slug, kind, zone_code, dur, bb, ba, online, approval)
LEFT JOIN dk_zones z ON z.code = s.zone_code;
