/**
 * Care for the built-in database (PGlite), which lives in one folder and runs inside the app:
 * - a lock file, so a second copy of the app (e.g. during a deploy) waits instead of
 *   writing to the same folder at the same time
 * - a daily backup into DATA_DIR/backups (the last 7 are kept), used by the recovery
 *   in server/db when the database folder cannot be opened any more
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { dataDir } from "@/server/lib/data-dir";
import { embeddedClient, embeddedDir, usesEmbeddedDb } from "./index";

const BACKUPS_KEPT = 7;
const BACKUP_EVERY_MS = 24 * 60 * 60_000;
/** a lock nobody refreshed for this long belongs to a stopped app */
const LOCK_STALE_MS = 20_000;
const LOCK_WAIT_MS = 45_000;

const backupDir = () => path.join(dataDir(), "backups");
const lockFile = () => `${embeddedDir()}.lock`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ lock */

/**
 * Waits until no other running copy holds the database (or its lock is stale), then
 * holds it and refreshes the lock every few seconds. After LOCK_WAIT_MS it goes ahead
 * anyway, so a hosting that only stops the old copy once the new one answers cannot
 * deadlock.
 */
export async function holdDatabaseLock() {
  if (!usesEmbeddedDb() || embeddedDir().startsWith("memory://")) return;
  const file = lockFile();
  mkdirSync(path.dirname(file), { recursive: true });
  const me = `${hostname()}:${process.pid}`;
  const started = Date.now();
  for (;;) {
    let other = "";
    try {
      const age = Date.now() - statSync(file).mtimeMs;
      other = readFileSync(file, "utf8").trim();
      if (other === me || age > LOCK_STALE_MS) other = "";
    } catch {
      /* no lock */
    }
    if (!other) break;
    if (Date.now() - started > LOCK_WAIT_MS) {
      console.warn(`[db] Die Datenbank ist noch von ${other} belegt – nach ${LOCK_WAIT_MS / 1000} s wird trotzdem gestartet.`);
      break;
    }
    if (Date.now() - started < 1500) console.warn(`[db] Eine andere Instanz (${other}) nutzt die Datenbank – warte, bis sie beendet ist …`);
    await pause(2000);
  }
  writeFileSync(file, me);
  const beat = setInterval(() => {
    try {
      writeFileSync(file, me);
    } catch {
      /* folder gone: nothing to hold */
    }
  }, 5000);
  beat.unref();
  const release = () => {
    clearInterval(beat);
    try {
      if (readFileSync(file, "utf8").trim() === me) unlinkSync(file);
    } catch {
      /* already gone */
    }
  };
  process.once("exit", release);
  for (const sig of ["SIGTERM", "SIGINT"] as const)
    process.once(sig, () => {
      release();
      process.exit(0);
    });
}

/* --------------------------------------------------------------- backups */

export function latestBackup(): string | null {
  try {
    const files = readdirSync(backupDir())
      .filter((f) => /^datenbank-\d{12}\.tar\.gz$/.test(f))
      .sort();
    return files.length ? path.join(backupDir(), files.at(-1)!) : null;
  } catch {
    return null;
  }
}

/** Writes a backup of the running database; keeps the newest BACKUPS_KEPT. */
export async function backupNow(): Promise<string | null> {
  const client = embeddedClient();
  if (!client) return null;
  const dump = await client.dumpDataDir("gzip");
  const dir = backupDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
  const file = path.join(dir, `datenbank-${stamp}.tar.gz`);
  writeFileSync(file, Buffer.from(await dump.arrayBuffer()), { mode: 0o600 });
  const all = readdirSync(dir)
    .filter((f) => /^datenbank-\d{12}\.tar\.gz$/.test(f))
    .sort();
  for (const old of all.slice(0, Math.max(0, all.length - BACKUPS_KEPT))) rmSync(path.join(dir, old), { force: true });
  return file;
}

/** A backup now when the last one is older than a day, then once a day. */
export function scheduleBackups() {
  if (!usesEmbeddedDb() || embeddedDir().startsWith("memory://")) return;
  const run = () =>
    backupNow()
      .then((f) => f && console.log(`[db] Datensicherung: ${f}`))
      .catch((e) => console.error("[db] Datensicherung fehlgeschlagen:", e instanceof Error ? e.message : e));
  const last = latestBackup();
  const due = !last || !existsSync(last) || Date.now() - statSync(last).mtimeMs > BACKUP_EVERY_MS;
  // not during start-up: the first requests come first
  if (due) setTimeout(run, 60_000).unref();
  setInterval(run, BACKUP_EVERY_MS).unref();
}
