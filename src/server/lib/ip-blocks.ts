/**
 * Blocked IPs / networks (Sicherheit → Sperren). Checked on sign-in, on every
 * dashboard request (getCurrentUser) and on every API request (apiAuth).
 * The active list is cached in-process for a few seconds so the check costs
 * no query per request; changes from the dashboard clear the cache.
 */
import { gt, isNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import { ipBlocks } from "@/server/db/schema";
import { ipMatches } from "./ip";

const TTL = 10_000;
let cached: { at: number; rules: { cidr: string; expiresAt: Date | null }[] } | null = null;

export function invalidateIpBlocks() {
  cached = null;
}

async function activeRules() {
  if (cached && Date.now() - cached.at < TTL) return cached.rules;
  const rules = await db
    .select({ cidr: ipBlocks.cidr, expiresAt: ipBlocks.expiresAt })
    .from(ipBlocks)
    .where(or(isNull(ipBlocks.expiresAt), gt(ipBlocks.expiresAt, new Date())));
  cached = { at: Date.now(), rules };
  return rules;
}

/** True when the IP matches an active (not expired) block. */
export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  const now = new Date();
  return (await activeRules()).some((r) => (!r.expiresAt || r.expiresAt > now) && ipMatches(ip, r.cidr));
}
