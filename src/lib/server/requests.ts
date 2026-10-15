/**
 * One inbox for everything visitors send: contact form, free analysis,
 * appointment requests from Orion and support requests from customers.
 * Every request is stored first; e-mail delivery is tracked separately and
 * can be retried from the admin.
 */
import { randomBytes } from "node:crypto";
import { newId, nowIso, read, update } from "./store";

export type RequestStatus = "new" | "contacted" | "confirmed" | "completed" | "cancelled";
export type RequestType = "kontakt" | "analyse" | "termin" | "support";

export type RequestEvent = { at: string; type: string; note?: string; from?: string; to?: string };

export type InboxRequest = {
  id: string;
  reference: string;
  type: RequestType;
  source: string; // page or "orion"
  name: string;
  company?: string;
  email: string;
  phone?: string;
  existingClient?: boolean;
  service?: string;
  packageInterest?: string;
  website?: string;
  preferredDate?: string;
  preferredTime?: string;
  message?: string;
  consentAt: string;
  status: RequestStatus;
  emailStatus: "pending" | "sent" | "failed" | "skipped";
  emailError?: string;
  notes?: string;
  sessionId?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  events: RequestEvent[];
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  confirmed: "Bestätigt",
  completed: "Erledigt",
  cancelled: "Storniert",
};

export const TYPE_LABELS: Record<RequestType, string> = {
  kontakt: "Kontaktformular",
  analyse: "Kostenlose Analyse",
  termin: "Terminanfrage",
  support: "Support / Rückruf",
};

export const TIME_LABELS: Record<string, string> = {
  morning: "Vormittag (08:00–12:00)",
  midday: "Mittag (12:00–14:00)",
  afternoon: "Nachmittag (14:00–18:00)",
  flexible: "Flexibel",
};

type Data = { items: InboxRequest[] };
const EMPTY: Data = { items: [] };

function reference() {
  return "MDX-" + randomBytes(6).toString("hex").toUpperCase();
}

export async function createRequest(input: Omit<InboxRequest, "id" | "reference" | "status" | "emailStatus" | "createdAt" | "updatedAt" | "events" | "consentAt">) {
  return update<Data, { item: InboxRequest; replay: boolean }>("requests", EMPTY, (d) => {
    if (input.idempotencyKey) {
      const prior = d.items.find((r) => r.idempotencyKey === input.idempotencyKey && r.sessionId === input.sessionId);
      if (prior) return { item: prior, replay: true };
    }
    const now = nowIso();
    const item: InboxRequest = {
      ...input,
      id: newId("r_"),
      reference: reference(),
      status: "new",
      emailStatus: "pending",
      consentAt: now,
      createdAt: now,
      updatedAt: now,
      events: [{ at: now, type: "created" }],
    };
    d.items.unshift(item);
    return { item, replay: false };
  });
}

export async function listRequests() {
  return (await read<Data>("requests", EMPTY)).items;
}

export async function getRequest(idOrRef: string) {
  const items = await listRequests();
  return items.find((r) => r.id === idOrRef || r.reference.toUpperCase() === idOrRef.toUpperCase());
}

export async function patchRequest(id: string, fn: (r: InboxRequest) => void) {
  return update<Data, InboxRequest | undefined>("requests", EMPTY, (d) => {
    const r = d.items.find((x) => x.id === id);
    if (!r) return undefined;
    fn(r);
    r.updatedAt = nowIso();
    return r;
  });
}

export async function deleteRequest(id: string) {
  await update<Data>("requests", EMPTY, (d) => {
    d.items = d.items.filter((r) => r.id !== id);
  });
}

export function csvCell(v: unknown) {
  const s = v === undefined || v === null ? "" : String(v);
  // neutralise spreadsheet formulas
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(items: InboxRequest[]) {
  const head = ["Referenz", "Typ", "Status", "Erstellt", "Name", "Firma", "E-Mail", "Telefon", "Bereits Kunde", "Leistung", "Paket", "Website", "Wunschdatum", "Zeitfenster", "Nachricht", "Quelle", "E-Mail-Status"];
  const rows = items.map((r) => [
    r.reference, TYPE_LABELS[r.type], STATUS_LABELS[r.status], r.createdAt, r.name, r.company, r.email, r.phone,
    r.existingClient === undefined ? "" : r.existingClient ? "Ja" : "Nein", r.service, r.packageInterest, r.website,
    r.preferredDate, r.preferredTime ? TIME_LABELS[r.preferredTime] ?? r.preferredTime : "", r.message, r.source, r.emailStatus,
  ]);
  return "﻿" + [head, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}
