"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type FormState } from "@/lib/form-state";
import { parseMoney } from "@/lib/format";
import { parseLocalDateTime } from "@/lib/tz";
import { COUPON_TYPES, type CouponType } from "@/lib/catalog";
import { checkPermission } from "@/server/auth/session";
import { isModuleEnabled } from "@/modules/registry";
import { deleteCoupon, saveCoupon, setCouponActive } from "@/server/shop/coupons";
import { toFormState } from "@/server/shop/errors";

async function guard() {
  const user = await checkPermission("discounts.manage");
  if (!user || !(await isModuleEnabled("shop"))) return null;
  return user;
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optInt = (v: string) => (v === "" ? null : Number(v));

export async function saveCouponAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  const id = s(f, "id") || null;
  const type = (COUPON_TYPES.includes(s(f, "type") as CouponType) ? s(f, "type") : "percent") as CouponType;
  const raw = s(f, "value");
  let value = 0;
  if (type === "percent") {
    const n = Number(raw.replace(",", "."));
    if (!raw || !Number.isFinite(n)) return fail("Bitte den Rabatt in Prozent eingeben.", { value: "Zum Beispiel 10 für 10 %." });
    value = Math.round(n * 100);
  } else if (type === "fixed") {
    const cents = parseMoney(raw);
    if (cents === null) return fail("Bitte den Rabatt als Betrag eingeben.", { value: "Zum Beispiel 20.00" });
    value = cents;
  }
  const min = s(f, "minSubtotal");
  const minCents = min === "" ? null : parseMoney(min);
  if (min !== "" && minCents === null) return fail("Der Mindestbestellwert ist kein gültiger Betrag.", { minSubtotal: "Zum Beispiel 50.00" });
  const startsAt = parseLocalDateTime(s(f, "startsAt"));
  const endsAt = parseLocalDateTime(s(f, "endsAt"));
  try {
    const row = await saveCoupon(
      id,
      {
        code: s(f, "code"),
        description: s(f, "description"),
        type,
        value,
        minSubtotal: minCents,
        usageLimit: optInt(s(f, "usageLimit")),
        usageLimitPerCustomer: optInt(s(f, "usageLimitPerCustomer")),
        productIds: f.getAll("productIds").map(String).filter(Boolean),
        categoryIds: f.getAll("categoryIds").map(String).filter(Boolean),
        startsAt,
        endsAt,
        active: f.get("active") === "on",
      },
      user,
    );
    revalidatePath("/admin/gutscheine");
    if (!id) redirect(`/admin/gutscheine?bearbeiten=${row.id}&meldung=${encodeURIComponent(`Gutschein ${row.code} erstellt.`)}`);
    return ok("Gutschein gespeichert.");
  } catch (e) {
    return toFormState(e);
  }
}

export async function toggleCouponAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  const row = await setCouponActive(s(f, "id"), s(f, "active") === "1", user);
  revalidatePath("/admin/gutscheine");
  return row ? ok(row.active ? "Gutschein aktiviert." : "Gutschein deaktiviert.") : fail("Der Gutschein wurde nicht gefunden.");
}

export async function deleteCouponAction(_: FormState, f: FormData): Promise<FormState> {
  const user = await guard();
  if (!user) return fail("Keine Berechtigung.");
  await deleteCoupon(s(f, "id"), user);
  revalidatePath("/admin/gutscheine");
  redirect(`/admin/gutscheine?meldung=${encodeURIComponent("Gutschein gelöscht.")}`);
}
