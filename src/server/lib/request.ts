import { headers } from "next/headers";

/** Client IP and user agent of the current request (behind a proxy when TRUST_PROXY=true). */
export async function requestInfo() {
  const h = await headers();
  const forwarded = process.env.TRUST_PROXY !== "false" ? h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") : null;
  const ip = forwarded || "unknown";
  // behind a proxy the scheme comes from X-Forwarded-Proto; without it, from the browser's own Origin/Referer
  const proto = h.get("x-forwarded-proto");
  const https = proto ? proto.includes("https") : (h.get("origin") || h.get("referer") || "").startsWith("https:");
  return { ip, userAgent: (h.get("user-agent") || "").slice(0, 200), https };
}

export function ipFromRequest(req: Request) {
  const forwarded = process.env.TRUST_PROXY !== "false" ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") : null;
  return forwarded || "unknown";
}

/** Masks the last part of an IP for display/logs that don't need the full address. */
export function maskIp(ip: string) {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":…";
  return ip.replace(/\.\d+$/, ".x");
}
