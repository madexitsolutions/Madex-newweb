/**
 * Database access.
 * - With DATABASE_URL: an external PostgreSQL server (Coolify service, Neon, Supabase …).
 * - Without it: the built-in PostgreSQL (PGlite) keeps its data in DATA_DIR/pglite – no
 *   database server needed (also in production, e.g. on simple Node.js hosting).
 *   It runs inside the app process, so start exactly one instance and keep DATA_DIR on
 *   persistent storage. "memory://" keeps it in RAM (tests).
 */
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { dataDir } from "@/server/lib/data-dir";

export type DB = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const g = globalThis as unknown as { __predashDb?: DB; __predashPglite?: PGlite; __pgliteDefaults?: boolean; __pgliteLoad?: Blob };

/**
 * The built-in database runs inside the app process, so its buffers count towards the
 * hosting's memory limit. PostgreSQL's defaults (128 MB shared buffers) are made for a
 * database server; a website's data fits in far less. PGLITE_SHARED_BUFFERS overrides it.
 */
const EMBEDDED_MEMORY = ["-c", `shared_buffers=${process.env.PGLITE_SHARED_BUFFERS || "16MB"}`, "-c", "work_mem=4MB", "-c", "maintenance_work_mem=16MB", "-c", "temp_buffers=4MB"];

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
  const tuned = !g.__pgliteDefaults;
  // after a recovery the new folder starts from the latest backup (see recoverEmbedded)
  const load = g.__pgliteLoad;
  g.__pgliteLoad = undefined;
  const client = new PGlite(dir, { ...(tuned ? { startParams: [...PGlite.defaultStartParams, ...EMBEDDED_MEMORY] } : {}), ...(load ? { loadDataDir: load } : {}) });
  // if the database does not start with the smaller buffers, the next request opens it with PostgreSQL's defaults
  if (tuned)
    client.waitReady.catch((e) => {
      console.error("[db] Start mit kleinen Puffern fehlgeschlagen, nächster Versuch mit Standardwerten:", e instanceof Error ? e.message : e);
      g.__pgliteDefaults = true;
      g.__predashDb = undefined;
      g.__predashPglite = undefined;
    });
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

/** null when the database answers, else a short reason (for pages that must not crash, e.g. the login). */
export async function databaseProblem(): Promise<string | null> {
  try {
    await getDb().execute(sql`select 1`);
    return null;
  } catch (e) {
    return errorChain(e);
  }
}

/** "Failed query: select 1 → PGlite failed to initialize properly": the message with its causes. */
export function errorChain(e: unknown) {
  const parts: string[] = [];
  for (let x: unknown = e, i = 0; x && i < 5; i++) {
    parts.push((x instanceof Error ? x.message : String(x)).split("\n")[0].trim());
    x = x instanceof Error ? (x as { cause?: unknown }).cause : undefined;
  }
  return [...new Set(parts.filter(Boolean))].join(" → ").slice(0, 400) || "Unbekannter Fehler";
}

/** The owner account can be recreated from the environment (else a new database would open the setup page to anyone). */
const ownerInEnv = () => Boolean((process.env.ADMIN_EMAIL || process.env.ADMIN_USERNAME?.includes("@")) && (process.env.ADMIN_PASSWORD ?? "").length >= 12);

/**
 * A built-in database that cannot be opened at start-up is moved aside (kept as
 * "<folder>-defekt-<time>", nothing is deleted) and replaced by the latest daily
 * backup (DATA_DIR/backups) or, without one, by a new database. Automatic when
 * ADMIN_EMAIL/ADMIN_PASSWORD can recreate the owner account, else only with
 * PGLITE_RECOVER=true.
 */
export async function recoverEmbedded(reason: string): Promise<string | null> {
  if (!usesEmbeddedDb()) return null;
  if (!/^(true|1|yes|ja)$/i.test(process.env.PGLITE_RECOVER?.trim() ?? "") && !ownerInEnv()) return null;
  const dir = embeddedDir();
  if (dir.startsWith("memory://") || !existsSync(dir)) return null;
  await g.__predashPglite?.close().catch(() => undefined);
  g.__predashDb = undefined;
  g.__predashPglite = undefined;
  const aside = `${dir}-defekt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  renameSync(dir, aside);
  const { latestBackup } = await import("./care");
  const backup = latestBackup();
  if (backup) g.__pgliteLoad = new Blob([readFileSync(backup)], { type: "application/gzip" });
  console.error(`[db] Datenbank liess sich nicht öffnen (${reason}). Alter Ordner: ${aside} – ${backup ? `wiederhergestellt aus ${backup}` : "neue Datenbank wird angelegt"}.`);
  (globalThis as { __dbRecovered?: string }).__dbRecovered = backup ? `Datensicherung ${path.basename(backup)}` : "neue Datenbank";
  return aside;
}

/** For tests and scripts: swap in a database instance. */
export function setDb(instance: DB) {
  g.__predashDb = instance;
}

export { schema };
