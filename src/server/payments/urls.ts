/** Customer-facing URLs used by payments and e-mails. */
import { appUrl } from "@/server/lib/app-url";
import { isModuleEnabled } from "@/modules/registry";
import { getSettings } from "@/server/settings";
import type { ReturnUrls } from "./types";

/**
 * Base of the customer pages: the built-in storefront of this installation,
 * or the connected website (general.siteUrl) when the storefront module is off.
 */
export async function shopUrl(path = "") {
  const p = path.startsWith("/") || path === "" ? path : `/${path}`;
  if (await isModuleEnabled("storefront")) return appUrl(p);
  const site = (await getSettings("general")).siteUrl.replace(/\/$/, "");
  return site ? site + p : appUrl(p);
}

/** Thank-you / order status page of an order (token-protected). */
export const orderStatusUrl = (o: { id: string; accessToken: string }) => shopUrl(`/bestellung/${o.id}?token=${encodeURIComponent(o.accessToken)}`);

/** Invoice with QR-bill, always served by this installation. */
export const invoiceUrl = (o: { id: string; accessToken: string }) => appUrl(`/bestellung/${o.id}/rechnung?token=${encodeURIComponent(o.accessToken)}`);

export async function defaultReturnUrls(o: { id: string; accessToken: string }): Promise<ReturnUrls> {
  return {
    success: await orderStatusUrl(o),
    cancel: await shopUrl(`/kasse?bestellung=${o.id}&token=${encodeURIComponent(o.accessToken)}`),
  };
}
