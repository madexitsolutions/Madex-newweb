/** Orion in the dashboard: knowledge entries, settings and conversation figures (data lives in the Madex store). */
import { z } from "zod";
import { type KnowledgeItem } from "./orion";
import { deleteSession, listSessions, type ChatSession } from "./chats";
import { getSettings, saveSettings, type ChatbotSettings } from "./settings";
import { newId, nowIso, update } from "./store";

export const KNOWLEDGE_TYPES = ["Leistung", "Preise & Pakete", "Häufige Frage", "Unternehmen", "Sonstiges"] as const;

export const knowledgeInput = z.object({
  id: z.string().max(40).optional().default(""),
  title: z.string().trim().min(2, "Bitte einen Titel eingeben (mind. 2 Zeichen).").max(140, "Der Titel ist zu lang (max. 140 Zeichen)."),
  type: z.enum(KNOWLEDGE_TYPES).catch("Sonstiges"),
  content: z.string().trim().min(10, "Bitte den Inhalt beschreiben (mind. 10 Zeichen) – Orion antwortet nur mit dem, was hier steht.").max(8000, "Der Inhalt ist zu lang (max. 8'000 Zeichen)."),
  active: z.boolean().default(true),
});

export async function saveKnowledge(v: z.output<typeof knowledgeInput>): Promise<KnowledgeItem> {
  return update<{ items: KnowledgeItem[] }, KnowledgeItem>("knowledge", { items: [] }, (d) => {
    const existing = v.id ? d.items.find((k) => k.id === v.id) : undefined;
    const item: KnowledgeItem = { id: existing?.id ?? newId("k_"), title: v.title, type: v.type, content: v.content, active: v.active, updatedAt: nowIso() };
    if (existing) Object.assign(existing, item);
    else d.items.unshift(item);
    return item;
  });
}

export async function deleteKnowledge(id: string) {
  await update<{ items: KnowledgeItem[] }>("knowledge", { items: [] }, (d) => {
    d.items = d.items.filter((k) => k.id !== id);
  });
}

export const settingsInput = z.object({
  enabled: z.boolean(),
  assistantName: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(40),
  welcomeMessage: z.string().trim().min(5, "Bitte eine Begrüssung eingeben.").max(400),
  teaserEnabled: z.boolean(),
  teaserMessage: z.string().trim().max(300),
  teaserDelay: z.coerce.number().int().min(0, "Mindestens 0 Sekunden.").max(120, "Höchstens 120 Sekunden."),
  teaserMobile: z.boolean(),
  temperature: z.coerce.number().min(0, "Zwischen 0 und 1.").max(1, "Zwischen 0 und 1."),
  directive: z.string().max(4000, "Die Zusatzanweisungen sind zu lang (max. 4'000 Zeichen)."),
  companyProfile: z.string().max(30_000, "Das Firmenprofil ist zu lang (max. 30'000 Zeichen)."),
  retentionDays: z.coerce.number().int().min(0).max(730, "Höchstens 730 Tage."),
});

export async function saveChatbotSettings(v: z.output<typeof settingsInput>) {
  await saveSettings((s) => {
    s.chatbot = { ...s.chatbot, ...v } satisfies ChatbotSettings;
  });
}

export { deleteSession, getSettings, listSessions };

/** Figures for the conversation list. */
export function chatStats(items: ChatSession[], now = Date.now()) {
  const week = items.filter((s) => now - Date.parse(s.createdAt) < 7 * 86_400_000);
  const userMsgs = (s: ChatSession) => s.messages.filter((m) => m.role === "user").length;
  return {
    week: week.length,
    messages: week.reduce((n, s) => n + userMsgs(s), 0),
    requests: items.filter((s) => s.requestRef).length,
    unanswered: items.filter((s) => s.messages.some((m) => m.role === "assistant" && m.fallback)).length,
  };
}
