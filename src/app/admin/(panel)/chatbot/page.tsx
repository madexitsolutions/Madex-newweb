import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { getSettings, type ChatbotSettings } from "@/lib/server/settings";
import { listKnowledge, openAiConfigured } from "@/lib/server/orion";
import { DEFAULT_COMPANY_PROFILE } from "@/lib/server/company-profile";
import { removeKnowledge, saveChatbot, saveKnowledge, testOpenAi } from "../../actions";
import { ActionForm, ConfirmForm, Submit } from "../../ui";
import { dateTime } from "../../format";
import { Drawer } from "../../drawer";
import { Empty, FormSection, Icon, PageHeader, Panel, Tabs, one, qs } from "../../kit";

export const metadata = { title: "Chatbot & Wissen" };

const KB_TYPES: Record<string, string> = { faq: "Häufige Frage", leistung: "Leistung", preis: "Preis & Konditionen", prozess: "Ablauf", sonstiges: "Sonstiges" };

const TABS = [
  { key: "einstellungen", label: "Einstellungen", icon: "sliders" },
  { key: "profil", label: "Firmenprofil", icon: "building" },
  { key: "wissen", label: "Wissensdatenbank", icon: "book" },
  { key: "verbindung", label: "Verbindung", icon: "plug" },
] as const;

type Field = keyof ChatbotSettings | "notifyEmails";

/**
 * saveChatbot stores every chatbot field at once. Each tab only shows some of them,
 * so the others travel along as hidden inputs with their current values.
 */
function Keep({ c, notify, show }: { c: ChatbotSettings; notify: string[]; show: Field[] }) {
  const values: Record<Field, string | boolean | number> = { ...c, notifyEmails: notify.join(", ") };
  return (
    <>
      {Object.entries(values)
        .filter(([k]) => !show.includes(k as Field))
        .map(([k, v]) => (typeof v === "boolean" ? v && <input key={k} type="hidden" name={k} value="on" /> : <input key={k} type="hidden" name={k} value={String(v)} />))}
    </>
  );
}

function KnowledgeFields({ item }: { item?: { title: string; type: string; content: string; active: boolean } }) {
  return (
    <>
      <label className="a-field">
        <span>Titel oder Frage</span>
        <input name="title" defaultValue={item?.title} required maxLength={160} placeholder="z. B. Was kostet eine Website?" />
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
      <label className="a-field">
        <span>Antwort / Inhalt</span>
        <textarea name="content" rows={10} defaultValue={item?.content} required />
        <small>Schreiben Sie so, wie der Assistent antworten soll – sachlich und vollständig.</small>
      </label>
      <label className="a-check a-check--box">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} />
        <span>
          Aktiv
          <small>Der Assistent verwendet diesen Eintrag in seinen Antworten.</small>
        </span>
      </label>
    </>
  );
}

