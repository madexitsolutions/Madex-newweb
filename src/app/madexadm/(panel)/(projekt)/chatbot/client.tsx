"use client";

import { ActionForm, FieldError, Submit } from "@/components/admin/forms";
import type { KnowledgeItem } from "@/lib/server/orion";
import type { ChatbotSettings } from "@/lib/server/settings";
import {
  saveChatbotSettingsAction,
  saveKnowledgeAction,
  testChatbotAction,
} from "./actions";

const TYPES = [
  "Leistung",
  "Preise & Pakete",
  "Häufige Frage",
  "Unternehmen",
  "Sonstiges",
];

export function KnowledgeForm({
  item,
  saved,
}: {
  item: KnowledgeItem | null;
  saved: boolean;
}) {
  return (
    <ActionForm action={saveKnowledgeAction} className="a-seoform">
      {(state) => (
        <>
          <div className="a-seoform__body">
            {saved && !state && (
              <p className="a-alert a-alert--ok" role="status">
                Gespeichert.
              </p>
            )}
            <input type="hidden" name="id" value={item?.id ?? ""} />
            <label className="a-field">
              <span>Titel</span>
              <input
                name="title"
                defaultValue={item?.title}
                maxLength={140}
                required
                placeholder="z. B. Was kostet eine neue Website?"
                aria-invalid={state?.fieldErrors?.title ? true : undefined}
                autoFocus={!item}
              />
              <FieldError state={state} name="title" />
            </label>
            <label className="a-field">
              <span>Art</span>
              <select name="type" defaultValue={item?.type ?? "Häufige Frage"}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="a-field">
              <span>Inhalt</span>
              <textarea
                name="content"
                defaultValue={item?.content}
                rows={12}
                maxLength={8000}
                aria-invalid={state?.fieldErrors?.content ? true : undefined}
              />
              <small>
                Orion beantwortet Fragen nur mit freigegebenem Wissen. Schreiben
                Sie Fakten so, wie ein Kunde sie hören soll – Preise, Abläufe,
                Bedingungen.
              </small>
              <FieldError state={state} name="content" />
            </label>
            <label className="a-check a-check--box">
              <input
                type="checkbox"
                name="active"
                defaultChecked={item?.active ?? true}
              />
              <span>
                Aktiv
                <small>
                  Nur aktive Einträge verwendet Orion in seinen Antworten.
                </small>
              </span>
            </label>
          </div>
          <div className="a-savebar">
            <Submit>{item ? "Speichern" : "Eintrag anlegen"}</Submit>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function ChatbotSettingsForm({
  s,
  defaultProfile,
}: {
  s: ChatbotSettings;
  defaultProfile: string;
}) {
  return (
    <>
      <ActionForm
        action={saveChatbotSettingsAction}
        className="cb-form cb-settings"
      >
        {(state) => (
          <>
            <fieldset className="cb-group">
              <legend>Auf der Website</legend>
              <label className="a-check a-check--box">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={s.enabled}
                />
                <span>
                  Chatbot anzeigen
                  <small>
                    Ausgeschaltet verschwindet das Chat-Symbol auf der Website.
                  </small>
                </span>
              </label>
              <label className="a-field">
                <span>Name</span>
                <input
                  name="assistantName"
                  defaultValue={s.assistantName}
                  maxLength={40}
                  aria-invalid={
                    state?.fieldErrors?.assistantName ? true : undefined
                  }
                />
                <FieldError state={state} name="assistantName" />
              </label>
              <label className="a-field">
                <span>Begrüssung im Chat</span>
                <textarea
                  name="welcomeMessage"
                  defaultValue={s.welcomeMessage}
                  rows={3}
                  maxLength={400}
                />
                <FieldError state={state} name="welcomeMessage" />
              </label>
              <label className="a-check a-check--box">
                <input
                  type="checkbox"
                  name="teaserEnabled"
                  defaultChecked={s.teaserEnabled}
                />
                <span>
                  Sprechblase anzeigen
                  <small>
                    Kleine Nachricht neben dem Chat-Symbol, die zum Fragen
                    einlädt.
                  </small>
                </span>
              </label>
              <label className="a-field">
                <span>Text der Sprechblase</span>
                <textarea
                  name="teaserMessage"
                  defaultValue={s.teaserMessage}
                  rows={2}
                  maxLength={300}
                />
              </label>
              <div className="cb-row">
                <label className="a-field">
                  <span>Erscheint nach (Sekunden)</span>
                  <input
                    name="teaserDelay"
                    type="number"
                    min={0}
                    max={120}
                    defaultValue={s.teaserDelay}
                  />
                  <FieldError state={state} name="teaserDelay" />
                </label>
                <label className="a-check a-check--box">
                  <input
                    type="checkbox"
                    name="teaserMobile"
                    defaultChecked={s.teaserMobile}
                  />
                  <span>Auch auf dem Smartphone</span>
                </label>
              </div>
            </fieldset>
            <fieldset className="cb-group">
              <legend>Antworten</legend>
              <div className="cb-row">
                <label className="a-field">
                  <span>Kreativität (0–1)</span>
                  <input
                    name="temperature"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    defaultValue={s.temperature}
                  />
                  <small>Niedrig = sachlich und genau. Empfohlen: 0.3.</small>
                  <FieldError state={state} name="temperature" />
                </label>
              </div>
              <label className="a-field">
                <span>
                  Zusätzliche Anweisungen <em>optional</em>
                </span>
                <textarea
                  name="directive"
                  defaultValue={s.directive}
                  rows={4}
                  maxLength={4000}
                  placeholder="z. B. Weise bei Preisfragen immer auf die kostenlose Analyse hin."
                />
                <FieldError state={state} name="directive" />
              </label>
              <label className="a-field">
                <span>
                  Firmenprofil <em>leer = Standardprofil</em>
                </span>
                <textarea
                  name="companyProfile"
                  defaultValue={s.companyProfile}
                  rows={10}
                  maxLength={30_000}
                  placeholder={defaultProfile.slice(0, 400) + " …"}
                />
                <small>
                  Die Grundlage für alle Antworten: Leistungen, Pakete, Preise,
                  Kontakt. Leer lassen, um das mitgelieferte Profil zu
                  verwenden.
                </small>
                <FieldError state={state} name="companyProfile" />
              </label>
              <label className="a-field cb-narrow">
                <span>Gespräche aufbewahren (Tage)</span>
                <input
                  name="retentionDays"
                  type="number"
                  min={0}
                  max={730}
                  defaultValue={s.retentionDays}
                />
                <small>
                  Ältere Gespräche werden automatisch gelöscht. 0 = nie löschen.
                </small>
                <FieldError state={state} name="retentionDays" />
              </label>
            </fieldset>
            <div className="a-savebar">
              <Submit>Einstellungen speichern</Submit>
            </div>
          </>
        )}
      </ActionForm>
      <ActionForm action={testChatbotAction} className="cb-test">
        {() => (
          <>
            <input type="hidden" name="model" value={s.model} />
            <Submit variant="ghost" pending="Verbindung wird geprüft …">
              Verbindung zu OpenAI prüfen
            </Submit>
          </>
        )}
      </ActionForm>
    </>
  );
}
