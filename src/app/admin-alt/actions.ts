"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearRecoveryCodes, codeStep, logout, passwordStep, requireAdmin, reset2fa, revokeAllSessions } from "@/lib/server/auth";
import { deleteRequest, getRequest, patchRequest, STATUS_LABELS, type RequestStatus } from "@/lib/server/requests";
import { sendRequestNotification } from "@/lib/server/mailer";
import { deleteSession, purgeOlderThan } from "@/lib/server/chats";
import { saveSettings } from "@/lib/server/settings";
import { deletePackage, savePackage } from "@/lib/server/packages";
import { testConnection, type KnowledgeItem } from "@/lib/server/orion";
import { newId, nowIso, update } from "@/lib/server/store";

export type FormState = { ok?: boolean; error?: string; message?: string; recovery?: string[]; username?: string } | undefined;

const str = (f: FormData, k: string, max = 5000) => String(f.get(k) ?? "").trim().slice(0, max);
const num = (f: FormData, k: string, min: number, max: number, fallback: number) => {
  const n = Number(f.get(k));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

/* ---------- Anmeldung ---------- */

export async function loginPassword(_: FormState, f: FormData): Promise<FormState> {
  const username = str(f, "username", 200);
  const r = await passwordStep(username, String(f.get("password") ?? "").slice(0, 500));
  if (!r.ok) return { error: r.error, username };
  redirect("/admin-alt/login?step=" + r.next);
}

export async function loginCode(_: FormState, f: FormData): Promise<FormState> {
  const r = await codeStep(str(f, "code", 20));
  if (!r.ok) return { error: r.error };
  redirect(r.recovery ? "/admin-alt/wiederherstellung" : "/admin-alt");
}

export async function signOut() {
  await logout();
  redirect("/admin-alt/login");
}

export async function confirmRecoveryCodes() {
  await requireAdmin();
  await clearRecoveryCodes();
  redirect("/admin-alt");
}

/* ---------- Anfragen ---------- */

export async function setRequestStatus(id: string, f: FormData) {
  await requireAdmin();
  const to = str(f, "status") as RequestStatus;
  if (!(to in STATUS_LABELS)) return;
  await patchRequest(id, (r) => {
    if (r.status === to) return;
    r.events.push({ at: nowIso(), type: "status", from: r.status, to });
    r.status = to;
  });
  revalidatePath("/admin-alt", "layout");
}

export async function saveRequestNotes(id: string, f: FormData) {
  await requireAdmin();
  const notes = str(f, "notes", 5000);
  await patchRequest(id, (r) => {
    r.notes = notes;
    r.events.push({ at: nowIso(), type: "note" });
  });
  revalidatePath(`/admin-alt/anfragen/${id}`);
}

export async function resendRequestEmail(id: string) {
  await requireAdmin();
  const r = await getRequest(id);
  if (r) await sendRequestNotification(r);
  revalidatePath(`/admin-alt/anfragen/${id}`);
}

export async function removeRequest(id: string) {
  await requireAdmin();
  await deleteRequest(id);
  revalidatePath("/admin-alt", "layout");
  redirect("/admin-alt/anfragen");
}

/* ---------- Chats ---------- */

export async function removeChat(id: string) {
  await requireAdmin();
  await deleteSession(id);
  revalidatePath("/admin-alt/chats");
  redirect("/admin-alt/chats");
}

export async function purgeChats(days: number) {
  await requireAdmin();
  await purgeOlderThan(days);
  revalidatePath("/admin-alt/chats");
}

/* ---------- SEO ---------- */

export async function saveSeo(path: string, _: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  if (!path.startsWith("/")) return { error: "Ungültiger Pfad." };
  const title = str(f, "title", 120);
  const description = str(f, "description", 320);
  const image = str(f, "image", 500);
  const noindex = f.get("noindex") === "on";
  if (image && !/^(https:\/\/|\/)/.test(image)) return { error: "Das Bild muss eine https-Adresse oder ein Pfad wie /media/… sein." };
  await saveSettings((s) => {
    if (!title && !description && !image && !noindex) delete s.seo[path];
    else s.seo[path] = { title, description, image, noindex, updatedAt: nowIso() };
  });
  revalidatePath(path);
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin-alt/seo");
  return { ok: true, message: "Gespeichert. Die Seite verwendet die neuen Angaben ab sofort." };
}

/* ---------- Analytics ---------- */

export async function saveAnalytics(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const ga4Id = str(f, "ga4Id", 40).toUpperCase();
  const gtmId = str(f, "gtmId", 40).toUpperCase();
  if (ga4Id && !/^G-[A-Z0-9]{4,}$/.test(ga4Id)) return { error: "Die GA4-Mess-ID hat das Format G-XXXXXXXXXX." };
  if (gtmId && !/^GTM-[A-Z0-9]{4,}$/.test(gtmId)) return { error: "Die Tag-Manager-ID hat das Format GTM-XXXXXXX." };
  await saveSettings((s) => {
    s.analytics = { ga4Id, gtmId, requireConsent: f.get("requireConsent") === "on" };
  });
  revalidatePath("/admin-alt/analytics");
  return { ok: true, message: "Gespeichert. Der Tracking-Code wird auf allen Seiten geladen." };
}

/* ---------- Chatbot & Wissen ---------- */

export async function saveChatbot(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(f, "assistantName", 40);
  if (!name) return { error: "Bitte geben Sie dem Assistenten einen Namen." };
  await saveSettings((s) => {
    s.chatbot = {
      ...s.chatbot,
      enabled: f.get("enabled") === "on",
      assistantName: name,
      welcomeMessage: str(f, "welcomeMessage", 500),
      teaserEnabled: f.get("teaserEnabled") === "on",
      teaserMessage: str(f, "teaserMessage", 300),
      teaserDelay: num(f, "teaserDelay", 1, 120, 3),
      teaserMobile: f.get("teaserMobile") === "on",
      model: str(f, "model", 60) || "gpt-4o-mini",
      temperature: Math.min(1, Math.max(0, Number(f.get("temperature")) || 0)),
      directive: str(f, "directive", 4000),
      companyProfile: str(f, "companyProfile", 30000),
      retentionDays: num(f, "retentionDays", 0, 3650, 180),
    };
    s.notifyEmails = str(f, "notifyEmails", 1000)
      .split(/[,;\s]+/)
      .filter((e) => /^\S+@\S+\.\S+$/.test(e));
  });
  revalidatePath("/admin-alt/chatbot");
  return { ok: true, message: "Einstellungen gespeichert." };
}

export async function testOpenAi(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const r = await testConnection(str(f, "model", 60) || "gpt-4o-mini");
  return r.ok ? { ok: true, message: r.message } : { error: r.message };
}

export async function saveKnowledge(id: string | null, _: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const title = str(f, "title", 160);
  const content = str(f, "content", 20000);
  if (!title || !content) return { error: "Titel und Inhalt sind erforderlich." };
  await update<{ items: KnowledgeItem[] }>("knowledge", { items: [] }, (d) => {
    const item = { id: id ?? newId("kb_"), title, type: str(f, "type", 40) || "faq", content, active: f.get("active") === "on", updatedAt: nowIso() };
    const i = d.items.findIndex((x) => x.id === id);
    if (i >= 0) d.items[i] = item;
    else d.items.unshift(item);
  });
  revalidatePath("/admin-alt/chatbot");
  return { ok: true, message: "Eintrag gespeichert." };
}

export async function removeKnowledge(id: string) {
  await requireAdmin();
  await update<{ items: KnowledgeItem[] }>("knowledge", { items: [] }, (d) => {
    d.items = d.items.filter((x) => x.id !== id);
  });
  revalidatePath("/admin-alt/chatbot");
}

/* ---------- Pakete ---------- */

export async function savePackageAction(id: string | null, _: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(f, "name", 80);
  if (!name) return { error: "Bitte geben Sie einen Paketnamen ein." };
  await savePackage({
    id: id ?? undefined,
    name,
    shortDescription: str(f, "shortDescription", 400),
    audience: str(f, "audience", 400),
    features: str(f, "features", 4000)
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
    order: num(f, "order", 0, 999, 50),
    active: f.get("active") === "on",
    internalNotes: str(f, "internalNotes", 2000),
  });
  revalidatePath("/admin-alt/pakete");
  return { ok: true, message: "Paket gespeichert." };
}

export async function removePackage(id: string) {
  await requireAdmin();
  await deletePackage(id);
  revalidatePath("/admin-alt/pakete");
}

/* ---------- Sicherheit ---------- */

export async function saveSecurity(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const blockedIps = str(f, "blockedIps", 5000)
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const bad = blockedIps.find((x) => !/^[0-9a-f:.]+(\/\d{1,3})?$/i.test(x));
  if (bad) return { error: `«${bad}» ist keine gültige IP-Adresse oder CIDR-Range.` };
  await saveSettings((s) => {
    s.security = {
      perMinute: num(f, "perMinute", 1, 60, 5),
      perDay: num(f, "perDay", 1, 1000, 50),
      sessionsPerHour: num(f, "sessionsPerHour", 1, 100, 3),
      cooldownSeconds: num(f, "cooldownSeconds", 0, 60, 2),
      minLength: num(f, "minLength", 1, 100, 1),
      maxLength: num(f, "maxLength", 50, 4000, 1000),
      blockSpam: f.get("blockSpam") === "on",
      blockedIps,
    };
  });
  revalidatePath("/admin-alt/sicherheit");
  return { ok: true, message: "Sicherheitseinstellungen gespeichert." };
}

/* ---------- Konto ---------- */

export async function revokeSessions() {
  await requireAdmin();
  await revokeAllSessions();
  redirect("/admin-alt/login");
}

export async function resetTwoFactor() {
  await requireAdmin();
  await reset2fa();
  redirect("/admin-alt/login");
}
