import { afterEach, describe, expect, it, vi } from "vitest";

const sent: Record<string, unknown>[] = [];
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: async (m: Record<string, unknown>) => void sent.push(m) }) } }));

const { sendMail } = await import("@/server/mail/mailer");
const { LOGO_CID } = await import("@/server/mail/template");

afterEach(() => vi.unstubAllEnvs());

describe("e-mail logo", () => {
  it("travels inside the e-mail as inline attachment", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.ch");
    vi.stubEnv("MAIL_FROM", "Madex IT Solutions <info@madex-it.ch>");
    const r = await sendMail({ to: "chef@madex-it.ch", subject: "Test", template: "system.test", content: { title: "Der E-Mail-Versand funktioniert" } });
    expect(r.ok).toBe(true);
    const m = sent.at(-1)!;
    expect(String(m.html)).toContain(`src="cid:${LOGO_CID}"`);
    expect(String(m.html)).not.toContain("/brand/logo.png");
    const logo = (m.attachments as { cid?: string; content?: Buffer; contentDisposition?: string }[]).find((a) => a.cid === LOGO_CID);
    expect(logo?.contentDisposition).toBe("inline");
    expect(logo?.content?.subarray(1, 4).toString()).toBe("PNG");
  });
});
