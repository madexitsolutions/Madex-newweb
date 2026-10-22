"use client";

import { useState, type ReactNode } from "react";
import { ActionForm, CopyButton, Submit } from "@/components/admin/forms";
import { FormSection, Icon } from "@/components/admin/kit";
import { IbanInput } from "@/components/admin/shop-ui";
import { centsToInput } from "@/lib/format";
import { formatIban } from "@/lib/iban";
import type { FormState } from "@/lib/form-state";
import type { Settings } from "@/server/settings";
import {
  saveCheckoutAction,
  saveMethodAction,
  savePaymentsAction,
  saveShipToAction,
  saveShopGeneralAction,
  saveTaxClassAction,
  saveTaxDisplayAction,
  saveZoneAction,
} from "./actions";

type Shop = Settings["shop"];

/** Small hint below a field, replaced by the error when there is one. */
function Hint({ state, name, children }: { state: FormState; name: string; children?: ReactNode }) {
  const err = state?.fieldErrors?.[name];
  if (err) return <span className="a-field__error">{err}</span>;
  return children ? <small>{children}</small> : null;
}
const invalid = (state: FormState, name: string) => Boolean(state?.fieldErrors?.[name]) || undefined;

/* ================================================================ general */

export function GeneralForm({ shop, nextNumber, storefront }: { shop: Shop; nextNumber: number; storefront: boolean }) {
  return (
    <ActionForm action={saveShopGeneralAction} className="a-form">
      {(state) => (
        <>
          <FormSection title="Shop-Seiten der Website" help="Die eingebauten Seiten /shop, /produkt/…, /warenkorb und /kasse. Ausschalten, wenn eine eigene App (z. B. Mobile-App) den Shop über die API nutzt.">
            <label className="a-check a-check--box">
              <input type="checkbox" name="storefront" defaultChecked={storefront} />
              <span>
                Eingebaute Shop-Seiten verwenden
                <small>Ohne Haken bleibt nur der Verkauf über die API und das Dashboard.</small>
              </span>
            </label>
          </FormSection>
          <FormSection title="Bestellnummern" help="Bestellnummern sind fortlaufend und lückenlos. Sie können sie nur erhöhen, nie zurücksetzen.">
            <div className="a-fields2">
              <label className="a-field">
                <span>
                  Präfix <em>optional</em>
                </span>
                <input name="orderPrefix" defaultValue={shop.orderPrefix} maxLength={10} placeholder="z. B. SH-" aria-invalid={invalid(state, "orderPrefix")} />
                <Hint state={state} name="orderPrefix">
                  Erscheint vor der Nummer, z. B. SH-{nextNumber}.
                </Hint>
              </label>
              <label className="a-field">
                <span>Startnummer</span>
                <input name="orderNumberStart" type="number" min={1} step={1} defaultValue={shop.orderNumberStart} aria-invalid={invalid(state, "orderNumberStart")} />
                <Hint state={state} name="orderNumberStart">
                  Nächste Bestellung: {shop.orderPrefix}
                  {nextNumber}
                </Hint>
              </label>
            </div>
          </FormSection>
          <FormSection title="Sortiment" help="Wie Produkte im Shop erscheinen und wann das Dashboard vor knappem Lager warnt.">
            <div className="a-fields2">
              <label className="a-field">
                <span>Warnung bei Lagerbestand ab</span>
                <input name="lowStockThreshold" type="number" min={0} step={1} defaultValue={shop.lowStockThreshold} aria-invalid={invalid(state, "lowStockThreshold")} />
                <Hint state={state} name="lowStockThreshold">
                  Stück oder weniger gelten als «knapp».
                </Hint>
              </label>
              <label className="a-field">
                <span>Produkte pro Seite</span>
                <input name="productsPerPage" type="number" min={4} max={200} step={1} defaultValue={shop.productsPerPage} aria-invalid={invalid(state, "productsPerPage")} />
                <Hint state={state} name="productsPerPage">
                  In den Shop-Seiten und der API.
                </Hint>
              </label>
            </div>
            <label className="a-check">
              <input type="checkbox" name="showOutOfStock" defaultChecked={shop.showOutOfStock} />
              <span>
                Ausverkaufte Produkte anzeigen
                <small>Sie bleiben sichtbar, können aber nicht in den Warenkorb gelegt werden (ausser bei erlaubter Nachbestellung).</small>
              </span>
            </label>
          </FormSection>
          <FormSection title="Benachrichtigungen" help="Wer bei jeder neuen Bestellung eine E-Mail erhält. Eine Adresse pro Zeile. Zusätzlich gelten die Empfänger unter Einstellungen → E-Mail.">
            <label className="a-field">
              <span>
                E-Mail bei neuer Bestellung <em>optional</em>
              </span>
              <textarea name="orderNotifyEmails" rows={3} defaultValue={shop.orderNotifyEmails.join("\n")} placeholder="shop@kunde.ch" aria-invalid={invalid(state, "orderNotifyEmails")} />
              <Hint state={state} name="orderNotifyEmails" />
            </label>
          </FormSection>
          <FormSection title="Rechnungen" help="Text am Ende jeder Rechnung und jedes Lieferscheins, z. B. Dank oder Hinweise zur Rücksendung.">
            <label className="a-field">
              <span>
                Fusszeile <em>optional</em>
              </span>
              <textarea name="invoiceFooter" rows={3} maxLength={500} defaultValue={shop.invoiceFooter} placeholder="Vielen Dank für Ihren Einkauf!" aria-invalid={invalid(state, "invoiceFooter")} />
              <Hint state={state} name="invoiceFooter" />
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/* ================================================================ checkout */

export function CheckoutForm({ shop }: { shop: Shop }) {
  return (
    <ActionForm action={saveCheckoutAction} className="a-form">
      {(state) => (
        <>
          <FormSection title="Kundenkonto" help="Mit Gastbestellung kann man ohne Registrierung bestellen. Das senkt Kaufabbrüche deutlich.">
            <label className="a-check">
              <input type="checkbox" name="guestCheckout" defaultChecked={shop.guestCheckout} />
              <span>
                Bestellen ohne Kundenkonto erlauben
                <small>Ohne Häkchen müssen sich Kundinnen und Kunden vor der Bestellung registrieren oder anmelden.</small>
              </span>
            </label>
          </FormSection>
          <FormSection title="Rechtliches" help="Die Links erscheinen an der Kasse und in der Bestellbestätigung. Sie können eine volle Adresse oder einen Pfad Ihrer Website angeben.">
            <label className="a-check">
              <input type="checkbox" name="requireTerms" defaultChecked={shop.requireTerms} />
              <span>
                AGB müssen akzeptiert werden
                <small>An der Kasse erscheint ein Kästchen «Ich akzeptiere die AGB», ohne das nicht bestellt werden kann.</small>
              </span>
            </label>
            <div className="a-fields2">
              <label className="a-field">
                <span>Adresse der AGB</span>
                <input name="termsUrl" defaultValue={shop.termsUrl} placeholder="https://www.kunde.ch/agb" inputMode="url" aria-invalid={invalid(state, "termsUrl")} />
                <Hint state={state} name="termsUrl" />
              </label>
              <label className="a-field">
                <span>
                  Adresse der Datenschutzerklärung <em>optional</em>
                </span>
                <input name="privacyUrl" defaultValue={shop.privacyUrl} placeholder="https://www.kunde.ch/datenschutz" inputMode="url" aria-invalid={invalid(state, "privacyUrl")} />
                <Hint state={state} name="privacyUrl" />
              </label>
            </div>
          </FormSection>
          <FormSection title="Texte an der Kasse" help="Kurze Hinweise, die Kundinnen und Kunden vor dem Bestellen sehen.">
            <label className="a-field">
              <span>
                Hinweis an der Kasse <em>optional</em>
              </span>
              <textarea name="checkoutNote" rows={2} maxLength={1000} defaultValue={shop.checkoutNote} placeholder="z. B. Lieferungen erfolgen innerhalb von 2–3 Werktagen." aria-invalid={invalid(state, "checkoutNote")} />
              <Hint state={state} name="checkoutNote" />
            </label>
            <label className="a-field">
              <span>
                Rückgabe und Umtausch <em>optional</em>
              </span>
              <textarea name="returnPolicy" rows={4} maxLength={2000} defaultValue={shop.returnPolicy} placeholder="z. B. Ungetragene Artikel können innerhalb von 14 Tagen zurückgesendet werden." aria-invalid={invalid(state, "returnPolicy")} />
              <Hint state={state} name="returnPolicy">
                Erscheint an der Kasse und in der Bestellbestätigung.
              </Hint>
            </label>
          </FormSection>
          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/* ================================================================ taxes */

export function TaxDisplayForm({ includeTax }: { includeTax: boolean }) {
  return (
    <ActionForm action={saveTaxDisplayAction} className="a-stack">
      <fieldset className="s-fieldset a-stack">
        <legend className="sr-only">Preiseingabe</legend>
        <label className="a-check a-check--box">
          <input type="radio" name="pricesIncludeTax" value="1" defaultChecked={includeTax} />
          <span>
            Preise inklusive MWST
            <small>Üblich für Endkunden (B2C). Die eingegebenen Preise sind Endpreise, die MWST wird herausgerechnet.</small>
          </span>
        </label>
        <label className="a-check a-check--box">
          <input type="radio" name="pricesIncludeTax" value="0" defaultChecked={!includeTax} />
          <span>
            Preise exklusive MWST
            <small>Üblich für Firmenkunden (B2B). Die MWST wird an der Kasse dazugerechnet.</small>
          </span>
        </label>
      </fieldset>
      <div className="a-actions">
        <Submit>Speichern</Submit>
      </div>
    </ActionForm>
  );
}

export function TaxClassForm({ current }: { current: { id: string; name: string; rateBp: number; isDefault: boolean } | null }) {
  return (
    <ActionForm action={saveTaxClassAction} className="a-stack">
      {(state) => (
        <>
          {current && <input type="hidden" name="id" value={current.id} />}
          <label className="a-field">
            <span>Name</span>
            <input name="name" defaultValue={current?.name} required maxLength={80} placeholder="z. B. Normalsatz" aria-invalid={invalid(state, "name")} />
            <Hint state={state} name="name" />
          </label>
          <label className="a-field a-field--short">
            <span>Steuersatz in %</span>
            <input name="rate" inputMode="decimal" defaultValue={current ? String(current.rateBp / 100) : ""} placeholder="8.1" aria-invalid={invalid(state, "rateBp")} />
            <Hint state={state} name="rateBp">
              Schweiz 2024: 8.1 (Normalsatz), 2.6 (reduziert), 3.8 (Beherbergung).
            </Hint>
          </label>
          {!current?.isDefault && (
            <label className="a-check">
              <input type="checkbox" name="isDefault" />
              <span>
                Als Standard verwenden
                <small>Gilt für alle Produkte und Versandarten ohne eigene Steuerklasse.</small>
              </span>
            </label>
          )}
          <div className="a-actions">
            <Submit>{current ? "Speichern" : "Steuerklasse erstellen"}</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/* ================================================================ shipping */

export function ShipToForm({ countries }: { countries: string[] }) {
  return (
    <ActionForm action={saveShipToAction} className="a-stack">
      {(state) => (
        <>
          <label className="a-field">
            <span>Lieferländer</span>
            <input name="shipToCountries" defaultValue={countries.join(", ")} placeholder="CH, LI" autoCapitalize="characters" spellCheck={false} aria-invalid={invalid(state, "") || undefined} />
            <Hint state={state} name="">
              Ländercodes mit Komma getrennt. Das erste Land ist an der Kasse vorausgewählt. Leer = alle Länder, für die es eine Versandart gibt.
            </Hint>
          </label>
          <div className="a-actions">
            <Submit variant="ghost">Lieferländer speichern</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function ZoneForm({ current }: { current: { id: string; name: string; countries: string[]; sort: number } | null }) {
  return (
    <ActionForm action={saveZoneAction} className="a-stack">
      {(state) => (
        <>
          {current && <input type="hidden" name="id" value={current.id} />}
          <label className="a-field">
            <span>Name</span>
            <input name="name" defaultValue={current?.name} required maxLength={100} placeholder="z. B. Schweiz & Liechtenstein" aria-invalid={invalid(state, "name")} />
            <Hint state={state} name="name" />
          </label>
          <label className="a-field">
            <span>Länder</span>
            <input name="countries" defaultValue={current?.countries.join(", ")} placeholder="CH, LI" autoCapitalize="characters" spellCheck={false} aria-invalid={invalid(state, "countries")} />
            <Hint state={state} name="countries">
              Ländercodes mit Komma getrennt. * steht für alle übrigen Länder.
            </Hint>
          </label>
          <label className="a-field a-field--short">
            <span>Reihenfolge</span>
            <input name="sort" type="number" step={1} defaultValue={current?.sort ?? 0} />
          </label>
          <div className="a-actions">
            <Submit>{current ? "Speichern" : "Zone erstellen"}</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

type MethodValue = {
  id: string;
  zoneId: string;
  name: string;
  description: string;
  type: "flat" | "free" | "pickup" | "weight";
  price: number;
  freeAbove: number | null;
  weightRates: { upToGrams: number; price: number }[];
  minSubtotal: number | null;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  taxClassId: string | null;
  active: boolean;
  sort: number;
};

const TYPE_HELP: Record<MethodValue["type"], string> = {
  flat: "Fester Preis pro Bestellung.",
  weight: "Preis nach Gesamtgewicht der Bestellung (Gewicht der Varianten).",
  free: "Immer kostenlos.",
  pickup: "Abholung im Geschäft. Ermöglicht die Zahlungsart «Barzahlung bei Abholung».",
};

export function MethodForm({ current, zoneId, zones, taxClasses }: { current: MethodValue | null; zoneId: string; zones: { id: string; name: string }[]; taxClasses: { id: string; name: string }[] }) {
  const [type, setType] = useState<MethodValue["type"]>(current?.type ?? "flat");
  const [rates, setRates] = useState(() => (current?.weightRates.length ? current.weightRates.map((r) => ({ upTo: String(r.upToGrams), price: centsToInput(r.price) })) : [{ upTo: "", price: "" }]));
  return (
    <ActionForm action={saveMethodAction} className="a-stack">
      {(state) => (
        <>
          {current && <input type="hidden" name="id" value={current.id} />}
          <label className="a-field">
            <span>Zone</span>
            <select name="zoneId" defaultValue={current?.zoneId ?? zoneId}>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </label>
          <label className="a-field">
            <span>Name</span>
            <input name="name" defaultValue={current?.name} required maxLength={100} placeholder="z. B. PostPac Economy" aria-invalid={invalid(state, "name")} />
            <Hint state={state} name="name">
              So sehen Kundinnen und Kunden die Versandart an der Kasse.
            </Hint>
          </label>
          <label className="a-field">
            <span>
              Beschreibung <em>optional</em>
            </span>
            <input name="description" defaultValue={current?.description} maxLength={300} placeholder="z. B. Zustellung mit der Post" />
          </label>
          <label className="a-field">
            <span>Art</span>
            <select name="type" value={type} onChange={(e) => setType(e.target.value as MethodValue["type"])}>
              <option value="flat">Pauschal</option>
              <option value="weight">Nach Gewicht</option>
              <option value="free">Gratis</option>
              <option value="pickup">Abholung</option>
            </select>
            <small>{TYPE_HELP[type]}</small>
          </label>
          {(type === "flat" || type === "pickup") && (
            <label className="a-field a-field--short">
              <span>Preis CHF</span>
              <input name="price" inputMode="decimal" defaultValue={centsToInput(current?.price ?? (type === "pickup" ? 0 : null))} placeholder="9.00" aria-invalid={invalid(state, "price")} />
              <Hint state={state} name="price" />
            </label>
          )}
          {type === "weight" && (
            <div className="a-field">
              <span>Gewichtsstufen</span>
              <div className="s-rates">
                {rates.map((r, i) => (
                  <div key={i} className="s-rate">
                    <label className="a-field">
                      <span className={i ? "sr-only" : undefined}>Bis Gramm</span>
                      <input name="rateUpTo" inputMode="numeric" value={r.upTo} onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)))} placeholder="2000" aria-label={`Stufe ${i + 1}: bis Gramm`} />
                    </label>
                    <label className="a-field">
                      <span className={i ? "sr-only" : undefined}>Preis CHF</span>
                      <input name="ratePrice" inputMode="decimal" value={r.price} onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} placeholder="9.00" aria-label={`Stufe ${i + 1}: Preis CHF`} />
                    </label>
                    <button type="button" className="s-iconbtn s-iconbtn--danger" aria-label={`Stufe ${i + 1} entfernen`} disabled={rates.length === 1} onClick={() => setRates(rates.filter((_, j) => j !== i))}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => setRates([...rates, { upTo: "", price: "" }])}>
                  <Icon name="plus" size={14} />
                  Stufe hinzufügen
                </button>
              </div>
              <Hint state={state} name="weightRates">
                Schwerere Bestellungen als die letzte Stufe können diese Versandart nicht wählen.
              </Hint>
            </div>
          )}
          {(type === "flat" || type === "weight") && (
            <label className="a-field a-field--short">
              <span>
                Gratis ab CHF <em>optional</em>
              </span>
              <input name="freeAbove" inputMode="decimal" defaultValue={centsToInput(current?.freeAbove)} placeholder="100.00" aria-invalid={invalid(state, "freeAbove")} />
              <Hint state={state} name="freeAbove">
                Warenwert, ab dem der Versand nichts kostet.
              </Hint>
            </label>
          )}
          <label className="a-field a-field--short">
            <span>
              Mindestbestellwert CHF <em>optional</em>
            </span>
            <input name="minSubtotal" inputMode="decimal" defaultValue={centsToInput(current?.minSubtotal)} aria-invalid={invalid(state, "minSubtotal")} />
            <Hint state={state} name="minSubtotal">
              Darunter wird die Versandart nicht angeboten.
            </Hint>
          </label>
          <div className="a-fields2">
            <label className="a-field">
              <span>
                Lieferzeit von (Tage) <em>optional</em>
              </span>
              <input name="deliveryDaysMin" type="number" min={0} max={365} defaultValue={current?.deliveryDaysMin ?? ""} />
            </label>
            <label className="a-field">
              <span>
                bis (Tage) <em>optional</em>
              </span>
              <input name="deliveryDaysMax" type="number" min={0} max={365} defaultValue={current?.deliveryDaysMax ?? ""} aria-invalid={invalid(state, "deliveryDaysMax")} />
              <Hint state={state} name="deliveryDaysMax" />
            </label>
          </div>
          <label className="a-field">
            <span>Steuerklasse</span>
            <select name="taxClassId" defaultValue={current?.taxClassId ?? ""}>
              <option value="">Standard-Steuerklasse</option>
              {taxClasses.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="a-fields2">
            <label className="a-check a-check--inline">
              <input type="checkbox" name="active" defaultChecked={current?.active ?? true} />
              <span>Aktiv</span>
            </label>
            <label className="a-field a-field--short">
              <span>Reihenfolge</span>
              <input name="sort" type="number" step={1} defaultValue={current?.sort ?? 0} />
            </label>
          </div>
          <div className="a-actions">
            <Submit>{current ? "Speichern" : "Versandart erstellen"}</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/* ================================================================ payments */

type SecretKey = "stripeSecretKey" | "stripeWebhookSecret" | "payrexxApiSecret";
type PaymentsValue = Settings["payments"];
type Readiness = { key: string; enabled: boolean; problems: string[] };

function SecretInput({ state, name, label, stored, placeholder }: { state: FormState; name: SecretKey; label: string; stored: string; placeholder: string }) {
  return (
    <div className="s-secret">
      <label className="a-field">
        <span>{label}</span>
        <input name={name} type="password" autoComplete="new-password" spellCheck={false} className="a-mono" placeholder={stored ? `Gespeichert (${stored})` : placeholder} aria-invalid={invalid(state, name)} />
        <Hint state={state} name={name}>
          {stored ? "Leer lassen, um den gespeicherten Wert zu behalten." : "Wird verschlüsselt gespeichert und nie wieder angezeigt."}
        </Hint>
      </label>
      {stored && (
        <label className="a-check s-secret__hint">
          <input type="checkbox" name={`remove_${name}`} />
          <span>Gespeicherten Wert entfernen</span>
        </label>
      )}
    </div>
  );
}

function Status({ r }: { r?: Readiness }) {
  if (!r) return null;
  if (!r.enabled) return <span className="a-pill a-pill--muted">Aus</span>;
  return r.problems.length ? <span className="a-pill a-pill--warn">Unvollständig</span> : <span className="a-pill a-pill--ok">Aktiv</span>;
}

function Problems({ r }: { r?: Readiness }) {
  if (!r?.enabled || !r.problems.length) return null;
  return (
    <ul className="s-issues">
      {r.problems.map((p) => (
        <li key={p} className="is-warn">
          <Icon name="alert" size={14} className="a-ico" />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

function WebhookUrl({ url }: { url: string }) {
  return (
    <div className="a-field">
      <span>Webhook-Adresse</span>
      <div className="s-url">
        <code>{url}</code>
        <CopyButton value={url} />
      </div>
    </div>
  );
}

export function PaymentsForm({ p, secrets, readiness, webhooks }: { p: PaymentsValue; secrets: Record<SecretKey, string>; readiness: Readiness[]; webhooks: { stripe: string; payrexx: string } }) {
  const r = (k: string) => readiness.find((x) => x.key === k);
  const title = (label: string, k: string) => (
    <span className="a-inline">
      {label} <Status r={r(k)} />
    </span>
  );
  return (
    <ActionForm action={savePaymentsAction} className="a-form">
      {(state) => (
        <>
          <FormSection title="Bankkonto" help="Für Vorauskasse und Rechnung (QR-Einzahlungsschein). Die Absenderadresse kommt aus Einstellungen → Allgemein.">
            <div className="a-fields2">
              <label className="a-field">
                <span>Kontoinhaber</span>
                <input name="bankAccountHolder" defaultValue={p.bankAccountHolder} maxLength={70} placeholder="Muster AG" aria-invalid={invalid(state, "bankAccountHolder")} />
                <Hint state={state} name="bankAccountHolder">
                  Leer = Firmenname aus den allgemeinen Einstellungen.
                </Hint>
              </label>
              <label className="a-field">
                <span>
                  Bank <em>optional</em>
                </span>
                <input name="bankName" defaultValue={p.bankName} maxLength={100} placeholder="z. B. PostFinance" />
              </label>
            </div>
            <label className="a-field">
              <span>IBAN</span>
              <IbanInput name="bankIban" defaultValue={formatIban(p.bankIban)} />
              <Hint state={state} name="bankIban" />
            </label>
          </FormSection>

          <FormSection title="Vorauskasse" help="Die Kundin überweist vor dem Versand. Die Bestellung bleibt offen, bis Sie den Zahlungseingang bestätigen.">
            <div className="a-stack">
              {title("Vorauskasse", "bank_transfer")}
              <label className="a-check">
                <input type="checkbox" name="bankTransferEnabled" defaultChecked={p.bankTransferEnabled} />
                <span>Vorauskasse anbieten</span>
              </label>
              <label className="a-field">
                <span>
                  Zusätzlicher Hinweis <em>optional</em>
                </span>
                <textarea name="bankInstructions" rows={2} maxLength={1000} defaultValue={p.bankInstructions} placeholder="z. B. Wir versenden nach Zahlungseingang, meist innert 2 Werktagen." aria-invalid={invalid(state, "bankInstructions")} />
                <Hint state={state} name="bankInstructions" />
              </label>
              <Problems r={r("bank_transfer")} />
            </div>
          </FormSection>

          <FormSection title="Rechnung" help="Versand vor der Zahlung, mit QR-Einzahlungsschein. Die Rechnung ist im Kundenkonto und per Link abrufbar.">
            <div className="a-stack">
              {title("Rechnung", "invoice")}
              <label className="a-check">
                <input type="checkbox" name="invoiceEnabled" defaultChecked={p.invoiceEnabled} />
                <span>Kauf auf Rechnung anbieten</span>
              </label>
              <label className="a-field a-field--short">
                <span>Zahlungsfrist (Tage)</span>
                <input name="invoiceDueDays" type="number" min={1} max={120} defaultValue={p.invoiceDueDays} aria-invalid={invalid(state, "invoiceDueDays")} />
                <Hint state={state} name="invoiceDueDays" />
              </label>
              <label className="a-check">
                <input type="checkbox" name="invoiceOnlyForCustomers" defaultChecked={p.invoiceOnlyForCustomers} />
                <span>
                  Nur für angemeldete Kundinnen und Kunden
                  <small>Senkt das Risiko unbezahlter Rechnungen bei Erstbestellungen.</small>
                </span>
              </label>
              <Problems r={r("invoice")} />
            </div>
          </FormSection>

          <FormSection title="Stripe" help="Karten, TWINT, Apple Pay und Google Pay – je nachdem, was im Stripe-Konto aktiviert ist. Erst ab CHF 0.50 Bestellwert.">
            <div className="a-stack">
              {title("Stripe", "stripe")}
              <label className="a-check">
                <input type="checkbox" name="stripeEnabled" defaultChecked={p.stripeEnabled} />
                <span>Stripe anbieten</span>
              </label>
              <label className="a-field">
                <span>Veröffentlichbarer Schlüssel</span>
                <input name="stripePublishableKey" defaultValue={p.stripePublishableKey} spellCheck={false} autoComplete="off" className="a-mono" placeholder="pk_live_…" aria-invalid={invalid(state, "stripePublishableKey")} />
                <Hint state={state} name="stripePublishableKey">
                  Stripe-Dashboard → Entwickler → API-Schlüssel.
                </Hint>
              </label>
              <SecretInput state={state} name="stripeSecretKey" label="Geheimer Schlüssel" stored={secrets.stripeSecretKey} placeholder="sk_live_…" />
              <WebhookUrl url={webhooks.stripe} />
              <p className="a-small a-muted">
                In Stripe unter Entwickler → Webhooks einen Endpunkt mit dieser Adresse anlegen und diese Ereignisse wählen: checkout.session.completed, checkout.session.async_payment_succeeded,
                checkout.session.async_payment_failed, checkout.session.expired, charge.refunded.
              </p>
              <SecretInput state={state} name="stripeWebhookSecret" label="Webhook-Signaturgeheimnis" stored={secrets.stripeWebhookSecret} placeholder="whsec_…" />
              <Problems r={r("stripe")} />
            </div>
          </FormSection>

          <FormSection title="Payrexx" help="Schweizer Zahlungsanbieter mit TWINT, PostFinance und Karten.">
            <div className="a-stack">
              {title("Payrexx", "payrexx")}
              <label className="a-check">
                <input type="checkbox" name="payrexxEnabled" defaultChecked={p.payrexxEnabled} />
                <span>Payrexx anbieten</span>
              </label>
              <label className="a-field">
                <span>Instanzname</span>
                <input name="payrexxInstance" defaultValue={p.payrexxInstance} spellCheck={false} autoComplete="off" placeholder="meinshop" aria-invalid={invalid(state, "payrexxInstance")} />
                <Hint state={state} name="payrexxInstance">
                  Der Teil vor «.payrexx.com» in der Adresse Ihres Payrexx-Kontos.
                </Hint>
              </label>
              <SecretInput state={state} name="payrexxApiSecret" label="API-Schlüssel" stored={secrets.payrexxApiSecret} placeholder="Payrexx → Integrationen → API" />
              <WebhookUrl url={webhooks.payrexx} />
              <p className="a-small a-muted">In Payrexx unter Webhooks diese Adresse eintragen (Typ «Normal (PHP-Post)» oder JSON).</p>
              <Problems r={r("payrexx")} />
            </div>
          </FormSection>

          <FormSection title="Barzahlung bei Abholung" help="Nur wählbar, wenn an der Kasse eine Versandart vom Typ «Abholung» gewählt wurde.">
            <div className="a-stack">
              {title("Barzahlung bei Abholung", "pickup")}
              <label className="a-check">
                <input type="checkbox" name="pickupPaymentEnabled" defaultChecked={p.pickupPaymentEnabled} />
                <span>Barzahlung bei Abholung anbieten</span>
              </label>
              <Problems r={r("pickup")} />
            </div>
          </FormSection>

          <div className="a-savebar">
            <Submit>Speichern</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}
