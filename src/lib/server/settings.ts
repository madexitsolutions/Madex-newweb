import { read, update } from "./store";
import { DEFAULT_COMPANY_PROFILE } from "./company-profile";

export type ChatbotSettings = {
  enabled: boolean;
  assistantName: string;
  welcomeMessage: string;
  teaserEnabled: boolean;
  teaserMessage: string;
  teaserDelay: number;
  teaserMobile: boolean;
  model: string;
  temperature: number;
  directive: string; // extra instructions appended to the system prompt
  companyProfile: string; // empty = default profile
  retentionDays: number;
};

export type SecuritySettings = {
  perMinute: number;
  perDay: number;
  sessionsPerHour: number;
  cooldownSeconds: number;
  minLength: number;
  maxLength: number;
  blockSpam: boolean;
  blockedIps: string[];
};

export type AnalyticsSettings = { ga4Id: string; gtmId: string; requireConsent: boolean };

export type SeoOverride = { title?: string; description?: string; image?: string; noindex?: boolean; updatedAt?: string };

export type Settings = {
  chatbot: ChatbotSettings;
  security: SecuritySettings;
  analytics: AnalyticsSettings;
  seo: Record<string, SeoOverride>;
  notifyEmails: string[];
};

export const defaultSettings: Settings = {
  chatbot: {
    enabled: true,
    assistantName: "Orion",
    welcomeMessage: "Hallo, ich bin Orion, der KI-Assistent von Madex IT Solutions. Wie kann ich Ihnen helfen?",
    teaserEnabled: true,
    teaserMessage: "Hallo, ich bin Orion, der KI-Assistent von Madex IT Solutions 👋 Haben Sie Fragen? Ich berate Sie gerne.",
    teaserDelay: 3,
    teaserMobile: false,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    directive: "",
    companyProfile: "",
    retentionDays: 180,
  },
  security: { perMinute: 5, perDay: 50, sessionsPerHour: 3, cooldownSeconds: 2, minLength: 1, maxLength: 1000, blockSpam: true, blockedIps: [] },
  analytics: { ga4Id: "", gtmId: "", requireConsent: true },
  seo: {},
  notifyEmails: [],
};

export async function getSettings(): Promise<Settings> {
  const s = await read<Partial<Settings>>("settings", {});
  return {
    // the AI model is set in .env (OPENAI_MODEL) – it wins over an older value from the dashboard
    chatbot: { ...defaultSettings.chatbot, ...s.chatbot, ...(process.env.OPENAI_MODEL?.trim() ? { model: process.env.OPENAI_MODEL.trim() } : {}) },
    security: { ...defaultSettings.security, ...s.security },
    analytics: { ...defaultSettings.analytics, ...s.analytics },
    seo: s.seo ?? {},
    notifyEmails: s.notifyEmails ?? [],
  };
}

export async function saveSettings(patch: (s: Settings) => void) {
  await update<Partial<Settings>>("settings", {}, async (raw) => {
    const full = await getSettingsFrom(raw);
    patch(full);
    Object.assign(raw, full);
  });
}

async function getSettingsFrom(s: Partial<Settings>): Promise<Settings> {
  return {
    chatbot: { ...defaultSettings.chatbot, ...s.chatbot },
    security: { ...defaultSettings.security, ...s.security },
    analytics: { ...defaultSettings.analytics, ...s.analytics },
    seo: s.seo ?? {},
    notifyEmails: s.notifyEmails ?? [],
  };
}

export function companyProfile(s: ChatbotSettings) {
  return s.companyProfile.trim() ? s.companyProfile : DEFAULT_COMPANY_PROFILE;
}

/** Effective tracking IDs: set in .env (NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_GTM_ID); an older dashboard value is the fallback. */
export function analyticsIds(a: AnalyticsSettings) {
  return {
    ga4Id: (process.env.NEXT_PUBLIC_GA4_ID || a.ga4Id || "").trim(),
    gtmId: (process.env.NEXT_PUBLIC_GTM_ID || a.gtmId || "").trim(),
  };
}
