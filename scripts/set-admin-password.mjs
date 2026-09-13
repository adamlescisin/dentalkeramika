// One-time script to create or update the admin user's password hash.
// Usage: node scripts/set-admin-password.mjs <email> <password>
// Requires DATABASE_URL in env (same as .env.local).

import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const [,, email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/set-admin-password.mjs <email> <password>");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!dbUrl) { console.error("DATABASE_URL not found in .env.local"); process.exit(1); }

const sql = neon(dbUrl);
const hash = await bcrypt.hash(password, 12);
const now = new Date().toISOString();

const updated = await sql`
  UPDATE dk_users
  SET password_hash = ${hash}, email_verified_at = ${now}
  WHERE email = ${email.toLowerCase().trim()}
  RETURNING id, email
`;

if (updated.length > 0) {
  console.log("✓ Password updated for:", updated[0].email);
} else {
  await sql`
    INSERT INTO dk_users (id, email, password_hash, first_name, last_name, email_verified_at)
    VALUES (gen_random_uuid(), ${email.toLowerCase().trim()}, ${hash}, 'Admin', '', ${now})
  `;
  console.log("✓ Admin user created:", email);
}