export default async function Chatbot({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === one(sp.tab)) ? one(sp.tab) : "einstellungen";
  const [s, kb] = await Promise.all([getSettings(), listKnowledge()]);
  const c = s.chatbot;
  const ai = openAiConfigured();
  const tabHref = (key: string, extra: Record<string, string | undefined> = {}) => `/admin/chatbot${qs({ tab: key === "einstellungen" ? undefined : key, ...extra })}`;

  const kbType = Object.hasOwn(KB_TYPES, one(sp.typ)) ? one(sp.typ) : "";
  const kbShown = kb.filter((k) => !kbType || k.type === kbType);
  const editing = tab === "wissen" && one(sp.edit) ? kb.find((k) => k.id === one(sp.edit)) : undefined;
  const adding = tab === "wissen" && one(sp.neu) === "1";
  const closeHref = tabHref("wissen", { typ: kbType || undefined });

  return (
    <>
      <PageHeader
        title="Chatbot & Wissen"
        meta={<span className={`a-pill ${c.enabled ? "a-pill--confirmed" : "a-pill--completed"}`}>{c.enabled ? "Auf der Website aktiv" : "Ausgeblendet"}</span>}
        description={`${c.assistantName} beantwortet Fragen nur mit dem Firmenprofil und der Wissensdatenbank. Was dort nicht steht, leitet er an Ihr Team weiter.`}
        actions={
          tab === "wissen" ? (
            <Link href={tabHref("wissen", { typ: kbType || undefined, neu: "1" })} scroll={false} className="a-btn a-btn--primary">
              <Icon name="plus" size={16} />
              Eintrag hinzufügen
            </Link>
          ) : undefined
        }
      />

      <Tabs label="Bereiche" active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon, href: tabHref(t.key), count: t.key === "wissen" ? kb.length : undefined }))} />

      {!ai && tab !== "wissen" && (
        <p className="a-alert a-alert--error">
          <Icon name="alert" size={16} />
          OPENAI_API_KEY ist nicht gesetzt. Der Assistent beantwortet nur Begrüssungen und leitet alle Fragen an das Team weiter.
        </p>
      )}

      {tab === "einstellungen" && (
        <section className="a-panel a-panel--form">
          <ActionForm action={saveChatbot} className="a-form">
            <Keep c={c} notify={s.notifyEmails} show={["enabled", "assistantName", "welcomeMessage", "teaserEnabled", "teaserMessage", "teaserDelay", "teaserMobile", "directive", "retentionDays", "notifyEmails"]} />
            <FormSection title="Anzeige" help="Ob und wie der Chat auf der Website erscheint.">
              <label className="a-check a-check--box">
                <input type="checkbox" name="enabled" defaultChecked={c.enabled} />
                <span>
                  Chat auf der Website anzeigen
                  <small>Ausgeschaltet verschwindet das Chat-Symbol auf allen Seiten.</small>
                </span>
              </label>
              <label className="a-field">
                <span>Name des Assistenten</span>
                <input name="assistantName" defaultValue={c.assistantName} maxLength={40} />
              </label>
              <label className="a-field">
                <span>Begrüssung im Chat</span>
                <textarea name="welcomeMessage" rows={2} defaultValue={c.welcomeMessage} />
                <small>Die erste Nachricht, wenn jemand den Chat öffnet.</small>
              </label>
            </FormSection>
            <FormSection title="Hinweis-Blase" help="Eine kurze Einladung neben dem Chat-Symbol, damit Besucher den Assistenten bemerken.">
              <label className="a-check a-check--box">
                <input type="checkbox" name="teaserEnabled" defaultChecked={c.teaserEnabled} />
                <span>Nach einigen Sekunden eine Begrüssung neben dem Chat-Symbol zeigen</span>
              </label>
              <label className="a-field">
                <span>Text der Hinweis-Blase</span>
                <input name="teaserMessage" defaultValue={c.teaserMessage} maxLength={300} />
              </label>
              <div className="a-fields2">
                <label className="a-field">
                  <span>Verzögerung (Sekunden)</span>
                  <input name="teaserDelay" type="number" min={1} max={120} defaultValue={c.teaserDelay} />
                </label>
                <label className="a-check a-check--box a-check--inline">
                  <input type="checkbox" name="teaserMobile" defaultChecked={c.teaserMobile} />
                  <span>Auch auf dem Smartphone zeigen</span>
                </label>
              </div>
            </FormSection>
            <FormSection title="Verhalten" help="Zusätzliche Regeln, die der Assistent in jedem Gespräch befolgt.">
              <label className="a-field">
                <span>Zusätzliche Anweisungen (optional)</span>
                <textarea name="directive" rows={4} defaultValue={c.directive} placeholder="z. B. «Weise bei Webdesign-Fragen immer auf die kostenlose Analyse hin.»" />
              </label>
            </FormSection>
            <FormSection title="Anfragen & Datenschutz" help="Wer über neue Anfragen aus dem Chat informiert wird und wie lange Verläufe gespeichert bleiben.">
              <label className="a-field">
                <span>Zusätzliche Empfänger für Anfragen (optional)</span>
                <input name="notifyEmails" defaultValue={s.notifyEmails.join(", ")} placeholder="name@madex-it.ch, …" />
                <small>Zusätzlich zu CONTACT_TO_EMAIL aus der .env. Mehrere Adressen mit Komma trennen.</small>
              </label>
              <label className="a-field a-field--short">
                <span>Chats aufbewahren (Tage)</span>
                <input name="retentionDays" type="number" min={0} max={3650} defaultValue={c.retentionDays} />
                <small>0 = unbegrenzt aufbewahren.</small>
              </label>
            </FormSection>
            <div className="a-savebar">
              <Submit>Einstellungen speichern</Submit>
            </div>
          </ActionForm>
        </section>
      )}

      {tab === "profil" && (
        <section className="a-panel a-panel--form">
          <ActionForm action={saveChatbot} className="a-form">
            <Keep c={c} notify={s.notifyEmails} show={["companyProfile"]} />
            <div className="a-form__intro">
              <h2>Firmenprofil</h2>
              <p>Die Wissensgrundlage des Assistenten: Preise, Leistungen und Abläufe, die er nennen darf. Was hier nicht steht, beantwortet er nicht, sondern verweist an Ihr Team.</p>
            </div>
            <label className="a-field">
              <span className="sr-only">Firmenprofil</span>
              <textarea name="companyProfile" rows={26} defaultValue={c.companyProfile || DEFAULT_COMPANY_PROFILE} className="a-mono" />
              <small>{c.companyProfile ? "Eigene Fassung gespeichert." : "Zeigt die mitgelieferte Standardfassung. Mit dem Speichern wird sie zu Ihrer eigenen."}</small>
            </label>
            <div className="a-savebar">
              <Submit>Firmenprofil speichern</Submit>
            </div>
          </ActionForm>
        </section>
      )}

      {tab === "wissen" && (
        <>
          <p className="a-lead">Häufige Fragen und Antworten, die der Assistent zusätzlich zum Firmenprofil verwendet. Inaktive Einträge bleiben gespeichert, werden aber nicht genutzt.</p>
          {kb.length > 0 && (
            <div className="a-chips" role="group" aria-label="Art">
              <Link href={tabHref("wissen")} scroll={false} className={`a-chip${!kbType ? " is-active" : ""}`}>
                Alle <span className="a-chip__count">{kb.length}</span>
              </Link>
              {Object.entries(KB_TYPES)
                .filter(([k]) => kb.some((x) => x.type === k))
                .map(([k, v]) => (
                  <Link key={k} href={tabHref("wissen", { typ: k })} scroll={false} className={`a-chip${kbType === k ? " is-active" : ""}`}>
                    {v} <span className="a-chip__count">{kb.filter((x) => x.type === k).length}</span>
                  </Link>
                ))}
            </div>
          )}
          <section className="a-panel a-panel--flush">
            {kbShown.length === 0 ? (
              <Empty
                icon="book"
                title="Noch keine Wissenseinträge"
                action={
                  <Link href={tabHref("wissen", { neu: "1" })} scroll={false} className="a-btn a-btn--primary">
                    <Icon name="plus" size={16} />
                    Ersten Eintrag hinzufügen
                  </Link>
                }
              >
                Ergänzen Sie Fragen, die Kunden oft stellen – etwa zu Preisen, Abläufen oder Fristen. Der Assistent beantwortet sie dann zuverlässig.
              </Empty>
            ) : (
              <div className="a-tablewrap">
                <table className="a-table a-table--stack">
                  <thead>
                    <tr>
                      <th>Titel oder Frage</th>
                      <th>Art</th>
                      <th>Status</th>
                      <th>Geändert</th>
                      <th>
                        <span className="sr-only">Aktion</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {kbShown.map((k) => (
                      <tr key={k.id} className={editing?.id === k.id ? "is-selected" : undefined}>
                        <td>
                          <Link href={tabHref("wissen", { typ: kbType || undefined, edit: k.id })} scroll={false} className="a-rowlink">
                            {k.title}
                          </Link>
                          <small className="a-clip a-clip--wide">{k.content}</small>
                        </td>
                        <td className="a-nowrap">{KB_TYPES[k.type] ?? k.type}</td>
                        <td>{k.active ? <span className="a-state a-state--ok">Aktiv</span> : <span className="a-state a-state--muted">Inaktiv</span>}</td>
                        <td className="a-nowrap">{dateTime(k.updatedAt)}</td>
                        <td className="a-actions">
                          <Link href={tabHref("wissen", { typ: kbType || undefined, edit: k.id })} scroll={false} className="a-btn a-btn--ghost a-btn--sm">
                            <Icon name="edit" size={15} />
                            Bearbeiten
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {adding && (
            <Drawer closeHref={closeHref} title="Neuer Wissenseintrag" subtitle="Wird sofort vom Assistenten verwendet, wenn aktiv.">
              <ActionForm action={saveKnowledge.bind(null, null)} className="a-seoform">
                <div className="a-seoform__body">
                  <KnowledgeFields />
                </div>
                <div className="a-savebar">
                  <Submit>Hinzufügen</Submit>
                  <Link href={closeHref} scroll={false} className="a-btn a-btn--quiet">
                    Abbrechen
                  </Link>
                </div>
              </ActionForm>
            </Drawer>
          )}
          {editing && (
            <Drawer closeHref={closeHref} title="Eintrag bearbeiten" subtitle={`Zuletzt geändert am ${dateTime(editing.updatedAt)}`}>
              <ActionForm key={editing.id} action={saveKnowledge.bind(null, editing.id)} className="a-seoform">
                <div className="a-seoform__body">
                  <KnowledgeFields item={editing} />
                </div>
                <div className="a-savebar">
                  <Submit>Speichern</Submit>
                </div>
              </ActionForm>
              <div className="a-danger a-danger--inset">
                <div>
                  <h2>Eintrag löschen</h2>
                  <p>Der Assistent verwendet ihn danach nicht mehr.</p>
                </div>
                <ConfirmForm action={removeKnowledge.bind(null, editing.id)} label="Löschen" question="Diesen Eintrag löschen?" />
              </div>
            </Drawer>
          )}
        </>
      )}

      {tab === "verbindung" && (
        <div className="a-grid2 a-grid2--wide">
          <section className="a-panel a-panel--form">
            <ActionForm action={saveChatbot} className="a-form">
              <Keep c={c} notify={s.notifyEmails} show={["model", "temperature"]} />
              <FormSection title="KI-Modell" help="Welches OpenAI-Modell die Antworten schreibt. «gpt-4o-mini» ist schnell und günstig.">
                <label className="a-field">
                  <span>OpenAI-Modell</span>
                  <input name="model" defaultValue={c.model} list="models" />
                  <datalist id="models">
                    <option value="gpt-4o-mini" />
                    <option value="gpt-4o" />
                    <option value="gpt-4.1-mini" />
                    <option value="gpt-4.1" />
                  </datalist>
                </label>
                <label className="a-field a-field--short">
                  <span>Kreativität (0–1)</span>
                  <input name="temperature" type="number" step="0.1" min={0} max={1} defaultValue={c.temperature} />
                  <small>Niedrig = sachlich und wiederholbar. Empfohlen: 0.2–0.4.</small>
                </label>
              </FormSection>
              <div className="a-savebar">
                <Submit>Speichern</Submit>
              </div>
            </ActionForm>
          </section>
          <Panel title="Verbindung prüfen" description="Sendet eine kurze Testanfrage mit dem gespeicherten Modell an OpenAI.">
            <p className={`a-state a-state--${ai ? "ok" : "bad"}`}>{ai ? "API-Schlüssel ist gesetzt." : "OPENAI_API_KEY fehlt in der .env."}</p>
            <ActionForm action={testOpenAi} className="a-stack a-panel__foot">
              <input type="hidden" name="model" value={c.model} />
              <div>
                <Submit variant="ghost" pending="Verbindung wird geprüft …">
                  OpenAI-Verbindung testen
                </Submit>
              </div>
            </ActionForm>
          </Panel>
        </div>
      )}
    </>
  );
}
