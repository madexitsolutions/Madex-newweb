import { count, desc, eq, sum } from "drizzle-orm";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { inquiries, media } from "@/server/db/schema";
import { dueFollowUps } from "@/server/content/inquiries";
import { ratedPages } from "@/server/content/seo";
import type { Settings } from "@/server/settings";
import { PROJECT } from "@/site/project";
import { RailCards, type RailData } from "./rail-cards";

/**
 * Right-hand column on wide screens (≥ 1500 px): cards that fit the page you
 * are on (newest enquiries on Anfragen, weakest pages on SEO …) and the state
 * of the website. The few figures are read here; rail-cards.tsx picks the cards.
 */
export async function Rail({ user, modules, siteUrl }: { user: CurrentUser; modules: Settings["modules"]; siteUrl: string }) {
  const can = (p: Parameters<CurrentUser["permissions"]["has"]>[0]) => user.permissions.has(p);
  const data: RailData = {
    siteUrl,
    maintenance: modules.maintenance,
    totp: user.totpEnabled,
    inquiries: null,
    seo: null,
    media: null,
  };

  const jobs: Promise<void>[] = [];
  if (modules.inquiries && can("inquiries.view"))
    jobs.push(
      (async () => {
        const [open] = await db.select({ n: count() }).from(inquiries).where(eq(inquiries.status, "new"));
        const latest = await db
          .select({ id: inquiries.id, name: inquiries.name, email: inquiries.email, subject: inquiries.subject, createdAt: inquiries.createdAt })
          .from(inquiries)
          .where(eq(inquiries.status, "new"))
          .orderBy(desc(inquiries.createdAt))
          .limit(4);
        const due = await dueFollowUps(new Date(), 4);
        data.inquiries = {
          open: open.n,
          latest: latest.map((i) => ({ id: i.id, who: i.name || i.email, subject: i.subject, at: i.createdAt.toISOString() })),
          due: due.map((i) => ({ id: i.id, who: i.name || i.email, subject: i.subject, at: i.followUpAt!.toISOString() })),
        };
      })(),
    );
  if (modules.seo && can("seo.manage") && PROJECT.seoPages)
    jobs.push(
      (async () => {
        const pages = await ratedPages(await PROJECT.seoPages!());
        const avg = pages.length ? Math.round(pages.reduce((n, p) => n + p.score, 0) / pages.length) : 0;
        const weakest = [...pages].sort((a, b) => a.score - b.score).slice(0, 3);
        data.seo = { avg, weak: pages.filter((p) => p.score < 70).length, weakest: weakest.map((p) => ({ path: p.path, title: p.title, score: p.score })) };
      })(),
    );
  if (can("media.manage"))
    jobs.push(
      (async () => {
        const [m] = await db.select({ n: count(), bytes: sum(media.size) }).from(media);
        data.media = { files: m.n, bytes: Number(m.bytes ?? 0) };
      })(),
    );
  // a failing figure only hides its card
  await Promise.allSettled(jobs);

  return <RailCards data={data} />;
}
