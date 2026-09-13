import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  smallint,
  timestamp,
  date,
  time,
  pgEnum,
  uniqueIndex,
  index,
  doublePrecision,
  char,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const accountStatusEnum = pgEnum("dk_account_status", [
  "pending",
  "active",
  "suspended",
]);

export const accountUserRoleEnum = pgEnum("dk_account_user_role", [
  "owner",
  "booker",
  "viewer",
]);

export const accountUserStatusEnum = pgEnum("dk_account_user_status", [
  "invited",
  "active",
  "removed",
]);

export const serviceKindEnum = pgEnum("dk_service_kind", [
  "scan",
  "day_rental",
]);

export const reservationStatusEnum = pgEnum("dk_reservation_status", [
  "pending",
  "confirmed",
  "rescheduled",
  "cancelled",
  "completed",
  "no_show",
  "rejected",
]);

export const reservationEventTypeEnum = pgEnum("dk_reservation_event_type", [
  "created",
  "confirmed",
  "rescheduled",
  "cancelled",
  "synced",
  "conflict",
  "rejected",
]);

// ─── Accounts ────────────────────────────────────────────────────────────────

export const dk_accounts = pgTable("dk_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  ico: varchar("ico", { length: 20 }),
  dic: varchar("dic", { length: 20 }),
  billing_email: varchar("billing_email", { length: 255 }),
  billing_address: text("billing_address"),
  status: accountStatusEnum("status").notNull().default("pending"),
  default_location_id: uuid("default_location_id"),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  approved_by: uuid("approved_by"),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const dk_users = pgTable(
  "dk_users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 255 }).notNull(),
    password_hash: varchar("password_hash", { length: 255 }),
    first_name: varchar("first_name", { length: 100 }).notNull(),
    last_name: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    totp_secret: varchar("totp_secret", { length: 64 }),
    totp_enabled: boolean("totp_enabled").notNull().default(false),
    email_verified_at: timestamp("email_verified_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("dk_users_email_idx").on(t.email)]
);

export const dk_account_users = pgTable(
  "dk_account_users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    account_id: uuid("account_id")
      .notNull()
      .references(() => dk_accounts.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => dk_users.id, { onDelete: "cascade" }),
    role: accountUserRoleEnum("role").notNull().default("booker"),
    invited_by: uuid("invited_by"),
    invited_at: timestamp("invited_at", { withTimezone: true }),
    accepted_at: timestamp("accepted_at", { withTimezone: true }),
    status: accountUserStatusEnum("status").notNull().default("invited"),
  },
  (t) => [uniqueIndex("dk_account_users_unique").on(t.account_id, t.user_id)]
);

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const dk_sessions = pgTable(
  "dk_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid("user_id")
      .notNull()
      .references(() => dk_users.id, { onDelete: "cascade" }),
    token_hash: varchar("token_hash", { length: 255 }).notNull(),
    device_hint: varchar("device_hint", { length: 255 }),
    last_seen_at: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("dk_sessions_token_idx").on(t.token_hash)]
);

// ─── Auth tokens (magic links, resets, email verification) ───────────────────

export const dk_auth_tokens = pgTable(
  "dk_auth_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid("user_id")
      .notNull()
      .references(() => dk_users.id, { onDelete: "cascade" }),
    token_hash: varchar("token_hash", { length: 255 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(), // 'magic_link' | 'reset' | 'verify_email' | 'email_change'
    email: varchar("email", { length: 255 }), // new email for email_change type
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    used_at: timestamp("used_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("dk_auth_tokens_hash_idx").on(t.token_hash)]
);

// ─── Rate limiting ────────────────────────────────────────────────────────────

export const dk_rate_limits = pgTable(
  "dk_rate_limits",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    key: varchar("key", { length: 255 }).notNull(), // 'email:foo@bar.com' | 'ip:1.2.3.4'
    attempts: integer("attempts").notNull().default(0),
    window_start: timestamp("window_start", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("dk_rate_limits_key_idx").on(t.key)]
);

// ─── Locations ────────────────────────────────────────────────────────────────

export const dk_zones = pgTable("dk_zones", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 20 }).notNull(), // 'praha' | 'do30' | 'do100'
  name: varchar("name", { length: 100 }).notNull(),
  max_km: integer("max_km"),
  notes: text("notes"),
});

export const dk_locations = pgTable("dk_locations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  account_id: uuid("account_id")
    .notNull()
    .references(() => dk_accounts.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 255 }).notNull(),
  street: varchar("street", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  zip: varchar("zip", { length: 20 }).notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  access_note: text("access_note"),
  contact_name: varchar("contact_name", { length: 120 }),
  contact_phone: varchar("contact_phone", { length: 32 }),
  default_zone_id: uuid("default_zone_id").references(() => dk_zones.id),
  is_default: boolean("is_default").notNull().default(false),
  verified_at: timestamp("verified_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ─── Services ─────────────────────────────────────────────────────────────────

export const dk_services = pgTable("dk_services", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: char("code", { length: 1 }).notNull(), // 'a'|'b'|'c'|'d'
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  kind: serviceKindEnum("kind").notNull(),
  zone_id: uuid("zone_id").references(() => dk_zones.id),
  duration_min: integer("duration_min").notNull(),
  buffer_before_min: integer("buffer_before_min").notNull().default(0),
  buffer_after_min: integer("buffer_after_min").notNull().default(0),
  bookable_online: boolean("bookable_online").notNull().default(true),
  requires_approval: boolean("requires_approval").notNull().default(false),
  active: boolean("active").notNull().default(true),
  updated_by: uuid("updated_by"),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ─── Technicians ──────────────────────────────────────────────────────────────

export const dk_technicians = pgTable("dk_technicians", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => dk_users.id),
  display_name: varchar("display_name", { length: 120 }).notNull(),
  google_calendar_id: varchar("google_calendar_id", { length: 255 }),
  home_base_lat: doublePrecision("home_base_lat"),
  home_base_lng: doublePrecision("home_base_lng"),
  active: boolean("active").notNull().default(true),
});

// ─── Working hours ────────────────────────────────────────────────────────────

export const dk_working_hours = pgTable(
  "dk_working_hours",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    technician_id: uuid("technician_id").references(() => dk_technicians.id, {
      onDelete: "cascade",
    }),
    weekday: smallint("weekday").notNull(), // 0=Sunday … 6=Saturday
    is_open: boolean("is_open").notNull().default(true),
    opens_at: time("opens_at"),
    closes_at: time("closes_at"),
    valid_from: date("valid_from").notNull(),
    valid_to: date("valid_to"),
  },
  (t) => [
    uniqueIndex("dk_working_hours_unique").on(
      t.technician_id,
      t.weekday,
      t.valid_from
    ),
  ]
);

