"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fail,
  formBool,
  formString,
  ok,
  type FormState,
} from "@/lib/form-state";
import {
  deleteKnowledge,
  deleteSession,
  knowledgeInput,
  saveChatbotSettings,
  saveKnowledge,
  settingsInput,
} from "@/lib/server/chatbot-admin";
import { testConnection } from "@/lib/server/orion";
import { audit } from "@/server/audit";
import { checkPermission } from "@/server/auth/session";

const NO_RIGHT =
  "Keine Berechtigung. Dafür braucht es das Recht «Allgemeine Einstellungen und Plugins».";

const firstError = (issues: { path: PropertyKey[]; message: string }[]) => {
  const fe: Record<string, string> = {};
  for (const i of issues) fe[i.path.join(".")] ??= i.message;
  return fail(issues[0].message, fe);
};

export async function saveKnowledgeAction(
  _: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_RIGHT);
  const parsed = knowledgeInput.safeParse({
    id: formString(f, "id"),
    title: formString(f, "title"),
    type: formString(f, "type"),
    content: formString(f, "content"),
    active: formBool(f, "active"),
  });
  if (!parsed.success) return firstError(parsed.error.issues);
  const item = await saveKnowledge(parsed.data);
  await audit(
    user,
    parsed.data.id ? "chatbot.knowledge_updated" : "chatbot.knowledge_created",
    {
      entityType: "knowledge",
      entityId: item.id,
      summary: `Orion-Wissen «${item.title}» ${parsed.data.id ? "geändert" : "angelegt"}`,
    },
  );
  revalidatePath("/admin/chatbot");
  if (!parsed.data.id)
    redirect(`/admin/chatbot?tab=wissen&eintrag=${item.id}&gespeichert=1`);
  return ok(
    "Gespeichert. Orion verwendet den Eintrag ab der nächsten Antwort.",
  );
}

export async function deleteKnowledgeAction(f: FormData) {
  const user = await checkPermission("settings.manage");
  if (!user) return;
  const id = formString(f, "id");
  await deleteKnowledge(id);
  await audit(user, "chatbot.knowledge_deleted", {
    entityType: "knowledge",
    entityId: id,
    summary: "Orion-Wissenseintrag gelöscht",
  });
  revalidatePath("/admin/chatbot");
  redirect("/admin/chatbot?tab=wissen");
}

export async function saveChatbotSettingsAction(
  _: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_RIGHT);
  const parsed = settingsInput.safeParse({
    enabled: formBool(f, "enabled"),
    assistantName: formString(f, "assistantName"),
    welcomeMessage: formString(f, "welcomeMessage"),
    teaserEnabled: formBool(f, "teaserEnabled"),
    teaserMessage: formString(f, "teaserMessage"),
    teaserDelay: formString(f, "teaserDelay"),
    teaserMobile: formBool(f, "teaserMobile"),
    model: formString(f, "model"),
    temperature: formString(f, "temperature"),
    directive: formString(f, "directive"),
    companyProfile: formString(f, "companyProfile"),
    retentionDays: formString(f, "retentionDays"),
  });
  if (!parsed.success) return firstError(parsed.error.issues);
  await saveChatbotSettings(parsed.data);
  await audit(user, "chatbot.settings_updated", {
    entityType: "settings",
    entityId: "chatbot",
    summary: `Chatbot-Einstellungen geändert (${parsed.data.enabled ? "aktiv" : "ausgeschaltet"}, Modell ${parsed.data.model})`,
  });
  revalidatePath("/admin/chatbot");
  revalidatePath("/", "layout");
  return ok(
    "Gespeichert. Die Website verwendet die neuen Einstellungen beim nächsten Seitenaufruf.",
  );
}

export async function testChatbotAction(
  _: FormState,
  f: FormData,
): Promise<FormState> {
  const user = await checkPermission("settings.manage");
  if (!user) return fail(NO_RIGHT);
  const r = await testConnection(formString(f, "model") || "gpt-4o-mini");
  return r.ok
    ? ok(r.message)
    : fail(
        `${r.message} Prüfen Sie OPENAI_API_KEY in den Umgebungsvariablen (Coolify).`,
      );
}

export async function deleteChatAction(f: FormData) {
  const user = await checkPermission("inquiries.manage");
  if (!user) return;
  const id = formString(f, "id");
  await deleteSession(id);
  await audit(user, "chatbot.chat_deleted", {
    entityType: "chat",
    entityId: id,
    summary: "Chatbot-Gespräch gelöscht",
  });
  revalidatePath("/admin/chatbot");
  redirect("/admin/chatbot");
}
