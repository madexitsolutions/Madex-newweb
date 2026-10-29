/**
 * Database access.
 * - With DATABASE_URL: an external PostgreSQL server (Coolify service, Neon, Supabase …).
 * - Without it: the built-in PostgreSQL (PGlite) keeps its data in DATA_DIR/pglite – no
 *   database server needed (also in production, e.g. on simple Node.js hosting).
 *   It runs inside the app process, so start exactly one instance and keep DATA_DIR on
 *   persistent storage. "memory://" keeps it in RAM (tests).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { dataDir } from "@/server/lib/data-dir";

export type DB = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const g = globalThis as unknown as { __predashDb?: DB; __predashPglite?: PGlite };

export const usesEmbeddedDb = () => !process.env.DATABASE_URL;

export function embeddedDir() {
  return process.env.PGLITE_DIR || path.join(dataDir(), "pglite");
}

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: Number(process.env.DATABASE_POOL || 10), prepare: false });
    return drizzlePostgres(client, { schema }) as unknown as DB;
  }
  const dir = embeddedDir();
  if (!dir.startsWith("memory://")) mkdirSync(path.dirname(path.resolve(/*turbopackIgnore: true*/ dir)), { recursive: true });
  const client = new PGlite(dir);
  g.__predashPglite = client;
  return drizzlePglite(client, { schema });
}

/** Lazily created on first use so builds and imports never open a database. */
export function getDb(): DB {
  return (g.__predashDb ??= create());
}

export const db: DB = new Proxy({} as DB, {
  get(_, prop) {
    const real = getDb();
    const value = Reflect.get(real as object, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** The PGlite instance behind the built-in database (null with an external server). */
export function embeddedClient(): PGlite | null {
  getDb();
  return g.__predashPglite ?? null;
}

/** For tests and scripts: swap in a database instance. */
export function setDb(instance: DB) {
  g.__predashDb = instance;
}

export { schema };
