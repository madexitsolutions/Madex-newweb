import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { settings as settingsTable } from "@/server/db/schema";
import { smtpConfig } from "@/server/mail/mailer";
import { envManaged, getSettings, saveSettings } from "@/server/settings";

afterEach(() => vi.unstubAllEnvs());

describe("settings from .env", () => {
  it("take Google Analytics and the service account from the environment", async () => {
    await saveSettings("analytics", { ga4PropertyId: "111", serviceAccountEmail: "alt@x.iam.gserviceaccount.com" });
    vi.stubEnv("GA4_PROPERTY_ID", "412345678");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "ga@madex.iam.gserviceaccount.com");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n");
    const a = await getSettings("analytics");
    expect(a).toMatchObject({ ga4PropertyId: "412345678", serviceAccountEmail: "ga@madex.iam.gserviceaccount.com" });
    expect(envManaged("analytics")).toEqual(["ga4PropertyId", "serviceAccountEmail", "serviceAccountKey"]);
  });

  it("never write environment values into the database", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://madex-it.ch");
    await saveSettings("general", { siteName: "Madex" });
    expect((await getSettings("general")).siteUrl).toBe("https://madex-it.ch");
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "general"));
    expect((row.value as { siteUrl: string }).siteUrl).toBe("");
  });

  it("read SMTP and the sender from MAIL_FROM", async () => {
    vi.stubEnv("SMTP_HOST", "mail.infomaniak.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_SECURE", "true");
    vi.stubEnv("MAIL_FROM", "Madex IT Solutions <website@madex-it.ch>");
    const c = await smtpConfig();
    expect(c).toMatchObject({ host: "mail.infomaniak.com", port: 465, secure: true, configured: true });
    expect(c.from).toBe('"Madex IT Solutions" <website@madex-it.ch>');
  });

  it("fall back to the dashboard without environment values", async () => {
    await saveSettings("analytics", { ga4PropertyId: "222" });
    expect((await getSettings("analytics")).ga4PropertyId).toBe("222");
    expect(envManaged("analytics")).toEqual([]);
  });
});
