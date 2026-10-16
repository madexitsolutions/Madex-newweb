/**
 * API keys for connected webapps.
 * - public keys (pk_…) may be used in the browser: catalog, cart, checkout, forms, content
 * - secret keys (sk_…) are for servers only and can read/write orders, products, customers
 * Only a hash of each key is stored; the key itself is shown once when created.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { apiKeys } from "@/server/db/schema";
import { randomToken, sha256 } from "@/server/lib/crypto";

export const SCOPES = {
  "catalog:read": { label: "Produkte und Kategorien lesen", public: true },
  "cart:write": { label: "Warenkorb verwalten", public: true },
  "checkout:write": { label: "Bestellungen über die Kasse auslösen", public: true },
  "customers:auth": { label: "Kundenkonto: Registrierung, Anmeldung, eigene Bestellungen", public: true },
  "inquiries:write": { label: "Formular-Anfragen senden", public: true },
  "content:read": { label: "Beiträge und SEO-Daten lesen", public: true },
  "orders:read": { label: "Alle Bestellungen lesen", public: false },
  "orders:write": { label: "Bestellungen ändern (Status, Versand)", public: false },
  "products:write": { label: "Produkte und Lager ändern", public: false },
  "customers:read": { label: "Kundendaten lesen", public: false },
  "inquiries:read": { label: "Anfragen lesen", public: false },
} as const;

export type Scope = keyof typeof SCOPES;
export const PUBLIC_SCOPES = (Object.keys(SCOPES) as Scope[]).filter((s) => SCOPES[s].public);

export async function createApiKey(input: { name: string; kind: "public" | "secret"; scopes: Scope[]; allowedOrigins?: string[]; userId?: string }) {
  const scopes = input.kind === "public" ? input.scopes.filter((s) => SCOPES[s]?.public) : input.scopes.filter((s) => s in SCOPES);
  const key = `${input.kind === "public" ? "pk" : "sk"}_${randomToken(24)}`;
  const [row] = await db
    .insert(apiKeys)
    .values({ name: input.name, kind: input.kind, prefix: key.slice(0, 10), keyHash: sha256(key), scopes, allowedOrigins: input.allowedOrigins ?? [], createdBy: input.userId ?? null })
    .returning();
  return { key, row };
}

export async function findKey(raw: string) {
  if (!/^(pk|sk)_[A-Za-z0-9_-]{20,}$/.test(raw)) return null;
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, sha256(raw)));
  if (!row || row.revokedAt) return null;
  return row;
}
