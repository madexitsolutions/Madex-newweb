"use client";

import { ActionForm, Submit } from "@/components/admin/forms";
import { ChoiceList, CouponCodeButton } from "@/components/admin/shop-ui";
import { centsToInput } from "@/lib/format";
import { toLocalInput } from "@/lib/tz";
import { COUPON_TYPE_LABEL, COUPON_TYPES } from "@/lib/catalog";
import type { Coupon } from "@/server/shop/coupons";
import { saveCouponAction } from "./actions";

type Item = { id: string; label: string; depth?: number };

export function CouponForm({ current, categories, products }: { current: Coupon | null; categories: Item[]; products: Item[] }) {
  return (
    <ActionForm action={saveCouponAction} className="a-stack">
      {(state) => {
        const err = (k: string) => state?.fieldErrors?.[k];
        return (
          <>
            {current && <input type="hidden" name="id" value={current.id} />}
            <div className="a-field">
              <span>Code</span>
              <div className="a-inline">
                <input name="code" defaultValue={current?.code} required maxLength={40} autoCapitalize="characters" className="a-mono-cell" aria-invalid={Boolean(err("code")) || undefined} aria-label="Code" />
                <CouponCodeButton target="code" />
              </div>
              {err("code") ? <span className="a-field__error">{err("code")}</span> : <small>Kundinnen und Kunden geben den Code an der Kasse ein. Gross-/Kleinschreibung spielt keine Rolle.</small>}
            </div>
            <label className="a-field">
              <span>
                Interne Beschreibung <em>optional</em>
              </span>
              <input name="description" defaultValue={current?.description} maxLength={500} placeholder="z. B. Newsletter Oktober" />
            </label>
            <div className="a-fields2">
              <label className="a-field">
                <span>Art</span>
                <select name="type" defaultValue={current?.type ?? "percent"}>
                  {COUPON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {COUPON_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="a-field">
                <span>Wert</span>
                <input
                  name="value"
                  inputMode="decimal"
                  defaultValue={current ? (current.type === "percent" ? String(current.value / 100) : current.type === "fixed" ? centsToInput(current.value) : "") : ""}
                  placeholder="10 (= 10 %) oder 20.00 (CHF)"
                  aria-invalid={Boolean(err("value")) || undefined}
                />
                {err("value") ? <span className="a-field__error">{err("value")}</span> : <small>Bei Gratisversand leer lassen.</small>}
              </label>
            </div>
            <div className="a-fields2">
              <label className="a-field">
                <span>
                  Mindestbestellwert <em>CHF, optional</em>
                </span>
                <input name="minSubtotal" inputMode="decimal" defaultValue={centsToInput(current?.minSubtotal)} aria-invalid={Boolean(err("minSubtotal")) || undefined} />
                {err("minSubtotal") && <span className="a-field__error">{err("minSubtotal")}</span>}
              </label>
              <label className="a-field">
                <span>
                  Einlösungen gesamt <em>optional</em>
                </span>
                <input name="usageLimit" type="number" min={1} step={1} defaultValue={current?.usageLimit ?? ""} aria-invalid={Boolean(err("usageLimit")) || undefined} />
                {err("usageLimit") && <span className="a-field__error">{err("usageLimit")}</span>}
              </label>
            </div>
            <div className="a-fields2">
              <label className="a-field">
                <span>
                  Pro Kunde <em>optional</em>
                </span>
                <input name="usageLimitPerCustomer" type="number" min={1} step={1} defaultValue={current?.usageLimitPerCustomer ?? ""} aria-invalid={Boolean(err("usageLimitPerCustomer")) || undefined} />
                {err("usageLimitPerCustomer") ? <span className="a-field__error">{err("usageLimitPerCustomer")}</span> : <small>Gezählt nach E-Mail-Adresse.</small>}
              </label>
              <span />
            </div>
            <div className="a-fields2">
              <label className="a-field">
                <span>
                  Gültig ab <em>optional</em>
                </span>
                <input name="startsAt" type="datetime-local" defaultValue={toLocalInput(current?.startsAt)} />
              </label>
              <label className="a-field">
                <span>
                  Gültig bis <em>optional</em>
                </span>
                <input name="endsAt" type="datetime-local" defaultValue={toLocalInput(current?.endsAt)} aria-invalid={Boolean(err("endsAt")) || undefined} />
                {err("endsAt") && <span className="a-field__error">{err("endsAt")}</span>}
              </label>
            </div>
            <details className="a-field" open={Boolean(current?.productIds.length || current?.categoryIds.length)}>
              <summary>Nur für bestimmte Produkte oder Kategorien</summary>
              <p className="a-small a-muted">Leer = gilt für den ganzen Warenkorb. Sonst wird der Rabatt nur auf passende Artikel berechnet.</p>
              <ChoiceList name="categoryIds" items={categories} defaultValue={current?.categoryIds ?? []} placeholder="Kategorien filtern …" empty="Noch keine Kategorien vorhanden." />
              <ChoiceList name="productIds" items={products} defaultValue={current?.productIds ?? []} placeholder="Produkte filtern …" empty="Noch keine Produkte vorhanden." />
            </details>
            <label className="a-check">
              <input type="checkbox" name="active" defaultChecked={current?.active ?? true} />
              <span>Aktiv</span>
            </label>
            <div className="a-actions">
              <Submit>{current ? "Speichern" : "Gutschein erstellen"}</Submit>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
