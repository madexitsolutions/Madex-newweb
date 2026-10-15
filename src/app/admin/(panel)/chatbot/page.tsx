import { getSettings } from "@/lib/server/settings";
import { listKnowledge, openAiConfigured } from "@/lib/server/orion";
import { DEFAULT_COMPANY_PROFILE } from "@/lib/server/company-profile";
import { removeKnowledge, saveChatbot, saveKnowledge, testOpenAi } from "../../actions";
import { ActionForm, ConfirmForm, Submit } from "../../ui";
import { dateTime } from "../../format";

export const metadata = { title: "Chatbot & Wissen" };

const KB_TYPES: Record<string, string> = { faq: "Häufige Frage", leistung: "Leistung", preis: "Preis & Konditionen", prozess: "Ablauf", sonstiges: "Sonstiges" };

function KnowledgeFields({ item }: { item?: { title: string; type: string; content: string; active: boolean } }) {
  return (
    <>
      <div className="a-row">
        <label className="a-field a-field--grow">
          <span>Titel oder Frage</span>
          <input name="title" defaultValue={item?.title} required maxLength={160} />
        </label>
        <label className="a-field">
          <span>Art</span>
          <select name="type" defaultValue={item?.type ?? "faq"}>
            {Object.entries(KB_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="a-field">
        <span>Antwort / Inhalt</span>
        <textarea name="content" rows={4} defaultValue={item?.content} required />
      </label>
      <label className="a-check">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Aktiv – der Assistent verwendet diesen Eintrag
      </label>
    </>
  );
}

export default async function Chatbot() {
  const [s, kb] = await Promise.all([getSettings(), listKnowledge()]);
  const c = s.chatbot;
  return (
    <>
      <header className="a-head">
        <h1>Chatbot & Wissen</h1>
        <p className="a-muted">
          {c.assistantName} beantwortet Fragen ausschliesslich mit dem Firmenprofil und den Wissenseinträgen unten. Was dort nicht steht, leitet er an Ihr Team weiter.
        </p>
      </header>

      <section className="a-panel">
        <h2>Einstellungen</h2>
        {!openAiConfigured() && <p className="a-alert a-alert--error">OPENAI_API_KEY ist nicht gesetzt. Der Assistent beantwortet nur Begrüssungen und leitet alle Fragen an das Team weiter.</p>}
        <ActionForm action={saveChatbot} className="a-stack">
          <div className="a-grid2">
            <label className="a-check">
              <input type="checkbox" name="enabled" defaultChecked={c.enabled} /> Chat auf der Website anzeigen
            </label>
            <label className="a-field">
              <span>Name des Assistenten</span>
              <input name="assistantName" defaultValue={c.assistantName} maxLength={40} />
            </label>
          </div>
          <label className="a-field">
            <span>Begrüssung im Chat</span>
            <textarea name="welcomeMessage" rows={2} defaultValue={c.welcomeMessage} />
          </label>
          <fieldset className="a-fieldset">
            <legend>Hinweis-Blase</legend>
            <label className="a-check">
              <input type="checkbox" name="teaserEnabled" defaultChecked={c.teaserEnabled} /> Nach einigen Sekunden eine Begrüssung neben dem Chat-Symbol zeigen
            </label>
            <label className="a-field">
              <span>Text der Hinweis-Blase</span>
              <input name="teaserMessage" defaultValue={c.teaserMessage} maxLength={300} />
            </label>
            <div className="a-row">
              <label className="a-field">
                <span>Verzögerung (Sekunden)</span>
                <input name="teaserDelay" type="number" min={1} max={120} defaultValue={c.teaserDelay} />
              </label>
              <label className="a-check">
                <input type="checkbox" name="teaserMobile" defaultChecked={c.teaserMobile} /> Auch auf dem Smartphone zeigen
              </label>
            </div>
          </fieldset>
          <fieldset className="a-fieldset">
            <legend>KI-Modell</legend>
            <div className="a-row">
              <label className="a-field a-field--grow">
                <span>OpenAI-Modell</span>
                <input name="model" defaultValue={c.model} list="models" />
                <datalist id="models">
                  <option value="gpt-4o-mini" />
                  <option value="gpt-4o" />
                  <option value="gpt-4.1-mini" />
                  <option value="gpt-4.1" />
                </datalist>
              </label>
              <label className="a-field">
                <span>Kreativität (0–1)</span>
                <input name="temperature" type="number" step="0.1" min={0} max={1} defaultValue={c.temperature} />
              </label>
              <label className="a-field">
                <span>Chats aufbewahren (Tage)</span>
                <input name="retentionDays" type="number" min={0} max={3650} defaultValue={c.retentionDays} />
              </label>
            </div>
          </fieldset>
          <label className="a-field">
            <span>Zusätzliche Anweisungen (optional)</span>
            <textarea name="directive" rows={3} defaultValue={c.directive} placeholder="z. B. «Weise bei Webdesign-Fragen immer auf die kostenlose Analyse hin.»" />
          </label>
          <label className="a-field">
            <span>Firmenprofil – die Wissensgrundlage des Assistenten</span>
            <textarea name="companyProfile" rows={14} defaultValue={c.companyProfile || DEFAULT_COMPANY_PROFILE} className="a-mono" />
            <small>Preise, Leistungen und Abläufe, die der Assistent nennen darf. Was hier nicht steht, beantwortet er nicht.</small>
          </label>
          <label className="a-field">
            <span>Zusätzliche Empfänger für Anfragen (optional)</span>
            <input name="notifyEmails" defaultValue={s.notifyEmails.join(", ")} placeholder="name@madex-it.ch, …" />
            <small>Zusätzlich zu CONTACT_TO_EMAIL aus der .env.</small>
          </label>
          <div>
            <Submit>Einstellungen speichern</Submit>
          </div>
        </ActionForm>
        <ActionForm action={testOpenAi} className="a-row a-test">
          <input type="hidden" name="model" value={c.model} />
          <Submit variant="ghost" pending="Verbindung wird geprüft …">
            OpenAI-Verbindung testen
          </Submit>
        </ActionForm>
      </section>

      <section className="a-panel">
        <h2>Wissensdatenbank</h2>
        <p className="a-muted">Häufige Fragen und Antworten, die der Assistent zusätzlich zum Firmenprofil verwendet.</p>
        <details className="a-add">
          <summary className="a-btn a-btn--primary">Eintrag hinzufügen</summary>
          <ActionForm action={saveKnowledge.bind(null, null)} className="a-stack a-card">
            <KnowledgeFields />
            <div>
              <Submit>Hinzufügen</Submit>
            </div>
          </ActionForm>
        </details>
        {kb.length === 0 ? (
          <p className="a-empty">Noch keine Einträge.</p>
        ) : (
          <div className="a-stack">
            {kb.map((k) => (
              <details key={k.id} className="a-item">
                <summary>
                  <span>{k.title}</span>
                  <small>
                    {KB_TYPES[k.type] ?? k.type}
                    {!k.active && ", inaktiv"}, {dateTime(k.updatedAt)}
                  </small>
                </summary>
                <ActionForm action={saveKnowledge.bind(null, k.id)} className="a-stack">
                  <KnowledgeFields item={k} />
                  <div>
                    <Submit>Speichern</Submit>
                  </div>
                </ActionForm>
                <ConfirmForm action={removeKnowledge.bind(null, k.id)} label="Löschen" question="Diesen Eintrag löschen?" />
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
