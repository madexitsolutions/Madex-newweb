"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { contactSchema, serviceOptions, timeSlots } from "@/lib/contact-schema";
import { Icon } from "@/components/ui/Icon";
import { Link } from "@/components/layout/Transition";

type Errors = Record<string, string>;

const empty = { name: "", company: "", email: "", phone: "", service: "", website: "", message: "", date: "", slot: "", fax: "" };

export function ContactForm({ source = "kontakt", defaultService = "", submitLabel = "Kostenloses Erstgespräch buchen", showWebsite = false }: {
  source?: string;
  defaultService?: string;
  submitLabel?: string;
  showWebsite?: boolean;
}) {
  const [values, setValues] = useState({ ...empty, service: defaultService });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...values, consent, source };
    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] ??= i.message;
      setErrors(errs);
      const first = Object.keys(errs)[0];
      document.getElementById(`cf-${first}`)?.focus();
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch("/api/kontakt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = (await res.json()) as { ok: boolean; error?: string; fieldErrors?: Errors };
      if (json.ok) {
        setStatus("ok");
        setValues({ ...empty });
        setConsent(false);
      } else {
        setStatus("error");
        setMessage(json.error ?? "Es ist ein Fehler aufgetreten.");
        if (json.fieldErrors) setErrors(json.fieldErrors);
      }
    } catch {
      setStatus("error");
      setMessage("Keine Verbindung. Ihre Eingaben bleiben erhalten – bitte versuchen Sie es erneut.");
    }
  };

  const field = (k: keyof typeof empty, label: string, opts: { type?: string; required?: boolean; autoComplete?: string; placeholder?: string } = {}) => (
    <div className={`cf__field${errors[k] ? " has-error" : ""}${values[k] ? " has-value" : ""}`}>
      <input
        id={`cf-${k}`}
        name={k}
        type={opts.type ?? "text"}
        value={values[k]}
        onChange={set(k)}
        autoComplete={opts.autoComplete}
        aria-required={opts.required}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `cf-${k}-err` : undefined}
        placeholder=" "
      />
      <label htmlFor={`cf-${k}`}>
        {label}
        {opts.required && <span aria-hidden="true"> *</span>}
      </label>
      {errors[k] && (
        <span id={`cf-${k}-err`} className="cf__err" role="alert">
          {errors[k]}
        </span>
      )}
    </div>
  );

  return (
    <div className="cf">
      <AnimatePresence mode="wait">
        {status === "ok" ? (
          <motion.div key="ok" className="cf__success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} role="status">
            <span className="cf__check">
              <Icon name="check" size={34} strokeWidth={2.4} />
            </span>
            <h3 className="h3">Vielen Dank für Ihre Anfrage!</h3>
            <p>Wir haben Ihre Nachricht erhalten und melden uns, um Ihren Bedarf einzuordnen und einen Termin zu bestätigen.</p>
            <button className="btn btn--ghost" onClick={() => setStatus("idle")}>
              Weitere Anfrage senden
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="cf__grid">
              {field("name", "Name", { required: true, autoComplete: "name" })}
              {field("company", "Unternehmen", { autoComplete: "organization" })}
              {field("email", "E-Mail", { type: "email", required: true, autoComplete: "email" })}
              {field("phone", "Telefonnummer", { type: "tel", autoComplete: "tel" })}
              <div className={`cf__field cf__field--select${values.service ? " has-value" : ""}`}>
                <select id="cf-service" name="service" value={values.service} onChange={set("service")}>
                  <option value="" />
                  {serviceOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <label htmlFor="cf-service">Interessierte Leistung</label>
              </div>
              {showWebsite ? field("website", "Ihre aktuelle Website (optional)", { type: "url", autoComplete: "url" }) : <div className="cf__spacer" />}
              <div className={`cf__field cf__field--full${errors.message ? " has-error" : ""}${values.message ? " has-value" : ""}`}>
                <textarea
                  id="cf-message"
                  name="message"
                  rows={5}
                  value={values.message}
                  onChange={set("message")}
                  aria-required
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "cf-message-err" : undefined}
                  placeholder=" "
                />
                <label htmlFor="cf-message">
                  Projektbeschreibung<span aria-hidden="true"> *</span>
                </label>
                {errors.message && (
                  <span id="cf-message-err" className="cf__err" role="alert">
                    {errors.message}
                  </span>
                )}
              </div>
              <fieldset className="cf__wish cf__field--full">
                <legend>Wunschtermin für das Erstgespräch (unverbindlich)</legend>
                <div className="cf__wish-row">
                  <div className={`cf__field has-value`}>
                    <input id="cf-date" type="date" name="date" value={values.date} onChange={set("date")} min={new Date().toISOString().slice(0, 10)} />
                    <label htmlFor="cf-date">Bevorzugtes Datum</label>
                  </div>
                  <div className="cf__slots" role="radiogroup" aria-label="Zeitfenster">
                    {timeSlots.map((s) => (
                      <label key={s} className={`cf__slot${values.slot === s ? " is-on" : ""}`}>
                        <input type="radio" name="slot" value={s} checked={values.slot === s} onChange={set("slot")} />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
                <p className="cf__hint">Wir bestätigen den Termin persönlich – Ihre Angabe ist ein Wunsch, keine verbindliche Buchung.</p>
              </fieldset>
              <div className="cf__hp" aria-hidden="true">
                <label htmlFor="cf-fax">Fax</label>
                <input id="cf-fax" name="fax" tabIndex={-1} autoComplete="off" value={values.fax} onChange={set("fax")} />
              </div>
              <div className={`cf__consent cf__field--full${errors.consent ? " has-error" : ""}`}>
                <label>
                  <input id="cf-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "cf-consent-err" : undefined} />
                  <span className="cf__box" aria-hidden="true">
                    <Icon name="check" size={14} strokeWidth={3} />
                  </span>
                  <span>
                    Ich bin einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage verwendet werden. Mehr dazu in der <Link href="/datenschutz">Datenschutzerklärung</Link>. *
                  </span>
                </label>
                {errors.consent && (
                  <span id="cf-consent-err" className="cf__err" role="alert">
                    {errors.consent}
                  </span>
                )}
              </div>
            </div>
            {status === "error" && (
              <p className="cf__alert" role="alert">
                {message}
              </p>
            )}
            <button type="submit" className="btn cf__submit" disabled={status === "sending"}>
              <span>{status === "sending" ? "Wird gesendet …" : submitLabel}</span>
              <span className="btn__icon">
                <Icon name="arrow-up-right" size={16} strokeWidth={2} />
              </span>
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      <style>{`
        .cf__grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
        .cf__field{position:relative}
        .cf__field--full{grid-column:1/-1}
        .cf__field input,.cf__field textarea,.cf__field select{width:100%;font:inherit;color:var(--text);background:#fff;border:1.5px solid rgba(2,81,89,.16);
          border-radius:16px;padding:26px 18px 10px;transition:border-color .3s,box-shadow .3s;appearance:none}
        .cf__field textarea{resize:vertical;min-height:150px}
        .cf__field--select::after{content:"";position:absolute;right:20px;top:26px;width:8px;height:8px;border-right:2px solid var(--petrol);border-bottom:2px solid var(--petrol);transform:rotate(45deg);pointer-events:none}
        .cf__field input:focus,.cf__field textarea:focus,.cf__field select:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 4px rgba(2,141,134,.15)}
        .cf__field label{position:absolute;left:19px;top:18px;color:var(--text-soft);pointer-events:none;transition:transform .3s var(--ease-out),font-size .3s,color .3s;transform-origin:left top}
        .cf__field input:focus+label,.cf__field textarea:focus+label,.cf__field select:focus+label,
        .cf__field.has-value label,.cf__field input:not(:placeholder-shown)+label{transform:translateY(-10px);font-size:12px;color:var(--teal)}
        .cf__field.has-error input,.cf__field.has-error textarea{border-color:#c0392b}
        .cf__err{display:block;margin-top:6px;font-size:13px;color:#b3261e}
        .cf__wish{border:1.5px dashed rgba(2,81,89,.2);border-radius:18px;padding:18px;margin:0}
        .cf__wish legend{padding:0 8px;font-weight:500;font-size:14px;color:var(--petrol)}
        .cf__wish-row{display:grid;grid-template-columns:220px 1fr;gap:14px;align-items:center}
        .cf__slots{display:flex;flex-wrap:wrap;gap:8px}
        .cf__slot{position:relative;padding:10px 14px;border-radius:999px;border:1.5px solid rgba(2,81,89,.2);font-size:14px;cursor:pointer;transition:.3s}
        .cf__slot input{position:absolute;opacity:0;pointer-events:none}
        .cf__slot.is-on{background:var(--teal);border-color:var(--teal);color:#fff}
        .cf__slot:focus-within{box-shadow:0 0 0 3px rgba(2,141,134,.3)}
        .cf__hint{margin:10px 0 0;font-size:13px;color:var(--text-soft)}
        .cf__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
        .cf__consent label{display:flex;gap:12px;align-items:flex-start;font-size:14.5px;cursor:pointer}
        .cf__consent input{position:absolute;opacity:0}
        .cf__box{flex:none;width:24px;height:24px;border-radius:8px;border:1.5px solid rgba(2,81,89,.35);display:grid;place-items:center;color:transparent;transition:.25s;margin-top:1px}
        .cf__consent input:checked+.cf__box{background:var(--teal);border-color:var(--teal);color:#fff}
        .cf__consent input:focus-visible+.cf__box{box-shadow:0 0 0 3px rgba(2,141,134,.35)}
        .cf__consent a{text-decoration:underline;color:var(--petrol)}
        .cf__alert{margin:18px 0 0;padding:14px 18px;border-radius:14px;background:#fdecea;color:#8a1c14}
        .cf__submit{margin-top:24px}
        .cf__submit[disabled]{opacity:.7}
        .cf__success{text-align:center;display:grid;justify-items:center;gap:6px;padding:40px 10px}
        .cf__check{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--teal),var(--petrol));margin-bottom:12px;animation:pop .7s var(--ease-out)}
        @keyframes pop{from{transform:scale(0) rotate(-90deg)}to{transform:none}}
        @media(max-width:700px){.cf__grid{grid-template-columns:minmax(0,1fr)}.cf__wish-row{grid-template-columns:minmax(0,1fr)}.cf__spacer{display:none}}
      `}</style>
    </div>
  );
}
