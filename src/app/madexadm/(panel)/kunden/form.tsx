"use client";

import { ActionForm, Submit } from "@/components/admin/forms";
import type { Address } from "@/server/db/schema/shop";
import { saveCustomerAction } from "./actions";

type Current = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  acceptsMarketing: boolean;
  note: string;
  tags: string[];
  disabled: boolean;
  defaultAddress: Address | null;
} | null;

/** Contact data, default address, notes and tags of a customer. */
export function CustomerForm({ current }: { current: Current }) {
  const a = current?.defaultAddress;
  return (
    <ActionForm action={saveCustomerAction} className="a-form">
      {(state) => {
        const err = (k: string) => state?.fieldErrors?.[k];
        const field = (name: string, label: string, value: string | undefined, opts: { type?: string; autoComplete?: string; hint?: string; errKey?: string } = {}) => (
          <label className="a-field">
            <span>{label}</span>
            <input name={name} type={opts.type ?? "text"} defaultValue={value} autoComplete={opts.autoComplete} aria-invalid={Boolean(err(opts.errKey ?? name)) || undefined} />
            {err(opts.errKey ?? name) ? <span className="a-field__error">{err(opts.errKey ?? name)}</span> : opts.hint ? <small>{opts.hint}</small> : null}
          </label>
        );
        return (
          <>
            {current && <input type="hidden" name="id" value={current.id} />}
            <div className="a-fsec">
              <div className="a-fsec__intro">
                <h3>Kontakt</h3>
                <p>E-Mail ist Pflicht; über sie werden Bestellungen dem Kunden zugeordnet.</p>
              </div>
              <div className="a-fsec__body">
                <div className="a-fields2">
                  {field("firstName", "Vorname", current?.firstName, { autoComplete: "off" })}
                  {field("lastName", "Nachname", current?.lastName, { autoComplete: "off" })}
                </div>
                <div className="a-fields2">
                  {field("email", "E-Mail", current?.email, { type: "email", autoComplete: "off" })}
                  {field("phone", "Telefon", current?.phone, { type: "tel", autoComplete: "off" })}
                </div>
                <label className="a-check">
                  <input type="checkbox" name="acceptsMarketing" defaultChecked={current?.acceptsMarketing} />
                  <span>Hat dem Newsletter / Werbe-E-Mails zugestimmt</span>
                </label>
              </div>
            </div>
            <div className="a-fsec">
              <div className="a-fsec__intro">
                <h3>Standardadresse</h3>
                <p>Wird an der Kasse vorausgefüllt. Leer lassen, wenn keine bekannt ist.</p>
              </div>
              <div className="a-fsec__body">
                {field("a_company", "Firma (optional)", a?.company)}
                <div className="a-fields2">
                  {field("a_street", "Strasse und Nr.", a?.street, { errKey: "defaultAddress.street" })}
                  {field("a_street2", "Zusatz (optional)", a?.street2)}
                </div>
                <div className="a-fields3">
                  {field("a_zip", "PLZ", a?.zip, { errKey: "defaultAddress.zip" })}
                  {field("a_city", "Ort", a?.city, { errKey: "defaultAddress.city" })}
                  {field("a_country", "Land", a?.country ?? "CH", { hint: "Code, z. B. CH", errKey: "defaultAddress.country" })}
                </div>
              </div>
            </div>
            <div className="a-fsec">
              <div className="a-fsec__intro">
                <h3>Intern</h3>
                <p>Notizen und Tags sieht nur Ihr Team.</p>
              </div>
              <div className="a-fsec__body">
                <label className="a-field">
                  <span>Notiz</span>
                  <textarea name="note" rows={3} defaultValue={current?.note} />
                </label>
                {field("tags", "Tags", current?.tags.join(", "), { hint: "Mit Komma trennen, z. B. Stammkunde, Wiederverkäufer" })}
                {current && (
                  <label className="a-check">
                    <input type="checkbox" name="disabled" defaultChecked={current.disabled} />
                    <span>Kundenkonto sperren (keine Anmeldung im Shop mehr möglich)</span>
                  </label>
                )}
              </div>
            </div>
            <div className="a-savebar">
              <Submit>{current ? "Speichern" : "Kunde erfassen"}</Submit>
            </div>
          </>
        );
      }}
    </ActionForm>
  );
}
