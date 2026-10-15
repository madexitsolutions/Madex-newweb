import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { sendRequestNotification } from "@/lib/server/mailer";
import { createRequest } from "@/lib/server/requests";
import { clientIp, logSecurity } from "@/lib/server/security";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").max(200),
  website: z.string().trim().max(200).optional().default(""),
  fax: z.string().max(0).optional().or(z.literal("")),
});

/** Hero quick form: request the free analysis with just an e-mail (and optionally the current website). */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit("analyse:" + ip, 5, 10 * 60 * 1000)) {
    await logSecurity("rate_form", ip);
    return NextResponse.json({ ok: false, error: "Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Bitte prüfen Sie Ihre Eingaben." }, { status: 422 });
  const d = parsed.data;
  if (d.fax) return NextResponse.json({ ok: true });
  const { item } = await createRequest({
    type: "analyse",
    source: "hero",
    name: d.email.split("@")[0],
    email: d.email,
    website: d.website || undefined,
    message: d.website ? `Kostenlose Analyse für ${d.website}` : "Kostenlose Analyse angefragt",
  });
  await sendRequestNotification(item);
  return NextResponse.json({ ok: true, reference: item.reference });
}
