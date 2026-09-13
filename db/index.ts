import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Use the HTTP/WebSocket driver for Vercel serverless functions.
// Migration scripts use DATABASE_URL_UNPOOLED with a regular pg client.
//
// The connection is created lazily so the module can be imported during
// Next.js static analysis without DATABASE_URL being set at build time.
function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

// Singleton — reuse across invocations in the same serverless instance.
let _db: ReturnType<typeof getDb> | undefined;
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    if (!_db) _db = getDb();
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type DB = ReturnType<typeof getDb>;
