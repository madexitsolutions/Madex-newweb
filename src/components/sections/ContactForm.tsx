"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { contactSchema, serviceOptions, timeSlots } from "@/lib/contact-schema";
import { Icon } from "@/components/ui/Icon";
import { trackLead } from "@/components/layout/Analytics";
import { Link } from "@/components/layout/Transition";
import { site } from "@/content/site";

type Errors = Record<string, string>;
type Key = keyof typeof empty;

const empty = { name: "", company: "", email: "", phone: "", service: "", website: "", message: "", date: "", slot: "", hp: "" };

/** Validate one field against the shared schema (same rules as the API). */
function checkField(k: Key | "consent", value: string | boolean): string | undefined {
  const shape = contactSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }>;
  const r = shape[k]?.safeParse(value);
  return r && !r.success ? r.error?.issues[0]?.message : undefined;
}

/** "Vormittag (08–12 Uhr)" → ["Vormittag", "08–12 Uhr"] */
function splitSlot(s: string): [string, string | undefined] {
  const m = s.match(/^(.*?)\s*\((.*)\)$/);
  return m ? [m[1], m[2]] : [s, undefined];
}

function ErrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
}

export function ContactForm({
  source = "kontakt",
  defaultService = "",
  submitLabel = "Kostenloses Erstgespräch buchen",
  showWebsite = false,
}: {
  source?: string;
  defaultService?: string;
  submitLabel?: string;
  showWebsite?: boolean;
}) {
  const uid = useId();
  const [values, setValues] = useState({ ...empty, service: defaultService });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const successRef = useRef<HTMLHeadingElement>(null);
  const today = useRef(new Date().toISOString().slice(0, 10)).current;

  // arriving from a pricing button (/kontakt?paket=Basic): note the package in the message
  useEffect(() => {
    const paket = new URLSearchParams(window.location.search).get("paket");
    if (paket && ["Website Wartung", "Basic", "Premium"].includes(paket)) {
      setValues((v) => (v.message ? v : { ...v, service: v.service || "Website-Wartung / Paket", message: `Ich interessiere mich für das Paket «${paket}». Bitte kontaktieren Sie mich für eine Offerte.` }));
    }
  }, []);

  useEffect(() => {
    if (status === "ok") successRef.current?.focus();
  }, [status]);

  const setError = (k: string, msg: string | undefined) =>
    setErrors((e) => {
      if ((e[k] ?? undefined) === msg) return e;
      const next = { ...e };
      if (msg) next[k] = msg;
      else delete next[k];
      return next;
    });

  const onChange = (k: Key) => (e: { target: { value: string } }) => {
    const v = e.target.value;
    setValues((s) => ({ ...s, [k]: v }));
    // once a field shows an error (or after the first submit), re-check while typing so the message clears promptly
    if (errors[k] || touched) setError(k, checkField(k, v));
  };
  const onBlur = (k: Key) => () => {
    if (values[k] || errors[k]) setError(k, checkField(k, values[k]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setTouched(true);
    const payload = { ...values, consent, source };
    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] ??= i.message;
      setErrors(errs);
      const n = Object.keys(errs).length;
      setSummary(n === 1 ? "Bitte prüfen Sie das markierte Feld." : `Bitte prüfen Sie die ${n} markierten Felder.`);
      const order: string[] = ["name", "company", "email", "phone", "service", "website", "message", "date", "slot", "consent"];
      const first = order.find((k) => errs[k]);
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setErrors({});
    setSummary("");
    setStatus("sending");
    try {
      const res = await fetch("/api/kontakt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let json: { ok: boolean; error?: string; fieldErrors?: Errors; reference?: string };
      try {
        json = await res.json();
      } catch {
        json = { ok: false, error: "Der Server hat nicht wie erwartet geantwortet." };
      }
      if (json.ok) {
        trackLead(json.reference, payload.service === "Kostenlose Analyse" ? "Kostenlose Analyse" : "Kontakt");
        setReference(json.reference ?? null);
        setStatus("ok");
        setValues({ ...empty, service: defaultService });
        setConsent(false);
        setTouched(false);
      } else {
        setStatus("error");
        setMessage(json.error ?? "Es ist ein Fehler aufgetreten.");
        if (json.fieldErrors) setErrors(json.fieldErrors);
      }
    } catch {
      setStatus("error");
      setMessage("Keine Verbindung zum Server. Ihre Eingaben bleiben erhalten – bitte versuchen Sie es erneut.");
    }
  };

  const describedBy = (k: string, hint?: boolean) => [hint ? `${uid}-${k}-hint` : "", errors[k] ? `${uid}-${k}-err` : ""].filter(Boolean).join(" ") || undefined;

  const errorText = (k: string) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} className="cf__err">
        <ErrIcon />
        {errors[k]}
      </p>
    ) : null;

  const wrap = (k: string, label: ReactNode, control: ReactNode, opts: { required?: boolean; full?: boolean; hint?: string } = {}) => (
    <div className={`cf__f${opts.full ? " cf__f--full" : ""}${errors[k] ? " is-invalid" : ""}`}>
      <label className="cf__lbl" htmlFor={`${uid}-${k}`}>
        <span>
          {label}
          {opts.required && (
            <span className="cf__req" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </span>
        {!opts.required && <span className="cf__opt">optional</span>}
      </label>
      {control}
      {opts.hint && !errors[k] && (
        <p id={`${uid}-${k}-hint`} className="cf__hint">
          {opts.hint}
        </p>
      )}
      {errorText(k)}
    </div>
  );

  const input = (k: Key, label: string, opts: { type?: string; required?: boolean; autoComplete?: string; inputMode?: "email" | "tel" | "url" | "text"; placeholder?: string; full?: boolean; hint?: string } = {}) =>
    wrap(
      k,
      label,
      <input
        id={`${uid}-${k}`}
        name={k}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        value={values[k]}
        onChange={onChange(k)}
        onBlur={onBlur(k)}
        autoComplete={opts.autoComplete}
        placeholder={opts.placeholder}
        required={opts.required}
        aria-invalid={!!errors[k]}
        aria-describedby={describedBy(k, !!opts.hint)}
        className="cf__in"
      />,
      opts,
    );

  return (
    <div className="cf">
      <AnimatePresence mode="wait" initial={false}>
        {status === "ok" ? (
          <motion.div key="ok" className="cf__success" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} role="status">
            <span className="cf__check">
              <Icon name="check" size={30} strokeWidth={2.4} />
            </span>
            <h3 className="cf__success-h" ref={successRef} tabIndex={-1}>
              Vielen Dank für Ihre Anfrage
            </h3>
            <p>Wir haben Ihre Nachricht erhalten und melden uns in der Regel innerhalb von 24 Stunden, um Ihren Bedarf einzuordnen und einen Termin zu bestätigen.</p>
            {reference && (
              <p className="cf__ref">
                Ihre Referenz <strong>{reference}</strong>
              </p>
            )}
            <p className="cf__success-alt">
              Eilt es? Rufen Sie uns an: <a href={site.contact.phonePrimary.href}>{site.contact.phonePrimary.label}</a>
            </p>
            <button type="button" className="b b--outline" onClick={() => setStatus("idle")}>
              Weitere Anfrage senden
            </button>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-busy={status === "sending"}>
            <p className="cf__legend-note">
              Felder mit <span className="cf__req">*</span> sind erforderlich.
            </p>

            <fieldset className="cf__group">
              <legend className="cf__gh">Ihre Kontaktdaten</legend>
              <div className="cf__grid">
                {input("name", "Name", { required: true, autoComplete: "name" })}
                {input("company", "Unternehmen", { autoComplete: "organization" })}
                {input("email", "E-Mail", { type: "email", inputMode: "email", required: true, autoComplete: "email", placeholder: "name@firma.ch" })}
                {input("phone", "Telefon", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "052 123 45 67" })}
              </div>
            </fieldset>

            <fieldset className="cf__group">
              <legend className="cf__gh">Ihr Anliegen</legend>
              <div className="cf__grid">
                {wrap(
                  "service",
                  "Interessierte Leistung",
                  <span className="cf__select">
                    <select id={`${uid}-service`} name="service" value={values.service} onChange={onChange("service")} className="cf__in">
                      <option value="">Bitte wählen</option>
                      {serviceOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </span>,
                  { full: !showWebsite },
                )}
                {showWebsite && input("website", "Aktuelle Website", { inputMode: "url", autoComplete: "url", placeholder: "www.ihre-firma.ch" })}
                {wrap(
                  "message",
                  showWebsite ? "Was möchten Sie erreichen?" : "Projektbeschreibung",
                  <textarea
                    id={`${uid}-message`}
                    name="message"
                    rows={5}
                    value={values.message}
                    onChange={onChange("message")}
                    onBlur={onBlur("message")}
                    required
                    aria-invalid={!!errors.message}
                    aria-describedby={describedBy("message", true)}
                    className="cf__in cf__ta"
                    placeholder={showWebsite ? "z. B. mehr Anfragen über Google, neue Website, bessere Sichtbarkeit in der Region" : "Wo steht Ihr Unternehmen heute, und was möchten Sie digital erreichen?"}
                  />,
                  { required: true, full: true, hint: "Ein paar Sätze genügen, mindestens 10 Zeichen." },
                )}
              </div>
            </fieldset>

            <fieldset className="cf__group">
              <legend className="cf__gh">
                Wunschtermin für das Erstgespräch <span className="cf__opt">optional</span>
              </legend>
              <p className="cf__hint cf__hint--lead">Wir bestätigen den Termin persönlich. Ihre Angabe ist ein Wunsch, keine verbindliche Buchung.</p>
              <div className="cf__when">
                <div className="cf__f">
                  <label className="cf__lbl" htmlFor={`${uid}-date`}>
                    <span>Bevorzugtes Datum</span>
                  </label>
                  <input id={`${uid}-date`} type="date" name="date" value={values.date} onChange={onChange("date")} min={today} className="cf__in cf__date" />
                </div>
                <fieldset className="cf__slots-fs">
                  <legend className="cf__lbl">Zeitfenster</legend>
                  <div className="cf__slots">
                    {timeSlots.map((s) => {
                      const [main, sub] = splitSlot(s);
                      return (
                        <label key={s} className="cf__slot">
                          <input type="radio" name={`${uid}-slot`} value={s} checked={values.slot === s} onChange={onChange("slot")} />
                          <span className="cf__dot" aria-hidden="true" />
                          <span className="cf__slot-t">
                            {main}
                            {sub && <small>{sub}</small>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </fieldset>

            <div className="cf__hp" aria-hidden="true">
              <label htmlFor={`${uid}-hp`}>Bitte leer lassen</label>
              <input id={`${uid}-hp`} name="hp_check" tabIndex={-1} autoComplete="off" value={values.hp} onChange={onChange("hp")} />
            </div>

            <div className={`cf__consent${errors.consent ? " is-invalid" : ""}`}>
              <label>
                <input
                  id={`${uid}-consent`}
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (errors.consent || touched) setError("consent", checkField("consent", e.target.checked));
                  }}
                  required
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? `${uid}-consent-err` : undefined}
                />
                <span className="cf__box" aria-hidden="true">
                  <Icon name="check" size={14} strokeWidth={3} />
                </span>
                <span>
                  Ich bin einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage verwendet werden. Mehr dazu in der <Link href="/datenschutz">Datenschutzerklärung</Link>.
                  <span className="cf__req" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </span>
              </label>
              {errorText("consent")}
            </div>

            <div className="cf__live" aria-live="assertive">
              {summary && Object.keys(errors).length > 0 && (
                <p className="cf__summary">
                  <ErrIcon />
                  {summary}
                </p>
              )}
              {status === "error" && (
                <div className="cf__alert" role="alert">
                  <strong>Die Anfrage konnte nicht gesendet werden.</strong>
                  <p>{message}</p>
                  <p>
                    Sie erreichen uns auch direkt unter <a href={site.contact.phonePrimary.href}>{site.contact.phonePrimary.label}</a> oder <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>.
                  </p>
                </div>
              )}
            </div>

            <div className="cf__actions">
              <button type="submit" className="b b--primary cf__submit" aria-disabled={status === "sending"}>
                {status === "sending" ? (
                  <>
                    <span className="cf__spin" aria-hidden="true" />
                    Wird gesendet …
                  </>
                ) : (
                  <>
                    {submitLabel}
                    <Icon name="arrow" size={18} strokeWidth={2} />
                  </>
                )}
              </button>
              <p className="cf__note">Kostenlos und unverbindlich. Antwort in der Regel innerhalb von 24 Stunden.</p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <style>{`
        .cf{container-type:inline-size}
        .cf form{display:grid}
        .cf__legend-note{margin:0 0 22px;font-size:14px;color:var(--ink-soft)}
        .cf__req{color:var(--teal-ink);font-weight:700}
        .cf__opt{font-size:13px;font-weight:400;color:var(--ink-soft)}
        .cf__group{border:0;margin:0;padding:0;min-width:0}
        .cf__group>.cf__gh+*{clear:both}
        .cf__group+.cf__group{margin-top:30px;padding-top:28px;border-top:1px solid var(--line-soft)}
        .cf__gh{float:left;width:100%;display:flex;align-items:baseline;gap:4px 10px;flex-wrap:wrap;padding:0;margin:0 0 16px;font:700 17px/1.3 var(--font-display);letter-spacing:-.01em;color:var(--deep)}
        .cf__grid{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
        @container (min-width:520px){
          .cf__grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 18px}
          .cf__f--full{grid-column:1/-1}
        }
        .cf__f{display:grid;gap:7px;align-content:start;min-width:0}
        .cf__lbl{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:0;font-size:14.5px;font-weight:600;line-height:1.3;color:var(--deep)}
        .cf__in{width:100%;min-height:52px;padding:12px 16px;font:inherit;font-size:16px;line-height:1.4;color:var(--text);background:#fff;border:1.5px solid var(--line);border-radius:10px;
          transition:border-color .2s,box-shadow .2s,background-color .2s;appearance:none;-webkit-appearance:none}
        .cf__in::placeholder{color:#7d8d90;opacity:1}
        .cf__in:hover{border-color:#b4c4c4}
        .cf__in:focus{outline:none;border-color:var(--action);box-shadow:0 0 0 3px rgba(2,120,114,.2)}
        .cf__ta{min-height:148px;resize:vertical;line-height:1.55}
        .cf__select{position:relative;display:block}
        .cf__select::after{content:"";position:absolute;right:18px;top:50%;width:8px;height:8px;margin-top:-6px;border-right:2px solid var(--petrol);border-bottom:2px solid var(--petrol);transform:rotate(45deg);pointer-events:none}
        .cf__select select{padding-right:44px;cursor:pointer;text-overflow:ellipsis}
        .cf__date{max-width:100%;cursor:text}
        .cf__date::-webkit-calendar-picker-indicator{cursor:pointer;opacity:.7}
        .is-invalid .cf__in{border-color:var(--danger);background:#fffafa}
        .is-invalid .cf__in:focus{box-shadow:0 0 0 3px rgba(179,38,30,.16)}
        .cf__err{display:flex;gap:7px;align-items:flex-start;margin:2px 0 0;font-size:14px;line-height:1.4;color:var(--danger)}
        .cf__err svg{flex:none;margin-top:1px}
        .cf__hint{margin:2px 0 0;font-size:13.5px;line-height:1.45;color:var(--ink-soft)}
        .cf__hint--lead{margin:-8px 0 16px;max-width:60ch}
        .cf__slots-fs>legend{float:left;width:100%}
        .cf__slots-fs>legend+*{clear:both}
        .cf__when{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
        @container (min-width:560px){.cf__when{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:18px}}
        .cf__slots-fs{border:0;margin:0;padding:0;min-width:0}
        .cf__slots-fs>legend{margin-bottom:7px}
        .cf__slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .cf__slot{position:relative;display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 12px;border:1.5px solid var(--line);border-radius:10px;background:#fff;cursor:pointer;
          font-size:14.5px;font-weight:600;line-height:1.2;color:var(--deep);transition:border-color .2s,background-color .2s}
        .cf__slot:hover{border-color:#b4c4c4}
        .cf__slot input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
        .cf__slot-t{display:grid;gap:2px;min-width:0}
        .cf__slot-t small{font-size:12.5px;font-weight:400;color:var(--ink-soft)}
        .cf__dot{flex:none;width:18px;height:18px;border-radius:50%;border:1.5px solid #9fb2b3;background:#fff;transition:border-color .2s,box-shadow .2s}
        .cf__slot:has(input:checked){border-color:var(--action);background:var(--mint)}
        .cf__slot:has(input:checked) .cf__dot{border-color:var(--action);box-shadow:inset 0 0 0 4px #fff;background:var(--action)}
        .cf__slot:has(input:focus-visible){outline:2px solid var(--teal-bright);outline-offset:2px}
        .cf__hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
        .cf__consent{margin-top:30px;padding-top:26px;border-top:1px solid var(--line-soft)}
        .cf__consent label{position:relative;display:flex;gap:12px;align-items:flex-start;min-height:44px;font-size:14.5px;line-height:1.5;color:var(--text);cursor:pointer}
        .cf__consent input{position:absolute;left:0;top:0;width:24px;height:24px;margin:0;opacity:0;cursor:pointer}
        .cf__box{flex:none;width:24px;height:24px;border-radius:7px;border:1.5px solid #8fa4a5;background:#fff;display:grid;place-items:center;color:transparent;transition:background-color .2s,border-color .2s}
        .cf__consent input:checked+.cf__box{background:var(--action);border-color:var(--action);color:#fff}
        .cf__consent input:focus-visible+.cf__box{outline:2px solid var(--teal-bright);outline-offset:2px}
        .cf__consent.is-invalid .cf__box{border-color:var(--danger)}
        .cf__consent a{color:var(--teal-ink);text-decoration:underline;text-underline-offset:3px}
        .cf__consent .cf__err{margin-left:36px}
        .cf__live:empty{display:none}
        .cf__live{margin-top:22px}
        .cf__summary{display:flex;gap:8px;align-items:center;margin:0;padding:12px 16px;border-radius:10px;background:var(--danger-soft);color:var(--danger-ink);font-size:14.5px;font-weight:600}
        .cf__alert{padding:16px 18px;border-radius:10px;background:var(--danger-soft);color:var(--danger-ink);font-size:14.5px;line-height:1.5}
        .cf__alert p{margin:4px 0 0}
        .cf__alert a{text-decoration:underline;text-underline-offset:3px;font-weight:600}
        .cf__actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px 20px;margin-top:24px}
        .cf__submit{min-height:54px;padding:15px 26px;font-size:16px}
        .cf__submit svg{transition:transform .25s var(--ease-out)}
        .cf__submit:hover svg{transform:translateX(3px)}
        .cf__submit[aria-disabled="true"]{opacity:.75;cursor:progress}
        .cf__note{margin:0;font-size:13.5px;line-height:1.45;color:var(--ink-soft);max-width:32ch}
        .cf__spin{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:cfspin .8s linear infinite}
        @keyframes cfspin{to{transform:rotate(360deg)}}
        @container (max-width:519px){
          .cf__submit{width:100%;padding-inline:18px;font-size:15.5px;gap:10px}
          .cf__note{max-width:none}
        }
        @container (max-width:300px){.cf__slots{grid-template-columns:minmax(0,1fr)}}
        .cf__success{display:grid;justify-items:start;gap:4px;padding:8px 0}
        .cf__check{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;color:#fff;background:var(--action);margin-bottom:14px}
        .cf__success-h{margin:0 0 6px;font-size:clamp(22px,2vw,28px);line-height:1.15;color:var(--deep);outline:none}
        .cf__success p{margin:0 0 6px;max-width:52ch;color:var(--ink-soft)}
        .cf__ref{display:inline-flex;gap:10px;align-items:baseline;margin:10px 0!important;padding:10px 14px;border-radius:10px;background:var(--mint);color:var(--deep)!important;font-size:14.5px}
        .cf__ref strong{font-variant-numeric:tabular-nums;letter-spacing:.04em}
        .cf__success-alt a{color:var(--teal-ink);font-weight:600;text-decoration:underline;text-underline-offset:3px}
        .cf__success .b{margin-top:16px}
      `}</style>
    </div>
  );
}
