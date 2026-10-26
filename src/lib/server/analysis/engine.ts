/**
 * Runs a website analysis in the background of this server process: fetch,
 * page checks, Google PageSpeed (mobile + desktop, in parallel), scores and
 * the AI assessment. Progress lives in memory while the job runs (polled by
 * the report page) and every step is saved to the store, one collection per
 * report ("analyse-<id>"), so the link keeps working after a restart.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { CATEGORIES, STEPS, type AiInsights, type CategoryKey, type Check, type Lighthouse, type PagePreview, type ReportView, type StepKey, type StepState } from "@/lib/analysis";
import { read, update } from "@/lib/server/store";
import { designReview, insights } from "./ai";
import { contentChecks, designChecks, googleChecks, mobileChecks, parsePage, preview, seoChecks, speedChecks, techChecks } from "./page";
import { pagespeedConfigured, runPagespeed, type PsiResult } from "./pagespeed";
import { FetchError, safeFetch } from "./safe-fetch";
import { lighthouseChecks, scoreChecks } from "./score";

export type Report = {
  id: string;
  token: string;
  email: string;
  url: string;
  domain: string;
  createdAt: string;
  finishedAt?: string;
  status: ReportView["status"];
  error?: string;
  steps: Record<StepKey, StepState>;
  log: string[];
  page?: PagePreview;
  checks: Check[];
  scores?: Record<CategoryKey, number> & { overall: number };
  lighthouse?: { mobile?: Lighthouse; desktop?: Lighthouse };
  insights?: AiInsights;
  emailSentAt?: string;
  inquiryRef?: string;
  shots?: { mobile?: boolean; desktop?: boolean };
};

type Shots = { mobile?: string; desktop?: string };

/** Reports older than this are no longer shown. */
const KEEP_DAYS = 90;
/** A job that is neither in memory nor finished after this was cut off by a restart. */
const STALE_MS = 6 * 60_000;
const MAX_RUNNING = 6;

// on globalThis: route handlers can be bundled separately but share the process
const g = globalThis as typeof globalThis & { __madexAnalyses?: Map<string, Report> };
const running = (g.__madexAnalyses ??= new Map<string, Report>());
const name = (id: string) => `analyse-${id}`;
const validId = (id: string) => /^[a-f0-9]{20}$/.test(id);

export function createReport(url: URL, email: string): Report {
  const steps = Object.fromEntries(STEPS.map((s) => [s.key, "wait"])) as Record<StepKey, StepState>;
  const r: Report = {
    id: randomBytes(10).toString("hex"),
    token: randomBytes(18).toString("base64url"),
    email,
    url: url.toString(),
    domain: url.hostname.replace(/^www\./, ""),
    createdAt: new Date().toISOString(),
    status: "running",
    steps,
    log: [],
    checks: [],
  };
  running.set(r.id, r);
  void save(r).then(() => run(r));
  return r;
}

async function save(r: Report) {
  await update<Partial<Report>>(name(r.id), {}, (d) => {
    for (const k of Object.keys(d)) delete (d as Record<string, unknown>)[k];
    Object.assign(d, structuredClone(r));
  });
}

/** Report by id when the token matches (constant-time), else null. */
export async function getReport(id: string, token: string | null): Promise<Report | null> {
  if (!validId(id) || !token) return null;
  const r = running.get(id) ?? (await read<Report | null>(name(id), null));
  if (!r?.token) return null;
  const a = Buffer.from(r.token);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() - Date.parse(r.createdAt) > KEEP_DAYS * 86_400_000) return null;
  if (r.status === "running" && !running.has(id) && Date.now() - Date.parse(r.createdAt) > STALE_MS) {
    r.status = "failed";
    r.error = "Die Analyse wurde unterbrochen. Bitte starten Sie sie erneut.";
  }
  return r;
}

export async function markEmailSent(r: Report) {
  r.emailSentAt = new Date().toISOString();
  if (!running.has(r.id)) await save(r);
}

export async function setInquiryRef(r: Report, ref: string) {
  r.inquiryRef = ref;
  if (!running.has(r.id)) await save(r);
}

export async function getShot(id: string, which: "mobile" | "desktop"): Promise<string | null> {
  if (!validId(id)) return null;
  const s = await read<Shots>(`${name(id)}-bilder`, {});
  return s[which] ?? null;
}

const maskEmail = (e: string) => {
  const [user, host] = e.split("@");
  return `${user.slice(0, 2)}…@${host}`;
};

/** What the browser may see: no e-mail address, no token. */
export function toView(r: Report): ReportView {
  return {
    id: r.id,
    url: r.url,
    domain: r.domain,
    createdAt: r.createdAt,
    status: r.status,
    error: r.error,
    steps: r.steps,
    log: r.log,
    page: r.page,
    checks: r.checks,
    scores: r.scores,
    lighthouse: r.lighthouse,
    insights: r.insights,
    emailMasked: maskEmail(r.email),
    emailSentAt: r.emailSentAt,
    shots: r.shots,
  };
}

/* ---------------------------------------------------------------- the job */

const pause = (ms: number) => new Promise((res) => setTimeout(res, ms));
const STATUS_WORD = { ok: "in Ordnung", warn: "verbesserungsfähig", bad: "fehlt / ungenügend", info: "erkannt" } as const;

