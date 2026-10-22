/**
 * POST /api/v1/inquiries  (scope inquiries:write, public or secret key) – submit a form
 * GET  /api/v1/inquiries  (scope inquiries:read, secret key) – list inquiries
 */
import { and, count, desc, eq, gte } from "drizzle-orm";
import { apiAuth, apiError, json, preflight, readJson } from "@/server/api/http";
import { isModuleEnabled } from "@/modules/registry";
import { db } from "@/server/db";
import { inquiries } from "@/server/db/schema";
import { createInquiry } from "@/server/content/inquiries";
import { ipFromRequest } from "@/server/lib/request";

export const OPTIONS = preflight;

export async function POST(req: Request) {
  const auth = await apiAuth(req, "inquiries:write");
  if (auth instanceof Response) return auth;
  if (!(await isModuleEnabled("inquiries"))) return apiError(req, auth, 404, "module_disabled", "Das Plugin «Anfragen» ist nicht aktiv. Aktivieren Sie es unter Plugins.");
  const body = await readJson<Record<string, unknown>>(req, auth);
  if (body instanceof Response) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError(req, auth, 400, "invalid_body", "Erwartet wird ein JSON-Objekt.");
  const res = await createInquiry(body, { ip: ipFromRequest(req) });
  if (!res.ok) {
    if (res.code === "rate_limited") return apiError(req, auth, 429, "rate_limited", res.message);
    return apiError(req, auth, 422, "validation_failed", res.message, res.fieldErrors);
  }
  // spam is accepted silently so bots learn nothing
  return json(req, auth, { reference: res.reference }, { status: 201 });
}

const STATUSES = ["new", "open", "done", "spam"] as const;

export async function GET(req: Request) {
  const auth = await apiAuth(req, "inquiries:read");
  if (auth instanceof Response) return auth;
  if (auth.kind !== "secret") return apiError(req, auth, 403, "forbidden", "Anfragen dürfen nur mit einem geheimen Schlüssel gelesen werden.");
  if (!(await isModuleEnabled("inquiries"))) return apiError(req, auth, 404, "module_disabled", "Das Plugin «Anfragen» ist nicht aktiv. Aktivieren Sie es unter Plugins.");
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
  const status = url.searchParams.get("status");
  const since = url.searchParams.get("since");
  if (status && !(STATUSES as readonly string[]).includes(status)) return apiError(req, auth, 400, "invalid_status", `status muss einer von ${STATUSES.join(", ")} sein.`);
  const sinceDate = since ? new Date(since) : null;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) return apiError(req, auth, 400, "invalid_since", "since muss ein ISO-Datum sein, z. B. 2026-10-01T00:00:00Z.");
  const where = and(status ? eq(inquiries.status, status as (typeof STATUSES)[number]) : undefined, sinceDate ? gte(inquiries.createdAt, sinceDate) : undefined);
  const [{ n }] = await db.select({ n: count() }).from(inquiries).where(where);
  const rows = await db
    .select()
    .from(inquiries)
    .where(where)
    .orderBy(desc(inquiries.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return json(req, auth, {
    data: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      form: r.form,
      status: r.status,
      name: r.name,
      email: r.email,
      phone: r.phone,
      company: r.company,
      subject: r.subject,
      message: r.message,
      fields: r.fields,
      sourceUrl: r.sourceUrl || null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    pagination: { page, limit, total: n, pages: Math.max(1, Math.ceil(n / limit)) },
  });
}
