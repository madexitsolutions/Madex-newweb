/**
 * Periodic maintenance, triggered by GET/POST /api/cron (e.g. every 5 minutes
 * from Coolify's scheduled tasks):
 * - retries due webhook deliveries
 * - prunes expired rate-limit counters, sessions and one-time tokens
 * - deletes carts that were not touched for 30 days (items cascade)
 * - deletes login events older than 180 days and webhook deliveries older than 90 days
 * - reminds the team of enquiries whose follow-up date has come
 * - sends the weekly summary (Mondays from 07:00, see server/digest.ts)
 */
import { inArray, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { cartItems, carts, customerSessions, loginEvents, rateLimits, sessions, tokens, webhookDeliveries } from "@/server/db/schema";
import { retryDue } from "@/server/events";
import { remindFollowUps } from "@/server/content/inquiries";
import { weeklyDigestIfDue } from "@/server/digest";

const DAY = 86_400_000;

export type MaintenanceSummary = {
  webhooksRetried: number;
  rateLimitsPruned: number;
  sessionsPruned: number;
  customerSessionsPruned: number;
  tokensPruned: number;
  cartsPruned: number;
  cartItemsPruned: number;
  loginEventsPruned: number;
  deliveriesPruned: number;
  followUpsReminded: number;
  weeklyDigestSent: boolean;
  durationMs: number;
};

export async function runMaintenance(now = new Date()): Promise<MaintenanceSummary> {
  const started = Date.now();
  const webhooksRetried = await retryDue(50);
  const rl = await db.delete(rateLimits).where(lt(rateLimits.resetAt, now)).returning({ k: rateLimits.key });
  const s = await db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id });
  const cs = await db.delete(customerSessions).where(lt(customerSessions.expiresAt, now)).returning({ id: customerSessions.id });
  const t = await db.delete(tokens).where(lt(tokens.expiresAt, now)).returning({ id: tokens.id });
  const staleCarts = await db.select({ id: carts.id }).from(carts).where(lt(carts.updatedAt, new Date(now.getTime() - 30 * DAY)));
  let cartItemsPruned = 0;
  let cartsPruned = 0;
  for (let i = 0; i < staleCarts.length; i += 500) {
    const ids = staleCarts.slice(i, i + 500).map((c) => c.id);
    cartItemsPruned += (await db.delete(cartItems).where(inArray(cartItems.cartId, ids)).returning({ id: cartItems.id })).length;
    cartsPruned += (await db.delete(carts).where(inArray(carts.id, ids)).returning({ id: carts.id })).length;
  }
  const le = await db.delete(loginEvents).where(lt(loginEvents.createdAt, new Date(now.getTime() - 180 * DAY))).returning({ id: loginEvents.id });
  const wd = await db.delete(webhookDeliveries).where(lt(webhookDeliveries.createdAt, new Date(now.getTime() - 90 * DAY))).returning({ id: webhookDeliveries.id });
  return {
    webhooksRetried,
    rateLimitsPruned: rl.length,
    sessionsPruned: s.length,
    customerSessionsPruned: cs.length,
    tokensPruned: t.length,
    cartsPruned,
    cartItemsPruned,
    loginEventsPruned: le.length,
    deliveriesPruned: wd.length,
    followUpsReminded: await remindFollowUps(now).catch(() => 0),
    weeklyDigestSent: await weeklyDigestIfDue(now).catch(() => false),
    durationMs: Date.now() - started,
  };
}