async function run(r: Report) {
  const log = (line: string) => {
    r.log.push(line);
    if (r.log.length > 120) r.log.splice(0, r.log.length - 120);
  };
  const step = async (key: StepKey, state: StepState) => {
    r.steps[key] = state;
    if (state === "run") log(`${STEPS.find((s) => s.key === key)!.running} …`);
    if (state !== "run") await save(r);
  };
  const addChecks = (list: Check[]) => {
    r.checks.push(...list);
    for (const c of list) log(`${c.status === "ok" ? "✓" : c.status === "info" ? "•" : c.status === "warn" ? "!" : "✗"} ${c.label}: ${c.value ?? STATUS_WORD[c.status]}`);
  };

  try {
    await step("fetch", "run");
    log(`Verbinde mit ${r.domain}`);
    const fetched = await safeFetch(r.url);
    if (fetched.status >= 400) throw new FetchError(`Die Website antwortet mit dem Fehler ${fetched.status}. Bitte prüfen Sie die Adresse.`);
    if (!/<html|<body|<head/i.test(fetched.body.slice(0, 20_000))) throw new FetchError("Unter dieser Adresse liegt keine Webseite (kein HTML).");
    for (const to of fetched.redirects) log(`Weiterleitung auf ${to}`);
    log(`Antwort ${fetched.status} in ${fetched.ms.toLocaleString("de-CH")} ms, ${Math.round(fetched.bytes / 1024).toLocaleString("de-CH")} KB HTML`);

    // Google needs 20–60 s per run: start both right away and collect them later
    // each screenshot is stored as soon as it arrives, so the scan can show the real page
    const shoot = (which: "mobile" | "desktop") =>
      runPagespeed(fetched.url, which).then(async (res) => {
        if (res?.screenshot) {
          await update<Shots>(`${name(r.id)}-bilder`, {}, (s) => void (s[which] = res.screenshot));
          r.shots = { ...r.shots, [which]: true };
        }
        return res;
      });
    const psi = pagespeedConfigured() ? { mobile: shoot("mobile"), desktop: shoot("desktop") } : null;

    const p = parsePage(fetched);
    r.page = preview(p);
    r.url = fetched.url;
    if (r.page.title) log(`Titel: «${r.page.title}»`);
    await step("fetch", "done");

    await step("tech", "run");
    addChecks(await techChecks(p));
    await pause(300);
    await step("tech", "done");

    await step("seo", "run");
    addChecks(seoChecks(p));
    await pause(300);
    await step("seo", "done");

    await step("google", "run");
    const google = await googleChecks(p);
    addChecks(google.checks);
    if (google.sitemapUrls) log(`Sitemap mit ${google.sitemapUrls.toLocaleString("de-CH")} Adressen gefunden`);
    await step("google", "done");

    await step("mobile", "run");
    addChecks(mobileChecks(p));
    let mobile: PsiResult | null = null;
    if (psi) {
      log("Google-Test auf dem Smartphone läuft (bis zu 60 Sekunden) …");
      mobile = await psi.mobile;
      if (mobile) log(`Google-Leistungswert Smartphone: ${mobile.performance} / 100`);
      else log("Der Google-Test für Smartphones hat nicht geantwortet – wir werten ohne ihn aus.");
    }
    await step("mobile", "done");

    await step("speed", "run");
    addChecks(speedChecks(p));
    addChecks(contentChecks(p));
    let desktop: PsiResult | null = null;
    if (psi) {
      desktop = await psi.desktop;
      if (desktop) log(`Google-Leistungswert Desktop: ${desktop.performance} / 100`);
    }
    if (mobile || desktop) {
      addChecks(lighthouseChecks(mobile, desktop));
      const strip = ({ screenshot, ...lh }: PsiResult): Lighthouse => (void screenshot, lh);
      r.lighthouse = { mobile: mobile ? strip(mobile) : undefined, desktop: desktop ? strip(desktop) : undefined };
    }
    await step("speed", "done");

    await step("design", "run");
    addChecks(await designChecks(p));
    const review = await designReview({ url: r.url, page: r.page, desktop: desktop?.screenshot, mobile: mobile?.screenshot });
    if (review) {
      log("Bildschirmfotos von Desktop und Smartphone beurteilt");
      addChecks(review);
    }
    await step("design", "done");

    await step("ai", "run");
    r.scores = scoreChecks(r.checks);
    for (const c of CATEGORIES) log(`${c.label}: ${r.scores[c.key]} Punkte`);
    const opportunities = [...(mobile?.opportunities ?? []), ...(desktop?.opportunities ?? [])].map((o) => o.title);
    r.insights = await insights({ url: r.url, page: r.page, checks: r.checks, scores: r.scores, opportunities: [...new Set(opportunities)].slice(0, 6) });
    log(`Gesamtergebnis: ${r.scores.overall} von 100 Punkten`);
    r.steps.ai = "done";
    r.status = "done";
  } catch (e) {
    r.status = "failed";
    r.error = e instanceof FetchError ? e.message : "Bei der Analyse ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.";
    if (!(e instanceof FetchError)) console.error("[analyse]", e);
    for (const s of STEPS) if (r.steps[s.key] !== "done") r.steps[s.key] = "skip";
  }
  r.finishedAt = new Date().toISOString();
  try {
    await save(r);
  } finally {
    running.delete(r.id);
  }
}

export const canStart = () => running.size < MAX_RUNNING;
