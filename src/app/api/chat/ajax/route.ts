/**
 * Server side of the Orion chat widget (public/chatbot/chatbot.js – the
 * unmodified script of the former WordPress plugin). The widget talks to
 * WordPress' admin-ajax.php protocol: form-encoded POST with an `action`,
 * answered as { success, data }. This route speaks exactly that protocol.
 */
import { NextResponse } from "next/server";
import { appendMessages, createSession, getSession, touchSession, type ChatMessage } from "@/lib/server/chats";
import { extractActions, nextActions, respond, UNCONFIRMED } from "@/lib/server/orion";
import { recommend, SERVICE_OPTIONS } from "@/lib/server/packages";
import { createInquiry } from "@/server/content/inquiries";
import { checkMessage, checkNewSession, clientIp, ipBlocked, logSecurity } from "@/lib/server/security";
import { getSettings } from "@/lib/server/settings";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_LABELS: Record<string, string> = { morning: "Vormittag (08:00–12:00)", midday: "Mittag (12:00–14:00)", afternoon: "Nachmittag (14:00–18:00)", flexible: "Flexibel" };

const ok = (data: unknown) => NextResponse.json({ success: true, data });
const fail = (message: string, status = 400, code?: string) => NextResponse.json({ success: false, data: { message, code } }, { status });

