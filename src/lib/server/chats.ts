/** Chat sessions with token protection (only the visitor holding the token can read/continue). */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { nowIso, read, update } from "./store";

export type ChatMessage = { id?: number; role: "user" | "assistant"; content: string; at: string; actions?: string[]; fallback?: boolean };
export type ChatSession = {
  id: string; // public uuid
  tokenHash: string;
  createdAt: string;
  updatedAt: string;
  page?: string;
  customerType?: "client" | "prospect";
  requestRef?: string;
  /** idempotency key of the appointment request, so a resent form returns the same reference */
  requestKey?: string;
  topic?: string;
  closedAt?: string;
  lastSeen?: string;
  messages: ChatMessage[];
};

type Data = { items: ChatSession[] };
const EMPTY: Data = { items: [] };

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(page?: string) {
  const token = randomBytes(24).toString("base64url");
  const session: ChatSession = { id: randomUUID(), tokenHash: hash(token), createdAt: nowIso(), updatedAt: nowIso(), page, messages: [] };
  await update<Data>("chats", EMPTY, (d) => {
    d.items.unshift(session);
  });
  return { id: session.id, token };
}

export async function getSession(id: string, token: string) {
  const s = (await read<Data>("chats", EMPTY)).items.find((x) => x.id === id);
  if (!s) return null;
  const a = Buffer.from(s.tokenHash);
  const b = Buffer.from(hash(token));
  return a.length === b.length && timingSafeEqual(a, b) ? s : null;
}

/** Appends messages (numbering them per session) and returns them with their ids. */
export async function appendMessages(id: string, msgs: ChatMessage[], patch?: Partial<ChatSession>) {
  return update<Data, ChatMessage[]>("chats", EMPTY, (d) => {
    const s = d.items.find((x) => x.id === id);
    if (!s) return [];
    let next = s.messages.reduce((m, x, i) => Math.max(m, x.id ?? i + 1), 0);
    const added = msgs.map((m) => ({ ...m, id: ++next }));
    s.messages.push(...added);
    if (s.messages.length > 200) s.messages = s.messages.slice(-200);
    Object.assign(s, patch, { updatedAt: nowIso() });
    return added;
  });
}

export async function touchSession(id: string, patch: Partial<ChatSession> = {}) {
  await update<Data>("chats", EMPTY, (d) => {
    const s = d.items.find((x) => x.id === id);
    if (s) Object.assign(s, patch, { lastSeen: nowIso() });
  });
}

export async function listSessions() {
  return (await read<Data>("chats", EMPTY)).items;
}

export async function deleteSession(id: string) {
  await update<Data>("chats", EMPTY, (d) => {
    d.items = d.items.filter((s) => s.id !== id);
  });
}

export async function purgeOlderThan(days: number) {
  if (!days) return 0;
  const cutoff = Date.now() - days * 86400000;
  return update<Data, number>("chats", EMPTY, (d) => {
    const before = d.items.length;
    d.items = d.items.filter((s) => new Date(s.updatedAt).getTime() >= cutoff);
    return before - d.items.length;
  });
}

/** Short pseudonymous visitor label for dashboards (no IP, no location). */
export function visitorLabel(id: string) {
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(0, 6);
  return "#" + String((parseInt(hex || "0", 16) || 0) % 10000).padStart(4, "0");
}
