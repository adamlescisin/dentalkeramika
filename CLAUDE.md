# DentálníKeramika — developer guide

## Stack

- **Framework:** Next.js 15, App Router, TypeScript
- **Database:** Neon Postgres (serverless), Drizzle ORM
- **Auth:** Custom JWT sessions (jose + bcryptjs), no NextAuth
- **Email:** Resend REST API
- **Calendar:** Google Calendar API v3, service account with domain-wide delegation
- **Deployment:** Vercel Hobby, region `aws-eu-central-1` (Frankfurt)
- **Storage (STL/backups):** Cloudflare R2

## Project structure

```
db/
  schema.ts          Drizzle table definitions — single source of truth
  index.ts           Neon HTTP driver + drizzle instance
  migrations/        Version-controlled SQL (run once, never edited)
src/
  app/
    (marketing)/     Public site pages (home, services, about)
    (portal)/        Auth-gated portal pages (/portal/*)
    prihlasit/       Login page
    registrace/      Two-step registration
    api/dk/v1/       Versioned REST API
      auth/          Login, magic link, reset, register, logout
      availability/  Slot computation
      reservations/  CRUD + reschedule + cancel
      account/       Practice profile, locations, team
      google-webhook/ Inbound Google push channel
    api/cron/        Vercel Cron jobs (warm-db, reconcile, backup)
  lib/
    auth.ts          Sessions, tokens, rate limiting, HIBP
    availability.ts  Slot algorithm (spec §6)
    email.ts         Resend transactional templates
    google-calendar.ts  Calendar CRUD + freebusy + watch channels
```

## Commands

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # production build
npm run lint         # ESLint

# Database migrations
npx drizzle-kit generate  # diff schema → new migration file
npx drizzle-kit migrate   # apply pending migrations (uses DATABASE_URL_UNPOOLED)
```

## Key design decisions

- **No username field.** E-mail IS the login. No profile-builder-style plugin.
- **Accounts are practices, not people.** `dk_accounts` = practice; `dk_users` = people; `dk_account_users` joins them with a role.
- **Google Calendar is the schedule's ground truth.** The DB reflects it; GCal wins on time conflicts.
- **Buffers are first-class.** `blocks_from` / `blocks_to` are denormalised onto `dk_reservations` for fast `btree_gist EXCLUDE` overlap checks. Do not bypass them.
- **Reschedule patches, never recreates.** Same `id` and same `google_event_id` throughout the lifecycle.
- **The availability API is server-side and stateless.** The client never holds rules; a parameter change in admin takes effect on the next request.
- **Rate limiting is in-DB.** Simple enough for this traffic level; replace with Redis or Upstash if load increases.

## Secrets

Copy `.env.example` to `.env.local` and fill in values. Never commit `.env.local`.

## Migrations

The initial migration (`db/migrations/0000_initial.sql`) must be run manually on a fresh database:

```bash
psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0000_initial.sql
```

After that, use Drizzle Kit for incremental changes.

## Availability algorithm

See `src/lib/availability.ts` and spec §6. The two non-obvious rules:

1. `buffers_inside_working_hours = true` (default): the travel buffer must fit inside the working day. First Praha slot is 08:30, not 07:30.
2. Each reservation's own buffers block the next one. Two Praha scans cannot share a gap.

## Google Calendar integration

See `src/lib/google-calendar.ts` and spec §7. The reconciliation cron (`/api/cron/reconcile`) runs nightly and is the safety net for missed webhooks.

**Conflict policy:**
- Technician moves event in GCal → portal follows, reservation updated as `rescheduled` by actor `google`
- Technician deletes event → 10-min grace re-read, then `cancelled`
- Portal patches while event has newer etag → 412, portal re-reads and re-offers slots
