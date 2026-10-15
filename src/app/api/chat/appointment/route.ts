import { NextResponse } from "next/server";
import { z } from "zod";
import { appendMessages, getSession } from "@/lib/server/chats";
import { sendRequestNotification } from "@/lib/server/mailer";
import { SERVICE_OPTIONS } from "@/lib/server/packages";
import { createRequest } from "@/lib/server/requests";
import { clientIp, logSecurity } from "@/lib/server/security";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
  token: z.string().min(10),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/),
  type: z.enum(["termin", "analyse", "support"]).default("termin"),
  name: z.string().trim().min(2, "Bitte geben Sie Ihren vollständigen Namen ein.").max(191),
  company: z.string().trim().max(191).optional().default(""),
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").max(254),
  phone: z.string().trim().max(40).regex(/^[+()\d\s/-]*$/, "Bitte geben Sie eine gültige Telefonnummer ein.").optional().default(""),
  existingClient: z.boolean({ required_error: "Bitte geben Sie an, ob Sie bereits Kunde sind." }),
  service: z.string().max(60).optional().default(""),
  packageInterest: z.string().max(191).optional().default(""),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte wählen Sie ein gültiges Datum in der Zukunft."),
  preferredTime: z.enum(["morning", "midday", "afternoon", "flexible"], { errorMap: () => ({ message: "Bitte wählen Sie ein Zeitfenster." }) }),
  message: z.string().trim().max(5000).optional().default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Bitte stimmen Sie der Datenverarbeitung zu." }) }),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit("appt:" + ip, 5, 3_600_000)) {
    await logSecurity("rate_appointments", ip);
    return NextResponse.json({ ok: false, error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Angaben." }, { status: 422 });
  }
  const d = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  if (d.preferredDate < today) return NextResponse.json({ ok: false, error: "Bitte wählen Sie ein gültiges Datum in der Zukunft." }, { status: 422 });
  const session = await getSession(d.id, d.token);
  if (!session) return NextResponse.json({ ok: false, error: "Die Chat-Sitzung ist ungültig. Bitte starten Sie ein neues Gespräch." }, { status: 401 });

  const { item, replay } = await createRequest({
    type: d.type,
    source: "orion",
    name: d.name,
    company: d.company,
    email: d.email,
    phone: d.phone,
    existingClient: d.existingClient,
    service: SERVICE_OPTIONS[d.service] ?? d.service,
    packageInterest: d.packageInterest,
    preferredDate: d.preferredDate,
    preferredTime: d.preferredTime,
    message: d.message,
    sessionId: d.id,
    idempotencyKey: d.idempotencyKey,
  });
  if (!replay) {
    await appendMessages(d.id, [], { requestRef: item.reference, customerType: d.existingClient ? "client" : "prospect" });
    await sendRequestNotification(item);
  }
  return NextResponse.json({ ok: true, reference: item.reference });
}