function format(m: ChatMessage, i: number) {
  return {
    id: m.id ?? i + 1,
    content: m.content,
    sender_type: m.role === "user" ? "user" : "ai",
    fallback: Boolean(m.fallback),
    created_at: m.at,
  };
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return fail("Ungültige Anfrage.");
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const action = str("action");
  const settings = await getSettings();
  const ip = clientIp(req);

  if (!settings.chatbot.enabled) return fail("Der Chat ist derzeit deaktiviert.", 503, "disabled");

  /* ---------------------------------------------------------- new session */
  if (action === "madex_start_session") {
    if (ipBlocked(ip, settings.security.blockedIps)) {
      await logSecurity("ip_blocked", ip, "start_session");
      return fail("Zugriff verweigert.", 403, "blocked");
    }
    const check = checkNewSession(ip, settings.security);
    if (!check.ok) {
      await logSecurity(check.reason, ip);
      return fail(check.message, 429, "rate_limited");
    }
    const { id, token } = await createSession(str("page").slice(0, 200) || undefined);
    const [welcome] = await appendMessages(id, [{ role: "assistant", content: settings.chatbot.welcomeMessage, at: new Date().toISOString() }]);
    return ok({ session_id: id, session_token: token, messages: welcome ? [format(welcome, 0)] : [], is_new: true });
  }

  /* -------------------------------------- everything else needs a session */
  const session = await getSession(str("session_id"), str("session_token"));
  if (!session) return fail("Die Chat-Sitzung ist nicht mehr gültig. Ein neues Gespräch wird gestartet.", 401, "invalid_session");
  if (session.closedAt && action !== "madex_get_messages") return fail("Dieses Gespräch wurde beendet. Ein neues Gespräch wird gestartet.", 401, "session_expired");

  switch (action) {
    case "madex_get_messages": {
      const after = Number(str("after_id")) || 0;
      const list = session.messages.map(format).filter((m) => m.id > after).slice(0, 200);
      await touchSession(session.id);
      return ok({ messages: list });
    }

    case "madex_heartbeat": {
      const last = session.lastSeen ? Date.parse(session.lastSeen) : 0;
      if (Date.now() - last > 30_000) await touchSession(session.id);
      return ok({ ok: true });
    }

    case "madex_close_session": {
      await touchSession(session.id, { closedAt: new Date().toISOString() });
      return ok({ closed: true });
    }

    case "madex_send_message": {
      const message = str("message");
      const check = checkMessage(ip, message, settings.security);
      if (!check.ok) {
        await logSecurity(check.reason, ip, message.slice(0, 80));
        const status = check.reason === "ip_blocked" ? 403 : check.reason === "too_short" || check.reason === "too_long" ? 400 : 429;
        return fail(check.message, status, check.reason);
      }
      if (!message) return fail("Bitte geben Sie eine Nachricht ein.", 400, "empty_message");

      const history = [...session.messages.slice(-12).map(({ role, content }) => ({ role, content })), { role: "user" as const, content: message }];
      let raw: string;
      let unavailable = false;
      try {
        raw = await respond(history, settings.chatbot);
      } catch (err) {
        console.error("[orion]", err);
        raw = "Der Assistent ist gerade nicht erreichbar. Sie können Ihre Anfrage direkt an das Madex-Team senden.";
        unavailable = true;
      }
      const parsed = extractActions(raw);
      const text = parsed.text || UNCONFIRMED;
      const fallback = unavailable || text.startsWith(UNCONFIRMED);
      const actions = nextActions(message, text, parsed.actions);
      const now = new Date().toISOString();
      const [userRow, aiRow] = await appendMessages(session.id, [
        { role: "user", content: message, at: now },
        { role: "assistant", content: text, at: now, actions, fallback },
      ]);
      return ok({
        user_message: format(userRow, 0),
        ai_message: format(aiRow, 0),
        actions: fallback ? [] : actions.slice(0, 3),
        fallback,
        assistant_unavailable: unavailable,
      });
    }

    case "madex_get_packages": {
      if (!rateLimit("packages:" + ip, 30, 3_600_000)) return fail("Zu viele Anfragen. Bitte versuchen Sie es später erneut.", 429, "rate_limited");
      const goals = [...new Set([...form.getAll("goals[]"), ...form.getAll("goals")].map(String).filter((g) => g in SERVICE_OPTIONS))];
      const service = str("service");
      if (service in SERVICE_OPTIONS && !goals.length) goals.push(service);
      const existing = str("existing_client");
      const hasWebsite = str("has_website");
      const companySize = parseInt(str("company_size"), 10) || undefined;
      await touchSession(session.id, {
        ...(existing === "yes" || existing === "no" ? { customerType: existing === "yes" ? ("client" as const) : ("prospect" as const) } : {}),
        ...(goals[0] ? { topic: goals[0] } : {}),
      });
      const ranked = await recommend({ goals, hasWebsite: hasWebsite === "yes" ? true : hasWebsite === "no" ? false : undefined, companySize });
      return ok({
        packages: ranked.map((p) => ({
          id: p.id,
          name: p.name,
          short_description: p.shortDescription,
          features: p.features,
          audience: p.audience,
          cta_label: "Beratung zu diesem Paket anfragen",
          matched: p.match.matched,
          missing: p.match.missing,
        })),
      });
    }

    case "madex_submit_appointment": {
      if (ipBlocked(ip, settings.security.blockedIps)) return fail("Zugriff verweigert.", 403, "blocked");
      if (!rateLimit("appointment:" + ip, 5, 3_600_000)) {
        await logSecurity("rate_appointments", ip);
        return fail("Sie haben bereits mehrere Anfragen gesendet. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt.", 429, "rate_limited");
      }
      const key = str("idempotency_key");
      const name = str("customer_name").slice(0, 191);
      const email = str("email").slice(0, 254);
      const existing = str("existing_client");
      const date = str("preferred_date");
      const time = str("preferred_time");
      const today = new Date().toISOString().slice(0, 10);
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return fail("Die Anfrage konnte nicht zugeordnet werden. Bitte versuchen Sie es erneut.", 400, "invalid_idempotency_key");
      if (name.length < 2) return fail("Bitte geben Sie Ihren vollständigen Namen ein.", 400, "customer_name_required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Bitte geben Sie eine gültige E-Mail-Adresse ein.", 400, "invalid_email");
      if (existing !== "yes" && existing !== "no") return fail("Bitte geben Sie an, ob Sie bereits Kunde sind.", 400, "invalid_customer_status");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) return fail("Bitte wählen Sie ein gültiges Datum in der Zukunft.", 400, "invalid_preferred_date");
      if (!(time in TIME_LABELS)) return fail("Bitte wählen Sie ein Zeitfenster.", 400, "preferred_time_required");
      if (!["1", "true", "yes", "on"].includes(str("privacy_consent"))) return fail("Bitte stimmen Sie der Datenverarbeitung zu.", 400, "privacy_consent_required");
      const service = str("service");
      const phone = str("phone").slice(0, 40);
      if (phone && !/^[+()\d\s/-]*$/.test(phone)) return fail("Bitte geben Sie eine gültige Telefonnummer ein.", 400, "invalid_phone");

      let reference = session.requestKey === key ? session.requestRef : undefined;
      if (!reference) {
        const fields: Record<string, string> = { Quelle: "Chat-Assistent Orion", "Bereits Kunde": existing === "yes" ? "Ja" : "Nein", Wunschdatum: date, Zeitfenster: TIME_LABELS[time] };
        if (SERVICE_OPTIONS[service]) fields["Leistung"] = SERVICE_OPTIONS[service];
        const pkg = str("package_interest").slice(0, 191);
        if (pkg) fields["Paket"] = pkg;
        const r = await createInquiry(
          {
            form: service === "analyse" ? "Kostenlose Analyse" : "Terminanfrage",
            name,
            company: str("company").slice(0, 191),
            email,
            phone,
            subject: service === "analyse" ? "Kostenlose Analyse (Chat)" : "Terminanfrage (Chat)",
            message: str("message").slice(0, 5000),
            fields,
          },
          { ip },
        );
        if (!r.ok) return fail(r.message, r.code === "rate_limited" ? 429 : 400, r.code);
        reference = r.reference;
        await touchSession(session.id, { requestRef: reference, requestKey: key, customerType: existing === "yes" ? "client" : "prospect", ...(service ? { topic: service } : {}) });
      }
      const first = name.split(/\s+/)[0];
      return ok({
        reference,
        preferred_date: date,
        preferred_time: TIME_LABELS[time],
        message: `Vielen Dank, ${first || "für Ihre Anfrage"}. Ihr Wunschtermin ist noch nicht verbindlich – das Madex-Team bestätigt ihn innerhalb eines Werktags per E-Mail.`,
      });
    }
  }
  return fail("Unbekannte Aktion.", 400, "unknown_action");
}
