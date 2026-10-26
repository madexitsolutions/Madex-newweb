/**
 * Fetches public websites for the analysis without letting visitors reach
 * internal addresses (SSRF): only http(s) on the default ports, every host is
 * resolved and private, loopback and link-local addresses are refused – also
 * for each redirect. Bodies are capped and requests time out.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const USER_AGENT = "Mozilla/5.0 (compatible; MadexWebsiteAnalyse/1.0; +https://madex-it.ch/kostenlose-prufung)";
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class FetchError extends Error {}

/** "firma.ch", "www.firma.ch/x", "https://firma.ch" → URL, or null when unusable. */
export function normalizeUrl(input: string): URL | null {
  let v = input.trim();
  if (!v || v.length > 300 || /\s/.test(v)) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return null;
    if (u.port && !["80", "443"].includes(u.port)) return null;
    const host = u.hostname.toLowerCase();
    if (isIP(host) || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") return null;
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

function privateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

export function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) return privateV4(ip);
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

async function assertPublic(host: string) {
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new FetchError(`Die Adresse ${host} wurde nicht gefunden. Bitte prüfen Sie die Schreibweise.`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new FetchError("Diese Adresse kann nicht analysiert werden.");
}

export type Fetched = { url: string; status: number; headers: Headers; body: string; bytes: number; ms: number; redirects: string[] };

/** GET with SSRF checks, manual redirects, timeout and size cap. */
export async function safeFetch(input: string | URL, opts: { timeoutMs?: number; maxBytes?: number; accept?: string } = {}): Promise<Fetched> {
  const first = typeof input === "string" ? normalizeUrl(input) : input;
  if (!first) throw new FetchError("Bitte geben Sie eine gültige Website-Adresse ein, z. B. firma.ch.");
  let url: URL = first;
  const redirects: string[] = [];
  const started = Date.now();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url.hostname);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: opts.accept ?? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "accept-language": "de-CH,de;q=0.9,en;q=0.6" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      });
    } catch (e) {
      const msg = e instanceof Error && /certificate|SSL|TLS/i.test(String((e as { cause?: unknown }).cause ?? e.message)) ? "Das SSL-Zertifikat der Website ist ungültig." : "Die Website antwortet nicht oder hat zu lange gebraucht.";
      throw new FetchError(msg);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next: URL = new URL(res.headers.get("location")!, url);
      if (!["http:", "https:"].includes(next.protocol) || (next.port && !["80", "443"].includes(next.port))) throw new FetchError("Die Website leitet auf eine ungültige Adresse weiter.");
      redirects.push(next.toString());
      url = next;
      continue;
    }
    const max = opts.maxBytes ?? MAX_BYTES;
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > max) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
    return { url: url.toString(), status: res.status, headers: res.headers, body, bytes, ms: Date.now() - started, redirects };
  }
  throw new FetchError("Die Website leitet zu oft weiter.");
}

/** HEAD-like probe (small GET) that never throws: status or 0. */
export async function probe(url: string, timeoutMs = 8000): Promise<{ status: number; body: string; url: string }> {
  try {
    const r = await safeFetch(url, { timeoutMs, maxBytes: 600_000, accept: "*/*" });
    return { status: r.status, body: r.body, url: r.url };
  } catch {
    return { status: 0, body: "", url };
  }
}
