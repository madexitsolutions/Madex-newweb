import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { inquiries, notifications } from "@/server/db/schema";
import { dueFollowUps, remindFollowUps } from "@/server/content/inquiries";

const DAY = 86_400_000;

describe("follow-up reminders", () => {
  it("reminds once per due enquiry and skips closed ones", async () => {
    const now = new Date();
    await db.insert(inquiries).values([
      { reference: "A-2026-90001", email: "offerte@kunde.ch", name: "Offerte", status: "quoted", followUpAt: new Date(now.getTime() - DAY) },
      { reference: "A-2026-90002", email: "spaeter@kunde.ch", status: "quoted", followUpAt: new Date(now.getTime() + DAY) },
      { reference: "A-2026-90003", email: "fertig@kunde.ch", status: "done", followUpAt: new Date(now.getTime() - DAY) },
    ]);
    expect((await dueFollowUps(now)).map((q) => q.reference)).toEqual(["A-2026-90001"]);
    expect(await remindFollowUps(now)).toBe(1);
    expect(await remindFollowUps(now)).toBe(0);
    const sent = await db.select().from(notifications).where(eq(notifications.type, "inquiry.follow_up"));
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe("Nachfassen: Offerte");
    expect(sent[0].permission).toBe("inquiries.manage");
  });
});
