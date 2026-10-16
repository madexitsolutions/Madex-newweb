/**
 * Database access. With DATABASE_URL a real PostgreSQL server is used (production).
 * Without it, an embedded PostgreSQL (PGlite) stores its data in .data/pglite –
 * zero setup for development, demos and tests ("memory://" keeps it in RAM).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const g = globalThis as unknown as { __predashDb?: DB; __predashPglite?: PGlite };

export function embeddedDir() {
  return process.env.PGLITE_DIR || path.join(process.env.DATA_DIR || ".data", "pglite");
}

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: Number(process.env.DATABASE_POOL || 10), prepare: false });
    return drizzlePostgres(client, { schema }) as unknown as DB;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "true") {
    throw new Error("DATABASE_URL fehlt. In Produktion wird PostgreSQL benötigt (oder ALLOW_EMBEDDED_DB=true für Demos).");
  }
  const dir = embeddedDir();
  if (!dir.startsWith("memory://")) mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
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

/** For tests and scripts: swap in a database instance. */
export function setDb(instance: DB) {
  g.__predashDb = instance;
}

export { schema };
