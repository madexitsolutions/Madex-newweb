/**
 * Small file-backed document store (no database server needed).
 *
 * Each collection is one JSON file in DATA_DIR. When DATA_ENCRYPTION_KEY is set
 * the files are encrypted with AES-256-GCM (authenticated encryption), so
 * personal data in requests and chats is unreadable on disk.
 * Writes are serialised per collection and replace the file atomically.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), ".data"));
const MAGIC = "MDXENC1:";

function key(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;
  // accept any string; derive a 32-byte key
  return createHash("sha256").update(raw).digest();
}

function encode(json: string): string {
  const k = key();
  if (!k) return json;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return MAGIC + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

function decode(raw: string): string {
  if (!raw.startsWith(MAGIC)) return raw;
  const k = key();
  if (!k) throw new Error("DATA_ENCRYPTION_KEY fehlt – verschlüsselte Daten können nicht gelesen werden.");
  const buf = Buffer.from(raw.slice(MAGIC.length), "base64");
  const d = createDecipheriv("aes-256-gcm", k, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

const queues = new Map<string, Promise<unknown>>();
const cache = new Map<string, { mtime: number; value: unknown }>();

function file(name: string) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error("invalid collection");
  return path.join(DATA_DIR, `${name}.json`);
}

export async function read<T>(name: string, fallback: T): Promise<T> {
  const f = file(name);
  try {
    const stat = await fs.stat(f);
    const hit = cache.get(name);
    if (hit && hit.mtime === stat.mtimeMs) return structuredClone(hit.value) as T;
    const value = JSON.parse(decode(await fs.readFile(f, "utf8"))) as T;
    cache.set(name, { mtime: stat.mtimeMs, value });
    return structuredClone(value);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(fallback);
    throw err;
  }
}

async function write<T>(name: string, value: T) {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const f = file(name);
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, encode(JSON.stringify(value)), { mode: 0o600 });
  await fs.rename(tmp, f);
  cache.delete(name);
}

/** Read-modify-write under a per-collection lock. */
export async function update<T, R = void>(name: string, fallback: T, fn: (data: T) => R | Promise<R>): Promise<R> {
  const prev = queues.get(name) ?? Promise.resolve();
  let result!: R;
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const data = await read<T>(name, fallback);
      result = await fn(data);
      await write(name, data);
    });
  queues.set(name, next);
  await next;
  return result;
}

export function newId(prefix = ""): string {
  return prefix + randomBytes(9).toString("base64url");
}

export function nowIso() {
  return new Date().toISOString();
}

export const dataDir = DATA_DIR;
