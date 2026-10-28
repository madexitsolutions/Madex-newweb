import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInquiry, inquiryRecipients, remindFollowUps } from "@/server/content/inquiries";
import { db } from "@/server/db";
import { emailLog, inquiries } from "@/server/db/schema";
import { saveSettings } from "@/server/settings";

afterEach(() => vi.unstubAllEnvs());

describe("who gets which e-mail", () => {
  it("uses the list of the form, then the standard list, then CONTACT_TO_EMAIL", async () => {
    vi.stubEnv("CONTACT_TO_EMAIL", "info@madex-it.ch, buero@madex-it.ch");
    expect(await inquiryRecipients("Kontakt")).toEqual(["info@madex-it.ch", "buero@madex-it.ch"]);
    await saveSettings("email", { notifyInquiry: ["team@madex-it.ch"], notifyAnalysis: ["leads@madex-it.ch"], notifyChat: ["termine@madex-it.ch"] });
    expect(await inquiryRecipients("Kostenlose Analyse")).toEqual(["leads@madex-it.ch"]);
    expect(await inquiryRecipients("Terminanfrage")).toEqual(["termine@madex-it.ch"]);
    expect(await inquiryRecipients("Kontakt")).toEqual(["team@madex-it.ch"]);
    expect(await inquiryRecipients("API")).toEqual(["team@madex-it.ch"]);
  });

  it("sends the e-mail of a new scanner lead to the scanner list", async () => {
    await saveSettings("email", { notifyInquiry: ["team@madex-it.ch"], notifyAnalysis: ["leads@madex-it.ch"] });
    const r = await createInquiry({ form: "Kostenlose Analyse", email: "kunde@firma.ch", subject: "Website-Analyse für firma.ch", message: "Analyse gestartet" }, { ip: "1.2.3.4", now: new Date(Date.now() - 60_000) });
    expect(r.ok).toBe(true);
    const [mail] = await db.select().from(emailLog).where(eq(emailLog.template, "inquiry.staff"));
    expect(mail.to).toBe("leads@madex-it.ch");
  });

  it("e-mails due follow-ups only when recipients are set", async () => {
    const past = new Date(Date.now() - 86_400_000);
    await db.insert(inquiries).values({ reference: "A-2026-91001", email: "offerte@kunde.ch", name: "Offerte AG", status: "quoted", followUpAt: past });
    await remindFollowUps();
    expect(await db.select().from(emailLog).where(eq(emailLog.template, "inquiry.follow_up"))).toHaveLength(0);
    await saveSettings("email", { notifyFollowUp: ["chef@madex-it.ch"] });
    await db.insert(inquiries).values({ reference: "A-2026-91002", email: "zweite@kunde.ch", status: "quoted", followUpAt: past });
    await remindFollowUps();
    const mails = await db.select().from(emailLog).where(eq(emailLog.template, "inquiry.follow_up"));
    expect(mails.map((m) => [m.to, m.subject])).toEqual([["chef@madex-it.ch", "Nachfassen: zweite@kunde.ch (A-2026-91002)"]]);
  });
});
