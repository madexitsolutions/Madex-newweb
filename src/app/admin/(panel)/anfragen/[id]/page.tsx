import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ConfirmForm } from "@/components/admin/forms";
import { Icon, PageHeader, Panel } from "@/components/admin/kit";
import { date, dateTime } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { inquiries, users } from "@/server/db/schema";
import { INQUIRY_STATUS, assignableUsers, fieldLabel } from "@/server/content/inquiries";
import { maskIp } from "@/server/lib/request";
import { getSettings } from "@/server/settings";
import { PROJECT } from "@/site/project";
import { deleteInquiryAction, setInquiryStatusAction } from "../actions";
import { InquiryForm } from "./client";
import "../../../content.css";

export const metadata = { title: "Anfrage" };

function prettyJson(t: string) {
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return null;
  }
}

/** JSON-ish values ("{…}", "[…]") are shown pretty-printed. */
function FieldValue({ value }: { value: string }) {
  const t = value.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    const pretty = prettyJson(t);
    if (pretty) return <pre className="iq-json">{pretty}</pre>;
  }
  if (/^https?:\/\/\S+$/.test(t))
    return (
      <a href={t} target="_blank" rel="noopener noreferrer nofollow">
        {t}
      </a>
    );
  return <span className="iq-pre">{value || "–"}</span>;
}

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("inquiries.view");
  await requireModule("inquiries");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id));
  if (!row) notFound();
  const canManage = user.permissions.has("inquiries.manage");
  const [people, assignee, general] = await Promise.all([canManage ? assignableUsers() : [], row.assignedTo ? db.select({ name: users.name }).from(users).where(eq(users.id, row.assignedTo)) : [], getSettings("general")]);
  const st = INQUIRY_STATUS[row.status];
  const subject = `Re: ${row.subject || `Ihre Anfrage`} [${row.reference}]`;
  const quoted = row.message ? `\n\n\n--- Ihre Nachricht vom ${dateTime(row.createdAt)} ---\n${row.message.slice(0, 1500)}` : "";
  const greeting = row.name ? `Guten Tag ${row.name}\n\n` : "Guten Tag\n\n";
  const mailto = `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(greeting + `Vielen Dank für Ihre Anfrage.` + `\n\nFreundliche Grüsse\n${user.name}\n${general.companyName || general.siteName}` + quoted)}`;
  const extra = Object.entries(row.fields);
  const projectPanel = PROJECT.inquiryPanel ? await PROJECT.inquiryPanel({ reference: row.reference, fields: row.fields }) : null;
  const followUp = row.followUpAt ? row.followUpAt.toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }) : "";
  const followUpDue = row.followUpAt && row.followUpAt.getTime() <= Date.now() && row.status !== "done" && row.status !== "spam";

  return (
    <>
      <PageHeader
        crumb={{ href: "/admin/anfragen", label: "Anfragen" }}
        title={row.subject || `Anfrage von ${row.name || row.email}`}
        meta={<span className={`a-pill a-pill--lg a-pill--${st.pill}`}>{st.label}</span>}
        description={
          <>
            <span className="a-mono-cell">{row.reference}</span> · Formular «{row.form}» · eingegangen {dateTime(row.createdAt)}
          </>
        }
        actions={
          <>
            <a href={mailto} className="a-btn a-btn--primary">
              <Icon name="mail" size={16} />
              Per E-Mail antworten
            </a>
            {canManage && row.status !== "done" && row.status !== "spam" && (
              <form action={setInquiryStatusAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="status" value="done" />
                <button type="submit" className="a-btn a-btn--ghost">
                  <Icon name="check" size={16} />
                  Als erledigt markieren
                </button>
              </form>
            )}
          </>
        }
      />
      <div className="a-split">
        <div className="a-stack">
          {followUpDue && (
            <p className="a-alert a-alert--warn" role="status">
              Nachfassen fällig seit {date(row.followUpAt)} – melden Sie sich bei {row.name || row.email}.
            </p>
          )}
          {projectPanel}
          <Panel title="Nachricht">
            {row.message ? <p className="a-message">{row.message}</p> : <p className="a-muted">Keine Nachricht – nur Formularfelder.</p>}
          </Panel>
          <Panel title="Kontakt">
            <dl className="a-dl">
              <div>
                <dt>Name</dt>
                <dd>{row.name || "–"}</dd>
              </div>
              <div>
                <dt>E-Mail</dt>
                <dd>
                  <a href={`mailto:${row.email}`}>{row.email}</a>
                </dd>
              </div>
              <div>
                <dt>Telefon</dt>
                <dd>{row.phone ? <a href={`tel:${row.phone.replace(/[^\d+]/g, "")}`}>{row.phone}</a> : "–"}</dd>
              </div>
              <div>
                <dt>Firma</dt>
                <dd>{row.company || "–"}</dd>
              </div>
            </dl>
          </Panel>
          {extra.length > 0 && (
            <Panel title="Weitere Angaben" description="Zusätzliche Felder, die das Formular gesendet hat.">
              <dl className="a-dl iq-fields">
                {extra.map(([k, v]) => (
                  <div key={k}>
                    <dt>{fieldLabel(k)}</dt>
                    <dd>
                      <FieldValue value={v} />
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
          <Panel title="Herkunft">
            <dl className="a-dl">
              <div>
                <dt>Seite</dt>
                <dd>
                  {row.sourceUrl ? (
                    <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                      {row.sourceUrl}
                    </a>
                  ) : (
                    "–"
                  )}
                </dd>
              </div>
              <div>
                <dt>IP-Adresse</dt>
                <dd>{row.ip ? maskIp(row.ip) : "–"}</dd>
              </div>
              <div>
                <dt>Eingang</dt>
                <dd>{dateTime(row.createdAt)}</dd>
              </div>
              <div>
                <dt>Zuletzt geändert</dt>
                <dd>{dateTime(row.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
        <div className="a-stack">
          {canManage ? (
            <Panel title="Bearbeitung">
              <InquiryForm id={row.id} status={row.status} assignedTo={row.assignedTo ?? ""} notes={row.notes} users={people} followUp={followUp} />
            </Panel>
          ) : (
            <Panel title="Bearbeitung">
              <dl className="a-dl iq-readonly">
                <div>
                  <dt>Zuständig</dt>
                  <dd>{assignee[0]?.name ?? "Niemand"}</dd>
                </div>
                <div>
                  <dt>Interne Notiz</dt>
                  <dd className="iq-pre">{row.notes || "–"}</dd>
                </div>
              </dl>
            </Panel>
          )}
          {canManage && (
            <div className="a-danger iq-danger">
              <div>
                <h2>{row.status === "spam" ? "Kein Spam?" : "Spam oder löschen"}</h2>
                <p>{row.status === "spam" ? "Zurück in den Posteingang verschieben." : "Spam landet im Spam-Ordner, Löschen entfernt die Anfrage endgültig."}</p>
              </div>
              <div className="iq-danger__btns">
                <form action={setInquiryStatusAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="status" value={row.status === "spam" ? "open" : "spam"} />
                  <button type="submit" className="a-btn a-btn--ghost">
                    {row.status === "spam" ? "Kein Spam" : "Als Spam markieren"}
                  </button>
                </form>
                <ConfirmForm action={deleteInquiryAction} label="Löschen" question={`Anfrage ${row.reference} endgültig löschen?`}>
                  <input type="hidden" name="id" value={row.id} />
                </ConfirmForm>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
