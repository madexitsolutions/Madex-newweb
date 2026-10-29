/** Encryption of stored secrets (API keys of payment providers, TOTP secrets) and token helpers. */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { dataDir } from "./data-dir";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

let cachedKey: Buffer | null = null;

/**
 * Encryption key. APP_SECRET (min. 32 characters) when set; otherwise a random
 * secret is generated once and kept in DATA_DIR/.app-secret next to the data it protects.
 */
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) {
    cachedKey = createHash("sha256").update(secret).digest();
    return cachedKey;
  }
  if (process.env.NODE_ENV === "test") {
    cachedKey = createHash("sha256").update("predashboard-test-secret").digest();
    return cachedKey;
  }
  cachedKey = createHash("sha256").update(storedSecret()).digest();
  return cachedKey;
}

/** Makes sure the encryption key exists (called at server start). */
export function ensureSecret() {
  key();
}

export function secretFile() {
  return path.join(dataDir(), ".app-secret");
}

/** Where the encryption secret comes from (for the status page). */
export function secretSource(): "env" | "file" | "missing" {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return "env";
  return existsSync(secretFile()) ? "file" : "missing";
}

function storedSecret() {
  const file = secretFile();
  if (existsSync(file)) {
    const v = readFileSync(file, "utf8").trim();
    if (v.length >= 32) return v;
  }
  const v = randomBytes(48).toString("base64url");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, v + "\n", { mode: 0o600 });
  console.log(`[setup] Neuer Verschlüsselungsschlüssel in ${file} angelegt (APP_SECRET nicht gesetzt). Diese Datei mit den Daten sichern.`);
  return v;
}

/** AES-256-GCM, output "v1.<iv>.<tag>.<data>" (base64url). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(value: string): string {
  const [v, iv, tag, data] = value.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Ungültiger verschlüsselter Wert");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("v1.") && value.split(".").length === 4;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(sha256(a));
  const y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
}

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** scrypt password hash: "scrypt$N$r$p$salt$hash" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // constant-ish time for unknown users
    await scrypt("x", Buffer.alloc(16), 64, SCRYPT);
    return false;
  }
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Readable one-time codes like "7KQ2M-9XTRA" */
export function recoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(10);
  let s = "";
  for (let i = 0; i < 10; i++) s += alphabet[b[i] % alphabet.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}