export const dk_exceptions = pgTable("dk_exceptions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  technician_id: uuid("technician_id").references(() => dk_technicians.id, {
    onDelete: "cascade",
  }),
  date: date("date").notNull(),
  is_open: boolean("is_open").notNull().default(false),
  opens_at: time("opens_at"),
  closes_at: time("closes_at"),
  reason: varchar("reason", { length: 255 }),
});

// ─── Booking rules ────────────────────────────────────────────────────────────

export const dk_booking_rules = pgTable("dk_booking_rules", {
  id: integer("id").primaryKey().default(1),
  slot_step_min: integer("slot_step_min").notNull().default(30),
  lead_time_hours: integer("lead_time_hours").notNull().default(24),
  buffers_inside_working_hours: boolean("buffers_inside_working_hours")
    .notNull()
    .default(true),
  reschedule_cutoff_hours: integer("reschedule_cutoff_hours")
    .notNull()
    .default(24),
  max_self_reschedules: integer("max_self_reschedules").notNull().default(2),
  horizon_days: integer("horizon_days").notNull().default(90),
});

// ─── Slot holds ───────────────────────────────────────────────────────────────

export const dk_slot_holds = pgTable("dk_slot_holds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  service_id: uuid("service_id")
    .notNull()
    .references(() => dk_services.id),
  technician_id: uuid("technician_id")
    .notNull()
    .references(() => dk_technicians.id),
  starts_at: timestamp("starts_at", { withTimezone: true }).notNull(),
  ends_at: timestamp("ends_at", { withTimezone: true }).notNull(),
  session_token: varchar("session_token", { length: 255 }).notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ─── Reservations ─────────────────────────────────────────────────────────────

export const dk_reservations = pgTable(
  "dk_reservations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    account_id: uuid("account_id")
      .notNull()
      .references(() => dk_accounts.id),
    location_id: uuid("location_id")
      .notNull()
      .references(() => dk_locations.id),
    service_id: uuid("service_id")
      .notNull()
      .references(() => dk_services.id),
    technician_id: uuid("technician_id").references(() => dk_technicians.id),
    created_by_user_id: uuid("created_by_user_id").references(
      () => dk_users.id
    ),
    starts_at: timestamp("starts_at", { withTimezone: true }).notNull(),
    ends_at: timestamp("ends_at", { withTimezone: true }).notNull(),
    // Denormalised block extents for fast overlap queries
    blocks_from: timestamp("blocks_from", { withTimezone: true }).notNull(),
    blocks_to: timestamp("blocks_to", { withTimezone: true }).notNull(),
    status: reservationStatusEnum("status").notNull().default("pending"),
    requester_name: varchar("requester_name", { length: 120 }).notNull(),
    requester_phone: varchar("requester_phone", { length: 32 }).notNull(),
    patient_name: varchar("patient_name", { length: 120 }),
    note: text("note"),
    reschedule_count: integer("reschedule_count").notNull().default(0),
    google_event_id: varchar("google_event_id", { length: 255 }),
    google_ical_uid: varchar("google_ical_uid", { length: 255 }),
    google_etag: varchar("google_etag", { length: 255 }),
    google_calendar_id: varchar("google_calendar_id", { length: 255 }),
    legacy_bookly_appointment_id: integer("legacy_bookly_appointment_id"),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    cancelled_at: timestamp("cancelled_at", { withTimezone: true }),
    cancel_reason: text("cancel_reason"),
  },
  (t) => [
    index("dk_reservations_blocks_idx").on(t.blocks_from, t.blocks_to),
    index("dk_reservations_account_idx").on(t.account_id),
    index("dk_reservations_technician_idx").on(t.technician_id, t.starts_at),
    index("dk_reservations_gcal_idx").on(t.google_event_id),
  ]
);

// ─── Reservation audit trail ──────────────────────────────────────────────────

export const dk_reservation_events = pgTable(
  "dk_reservation_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    reservation_id: uuid("reservation_id")
      .notNull()
      .references(() => dk_reservations.id),
    actor: varchar("actor", { length: 64 }).notNull(), // 'user:uuid' | 'staff:uuid' | 'google' | 'system'
    type: reservationEventTypeEnum("type").notNull(),
    from_json: text("from_json"),
    to_json: text("to_json"),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("dk_res_events_res_idx").on(t.reservation_id)]
);

// ─── Google Watch channels ────────────────────────────────────────────────────

export const dk_google_watch_channels = pgTable("dk_google_watch_channels", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  technician_id: uuid("technician_id")
    .notNull()
    .references(() => dk_technicians.id),
  channel_id: varchar("channel_id", { length: 255 }).notNull(),
  resource_id: varchar("resource_id", { length: 255 }),
  sync_token: varchar("sync_token", { length: 1024 }),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
