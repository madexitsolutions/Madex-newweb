"use client";

import Link from "next/link";
import { useState } from "react";
import { SecretOnce } from "@/components/admin/action-button";
import { ActionForm, Submit } from "@/components/admin/forms";
import { createKeyAction, rotateSecretAction, saveWebhookAction } from "./actions";

type ScopeOpt = { key: string; label: string; public: boolean };

/** New API key: public keys only offer public scopes; the key is shown once after creation. */
export function KeyForm({ scopes, closeHref }: { scopes: ScopeOpt[]; closeHref: string }) {
  const [kind, setKind] = useState<"public" | "secret">("public");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(["catalog:read"]));
  return (
    <ActionForm action={createKeyAction} className="a-seoform">
      {(state) =>
        state?.data?.key ? (
          <div className="s-dbody">
            <SecretOnce label="Ihr neuer API-Schlüssel" value={String(state.data.key)} hint="Kopieren Sie den Schlüssel jetzt. Er wird nur dieses eine Mal angezeigt; gespeichert wird nur ein Hash." />
            {kind === "secret" && <p className="s-note s-note--warn">Geheime Schlüssel gehören nur auf Server (z. B. als Umgebungsvariable), nie in Browser-Code oder eine App.</p>}
            <div>
              <Link href={closeHref} className="a-btn a-btn--primary" scroll={false}>
                Fertig
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="a-seoform__body">
              <label className="a-field">
                <span>Name</span>
                <input name="name" required maxLength={80} placeholder="z. B. Website Produktion" />
                <small>Damit Sie den Schlüssel später wiedererkennen.</small>
              </label>
              <fieldset className="s-kind">
                <legend>Art</legend>
                <label className="a-check a-check--box">
                  <input
                    type="radio"
                    name="kind"
                    value="public"
                    checked={kind === "public"}
                    onChange={() => {
                      setKind("public");
                      setPicked((p) => new Set([...p].filter((k) => scopes.find((s) => s.key === k)?.public)));
                    }}
                  />
                  <span>
                    Öffentlich (pk_…)
                    <small>Für Browser und Apps: Katalog, Warenkorb, Kasse, Formulare.</small>
                  </span>
                </label>
                <label className="a-check a-check--box">
                  <input type="radio" name="kind" value="secret" checked={kind === "secret"} onChange={() => setKind("secret")} />
                  <span>
                    Geheim (sk_…)
                    <small>Nur Server-zu-Server: Bestellungen, Kunden, Lager.</small>
                  </span>
                </label>
              </fieldset>
              <fieldset className="s-radiocards">
                <legend>Berechtigungen</legend>
                <div className="s-checkgrid">
                  {scopes.map((s) => {
                    const off = kind === "public" && !s.public;
                    return (
                      <label key={s.key} className={`a-check${off ? " is-off" : ""}`} title={off ? "Nur mit geheimem Schlüssel" : undefined}>
                        <input
                          type="checkbox"
                          name="scopes"
                          value={s.key}
                          disabled={off}
                          checked={!off && picked.has(s.key)}
                          onChange={(e) =>
                            setPicked((p) => {
                              const n = new Set(p);
                              if (e.target.checked) n.add(s.key);
                              else n.delete(s.key);
                              return n;
                            })
                          }
                        />
                        <span>
                          {s.label}
                          <small>
                            <code>{s.key}</code>
                            {!s.public && " · nur geheim"}
                          </small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {kind === "public" && (
                <label className="a-field">
                  <span>
                    Erlaubte Herkünfte <em>optional</em>
                  </span>
                  <textarea name="origins" rows={3} placeholder={"https://www.kunde.ch\nhttps://shop.kunde.ch"} spellCheck={false} />
                  <small>Websites, die den Schlüssel im Browser verwenden dürfen – eine pro Zeile. Zusätzlich gelten die globalen Herkünfte unter «Verbindung».</small>
                </label>
              )}
            </div>
            <div className="a-savebar">
              <Submit pending="Wird erstellt …">Schlüssel erstellen</Submit>
              <Link href={closeHref} className="a-btn a-btn--quiet" scroll={false}>
                Abbrechen
              </Link>
            </div>
          </>
        )
      }
    </ActionForm>
  );
}

type EventOpt = { key: string; label: string };
type Hook = { id: string; name: string; url: string; events: string[]; active: boolean } | null;

/** Create/edit a webhook. On create the signing secret is shown once. */
export function WebhookForm({ hook, events, closeHref }: { hook: Hook; events: EventOpt[]; closeHref: string }) {
  const [all, setAll] = useState(hook ? hook.events.includes("*") : false);
  return (
    <ActionForm action={saveWebhookAction} className="a-seoform">
      {(state) =>
        state?.data?.secret ? (
          <div className="s-dbody">
            <SecretOnce label="Signatur-Geheimnis" value={String(state.data.secret)} hint="Hinterlegen Sie es beim Empfänger, um die Signatur (Header X-Webhook-Signature) zu prüfen. Es wird nur jetzt angezeigt." />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={`${closeHref}&bearbeiten=${String(state.data.id)}`} className="a-btn a-btn--primary" scroll={false}>
                Weiter zum Webhook
              </Link>
              <Link href={closeHref} className="a-btn a-btn--quiet" scroll={false}>
                Schliessen
              </Link>
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="id" value={hook?.id ?? ""} />
            <div className="a-seoform__body">
              <label className="a-field">
                <span>Name</span>
                <input name="name" required maxLength={80} defaultValue={hook?.name} placeholder="z. B. ERP Bestellungen" />
              </label>
              <label className="a-field">
                <span>Ziel-Adresse</span>
                <input name="url" type="url" required defaultValue={hook?.url} placeholder="https://www.kunde.ch/api/webhooks/dashboard" spellCheck={false} />
                <small>Muss mit https:// beginnen (http:// nur für localhost) und mit einem 2xx-Status antworten.</small>
              </label>
              <fieldset className="s-radiocards">
                <legend>Ereignisse</legend>
                <div className="s-checkgrid">
                  <label className="a-check s-checkgrid__all">
                    <input type="checkbox" name="events" value="*" checked={all} onChange={(e) => setAll(e.target.checked)} />
                    <span>
                      Alle Ereignisse
                      <small>Auch solche, die später dazukommen.</small>
                    </span>
                  </label>
                  {events.map((ev) => (
                    <label key={ev.key} className={`a-check${all ? " is-off" : ""}`}>
                      <input type="checkbox" name={all ? undefined : "events"} value={ev.key} disabled={all} defaultChecked={hook?.events.includes(ev.key)} />
                      <span>
                        {ev.label}
                        <small>
                          <code>{ev.key}</code>
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="a-check a-check--box">
                <input type="checkbox" name="active" defaultChecked={hook ? hook.active : true} />
                <span>
                  Aktiv
                  <small>Pausierte Webhooks erhalten keine Ereignisse.</small>
                </span>
              </label>
            </div>
            <div className="a-savebar">
              <Submit>{hook ? "Speichern" : "Webhook erstellen"}</Submit>
              <Link href={closeHref} className="a-btn a-btn--quiet" scroll={false}>
                Abbrechen
              </Link>
            </div>
          </>
        )
      }
    </ActionForm>
  );
}

/** Rotates the signing secret and shows the new one once. */
export function RotateSecret({ id }: { id: string }) {
  return (
    <ActionForm action={rotateSecretAction}>
      {(state) =>
        state?.data?.secret ? (
          <SecretOnce label="Neues Signatur-Geheimnis" value={String(state.data.secret)} hint="Tragen Sie es beim Empfänger ein. Das alte Geheimnis ist ab sofort ungültig." />
        ) : (
          <div className="s-actionrow" style={{ borderTop: 0, padding: 0 }}>
            <div>
              <strong>Signatur-Geheimnis erneuern</strong>
              <small>Falls das Geheimnis bekannt geworden ist. Danach muss der Empfänger das neue verwenden.</small>
            </div>
            <input type="hidden" name="id" value={id} />
            <Submit variant="ghost" pending="Erneuern …">
              Erneuern
            </Submit>
          </div>
        )
      }
    </ActionForm>
  );
}

