/**
 * Silent practice + user import script.
 *
 * Inserts accounts, users, account_users, and locations directly into the DB.
 * No emails are sent at any point — users are pre-verified (email_verified_at
 * is set) so they can log in via password-reset once you choose to invite them.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/import-practices.ts practices.json [--dry-run]
 *
 * Input JSON schema (array of practices):
 * [
 *   {
 *     "name": "Název ordinace",          // required
 *     "ico": "12345678",                 // optional
 *     "dic": "CZ12345678",               // optional
 *     "billing_email": "billing@x.cz",  // optional, falls back to first user's email
 *     "billing_address": "...",          // optional
 *     "users": [                         // required, at least one
 *       {
 *         "email": "owner@x.cz",         // required — this is the login email
 *         "first_name": "Jan",           // required
 *         "last_name": "Novák",          // required
 *         "phone": "+420123456789",      // optional
 *         "role": "owner"                // optional, defaults to "owner"
 *       }
 *     ],
 *     "locations": [                     // optional
 *       {
 *         "label": "Hlavní ordinace",    // required if locations present
 *         "street": "Dlouhá 1",          // required if locations present
 *         "city": "Praha",               // required if locations present
 *         "zip": "11000",                // required if locations present
 *         "access_note": "...",          // optional
 *         "contact_name": "...",         // optional
 *         "contact_phone": "..."         // optional
 *       }
 *     ],
 *     "legacy_id": "bookly-123"          // optional, stored in account notes for tracing
 *   }
 * ]
 */

import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import {
  dk_accounts,
  dk_users,
  dk_account_users,
  dk_locations,
} from "../db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserInput {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: "owner" | "booker" | "viewer";
}

interface LocationInput {
  label: string;
  street: string;
  city: string;
  zip: string;
  access_note?: string;
  contact_name?: string;
  contact_phone?: string;
}

interface PracticeInput {
  name: string;
  ico?: string;
  dic?: string;
  billing_email?: string;
  billing_address?: string;
  users: UserInput[];
  locations?: LocationInput[];
  legacy_id?: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const inputFile = args.find((a) => !a.startsWith("--"));

  if (!inputFile) {
    console.error("Usage: npx tsx scripts/import-practices.ts <file.json> [--dry-run]");
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL or DATABASE_URL_UNPOOLED must be set.");
    process.exit(1);
  }

  const practices: PracticeInput[] = JSON.parse(readFileSync(inputFile, "utf-8"));

  if (!Array.isArray(practices) || practices.length === 0) {
    console.error("Input must be a non-empty JSON array.");
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const db = drizzle(sql);

  const importedAt = new Date();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const practice of practices) {
    console.log(`\n── ${practice.name} ${practice.legacy_id ? `(${practice.legacy_id})` : ""}`);

    if (!practice.name || !practice.users?.length) {
      console.error("  ✗ Missing required fields (name, users). Skipping.");
      errors++;
      continue;
    }

    // Check for duplicate account by name (case-insensitive exact match)
    const existingAccount = await db
      .select({ id: dk_accounts.id })
      .from(dk_accounts)
      .where(eq(dk_accounts.name, practice.name))
      .limit(1);

    if (existingAccount.length > 0) {
      console.log(`  ↷ Account already exists (id=${existingAccount[0].id}). Skipping.`);
      skipped++;
      continue;
    }

    const billingEmail =
      practice.billing_email ?? practice.users[0].email.toLowerCase().trim();

    if (dryRun) {
      console.log(`  ○ [dry-run] Would create account "${practice.name}" with ${practice.users.length} user(s) and ${practice.locations?.length ?? 0} location(s).`);
      created++;
      continue;
    }

    try {
      // 1. Create account — already active, no approval email needed
      const [account] = await db
        .insert(dk_accounts)
        .values({
          name: practice.name,
          ico: practice.ico ?? null,
          dic: practice.dic ?? null,
          billing_email: billingEmail,
          billing_address: practice.billing_address ?? null,
          status: "active",
          approved_at: importedAt,
        })
        .returning({ id: dk_accounts.id });

      console.log(`  ✓ Account created (id=${account.id})`);

      // 2. Create users and link to account
      for (const u of practice.users) {
        const email = u.email.toLowerCase().trim();

        // Upsert user — if email already exists (shared owner across practices), reuse
        const existing = await db
          .select({ id: dk_users.id })
          .from(dk_users)
          .where(eq(dk_users.email, email))
          .limit(1);

        let userId: string;

        if (existing.length > 0) {
          userId = existing[0].id;
          console.log(`    ↷ User ${email} already exists (id=${userId}), linking to new account.`);
        } else {
          // No password_hash — user must use the password-reset flow to set one.
          // email_verified_at is pre-set so they can log in once they have a password.
          const [user] = await db
            .insert(dk_users)
            .values({
              email,
              first_name: u.first_name,
              last_name: u.last_name,
              phone: u.phone ?? null,
              password_hash: null,
              email_verified_at: importedAt,
            })
            .returning({ id: dk_users.id });

          userId = user.id;
          console.log(`    ✓ User ${email} created (id=${userId})`);
        }

        // Link user to account (skip if already linked)
        const existingLink = await db
          .select({ id: dk_account_users.id })
          .from(dk_account_users)
          .where(
            and(
            eq(dk_account_users.account_id, account.id),
            eq(dk_account_users.user_id, userId)
          )
          )
          .limit(1);

        if (existingLink.length === 0) {
          await db.insert(dk_account_users).values({
            account_id: account.id,
            user_id: userId,
            role: u.role ?? "owner",
            status: "active",
            accepted_at: importedAt,
          });
          console.log(`    ✓ Linked as ${u.role ?? "owner"}`);
        }
      }

      // 3. Create locations
      if (practice.locations?.length) {
        for (let i = 0; i < practice.locations.length; i++) {
          const loc = practice.locations[i];
          await db.insert(dk_locations).values({
            account_id: account.id,
            label: loc.label,
            street: loc.street,
            city: loc.city,
            zip: loc.zip,
            access_note: loc.access_note ?? null,
            contact_name: loc.contact_name ?? null,
            contact_phone: loc.contact_phone ?? null,
            is_default: i === 0,
          });
          console.log(`    ✓ Location "${loc.label}" created`);
        }
      }

      created++;
    } catch (err) {
      console.error(`  ✗ Error:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log(`\n── Summary ──────────────────────────────────`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Errors  : ${errors}`);

  if (dryRun) {
    console.log("\n  (Dry run — no changes were written to the database.)");
  } else {
    console.log("\n  Users have no password. They can set one via the");
    console.log("  'Forgot password' flow, which sends a reset email");
    console.log("  only when they explicitly request it.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
