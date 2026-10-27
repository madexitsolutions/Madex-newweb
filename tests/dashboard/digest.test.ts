import { desc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { emailLog, inquiries } from "@/server/db/schema";
import { buildDigest, change, lastWeek, mondayOf, weeklyDigestIfDue } from "@/server/digest";
import { saveSettings } from "@/server/settings";

describe("weekly digest", () => {
  it("knows the Zurich week", () => {
    expect(mondayOf(new Date("2026-10-26T06:00:00Z"))).toBe("2026-10-26"); // Monday 07:00 Zurich
    expect(mondayOf(new Date("2026-10-25T22:30:00Z"))).toBe("2026-10-19"); // still Sunday 23:30 Zurich
    expect(mondayOf(new Date("2026-11-01T12:00:00Z"))).toBe("2026-10-26");
    const w = lastWeek(new Date("2026-10-27T10:00:00Z"));
    expect([w.from, w.to]).toEqual(["2026-10-19", "2026-10-25"]);
  });

  it("phrases the change to the week before", () => {
    expect(change(5, 2)).toBe("+3 zur Vorwoche");
    expect(change(1, 4)).toBe("−3 zur Vorwoche");
    expect(change(0, 0)).toBe("");
    expect(change(150, 100, "pct")).toBe("+50 % zur Vorwoche");
    expect(change(3, 0, "pct")).toBe("");
  });

  it("counts last week's enquiries", async () => {
    await saveSettings("modules", { inquiries: true });
    await db.insert(inquiries).values([
      { reference: "A-1", name: "Anna", email: "a@x.ch", message: "Hallo", status: "new", createdAt: new Date("2026-10-20T09:00:00Z") },
      { reference: "A-2", name: "Ben", email: "b@x.ch", message: "Hallo", status: "quoted", createdAt: new Date("2026-10-22T09:00:00Z"), followUpAt: new Date("2026-10-25T09:00:00Z") },
      { reference: "A-3", name: "Spam", email: "s@x.ch", message: "Hallo", status: "spam", createdAt: new Date("2026-10-22T09:00:00Z") },
      { reference: "A-4", name: "Alt", email: "c@x.ch", message: "Hallo", status: "done", createdAt: new Date("2026-10-14T09:00:00Z") },
    ]);
    const d = await buildDigest(new Date("2026-10-26T08:00:00Z"));
    const sec = d.sections.find((s) => s.title === "Anfragen")!;
    expect(sec.rows[0]).toMatchObject({ label: "Neue Anfragen", value: "2", change: "+1 zur Vorwoche" });
    expect(sec.rows.find((r) => r.label === "Nachfassen fällig")?.value).toContain("Ben");
    expect(d.period).toBe("19. Oktober – 25. Oktober");
    expect(d.html).toContain("Neue Anfragen");
  });

  it("goes out once per week, from Monday 07:00", async () => {
    expect(await weeklyDigestIfDue(new Date("2026-10-26T05:30:00Z"))).toBe(false); // 06:30 Zurich – too early
    // no recipients: nothing happens
    expect(await weeklyDigestIfDue(new Date("2026-10-26T07:00:00Z"))).toBe(false);
    await saveSettings("email", { notifyWeekly: ["chef@madex-it.ch"] });
    const before = (await db.select().from(emailLog)).length;
    await weeklyDigestIfDue(new Date("2026-10-26T07:00:00Z")); // tries once (SMTP is not set up in tests → logged as skipped)
    await weeklyDigestIfDue(new Date("2026-10-27T07:00:00Z"));
    const log = await db.select().from(emailLog).where(eq(emailLog.template, "weekly_digest")).orderBy(desc(emailLog.createdAt));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ to: "chef@madex-it.ch", status: "skipped" });
    expect((await db.select().from(emailLog)).length).toBe(before + 1);
  });
});
