import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { metaLeadFromRequest, metaPayload, normalizePhone } from "@/server/analytics/meta";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Meta Conversions API", () => {
  it("normalises Swiss phone numbers", () => {
    expect(normalizePhone("079 123 45 67")).toBe("41791234567");
    expect(normalizePhone("+41 52 589 67 59")).toBe("41525896759");
    expect(normalizePhone("0049 170 1234567")).toBe("491701234567");
    expect(normalizePhone("123")).toBe("");
  });

  it("hashes personal data and keeps the event id", () => {
    const p = metaPayload({ name: "Lead", id: "A-2026-00031", sourceUrl: "https://madex-it.ch/kontakt", email: " Anna@Muster.CH ", phone: "079 123 45 67", firstName: "Anna", ip: "1.2.3.4", userAgent: "UA", fbp: "fb.1.x", contentName: "Kontakt" }, 1_700_000_000_000);
    const e = p.data[0];
    expect(e).toMatchObject({ event_name: "Lead", event_id: "A-2026-00031", event_time: 1_700_000_000, action_source: "website", custom_data: { content_name: "Kontakt" } });
    expect(e.user_data).toEqual({ em: [sha("anna@muster.ch")], ph: [sha("41791234567")], fn: [sha("anna")], client_ip_address: "1.2.3.4", client_user_agent: "UA", fbp: "fb.1.x" });
    expect(JSON.stringify(p)).not.toContain("muster.ch");
  });

  it("without the banner sends unless the visitor objected", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789");
    vi.stubEnv("META_CONVERSIONS_API_TOKEN", "token");
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const req = (cookie: string) => new Request("https://madex-it.ch/api/kontakt", { method: "POST", headers: { cookie } });
    metaLeadFromRequest(req("madex-consent=no"), { reference: "A-0", email: "a@b.ch", form: "Kontakt" });
    expect(fetch).not.toHaveBeenCalled();
    metaLeadFromRequest(req(""), { reference: "A-0", email: "a@b.ch", form: "Kontakt" });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it("with the banner sends only after «Zulassen»", async () => {
    vi.stubEnv("CONSENT_BANNER", "true");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123456789");
    vi.stubEnv("META_CONVERSIONS_API_TOKEN", "token");
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const req = (cookie: string) => new Request("https://madex-it.ch/api/kontakt", { method: "POST", headers: { cookie, referer: "https://madex-it.ch/kontakt", "x-forwarded-for": "5.6.7.8" } });
    const lead = { reference: "A-1", email: "a@b.ch", form: "Kontakt" };
    metaLeadFromRequest(req("madex-consent=no"), lead);
    metaLeadFromRequest(req(""), lead);
    expect(fetch).not.toHaveBeenCalled();
    metaLeadFromRequest(req("madex-consent=yes; _fbp=fb.1.abc"), lead);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/123456789/events?access_token=token");
    const body = JSON.parse(String(init.body));
    expect(body.data[0]).toMatchObject({ event_id: "A-1", event_source_url: "https://madex-it.ch/kontakt", user_data: { client_ip_address: "5.6.7.8", fbp: "fb.1.abc" } });
  });
});
