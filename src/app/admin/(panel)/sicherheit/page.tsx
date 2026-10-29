import path from "node:path";
import { usesEmbeddedDb } from "@/server/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { Drawer } from "@/components/admin/drawer";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Empty, FormSection, Icon, PageHeader, Pager, Panel, Tabs, one, qs, type TabItem } from "@/components/admin/kit";
import { dateTime, relative } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import { requireUser } from "@/server/auth/session";
import { requestInfo } from "@/server/lib/request";
import { LOGIN_REASONS, PER_PAGE, auditEntry, auditFilterOptions, emailStatusCounts, listIpBlocks, queryAudit, queryEmailLog, queryLoginEvents } from "@/server/security";
import { getSettings } from "@/server/settings";
import { createBlockAction, deleteBlockAction, savePolicyAction } from "./actions";
import "../../system.css";
import { dataDir as dataFolder } from "@/server/lib/data-dir";

export const metadata = { title: "Sicherheit & Protokoll" };

const BASE = "/admin/sicherheit";
type SP = Record<string, string | string[] | undefined>;

const ALL_TABS: (TabItem & { perm: "security.manage" | "audit.view" })[] = [
  { key: "richtlinien", label: "Richtlinien", href: `${BASE}?tab=richtlinien`, icon: "shield", perm: "security.manage" },
  { key: "protokoll", label: "Protokoll", href: `${BASE}?tab=protokoll`, icon: "list", perm: "audit.view" },
  { key: "anmeldungen", label: "Anmeldungen", href: `${BASE}?tab=anmeldungen`, icon: "user", perm: "audit.view" },
  { key: "sperren", label: "Sperren", href: `${BASE}?tab=sperren`, icon: "lock", perm: "security.manage" },
  { key: "emails", label: "E-Mail-Protokoll", href: `${BASE}?tab=emails`, icon: "mail", perm: "audit.view" },
  { key: "sicherung", label: "Datensicherung", href: `${BASE}?tab=sicherung`, icon: "download", perm: "security.manage" },
];

export default async function SecurityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser();
  const tabs = ALL_TABS.filter((t) => me.permissions.has(t.perm));
  if (!tabs.length) redirect("/admin/kein-zugriff");
  const sp = await searchParams;
  const tab = tabs.find((t) => t.key === one(sp.tab))?.key ?? tabs[0].key;
  return (
    <>
      <PageHeader title="Sicherheit & Protokoll" description="Richtlinien für Anmeldung und Sitzungen, gesperrte IP-Adressen und die Nachvollziehbarkeit aller Änderungen." />
      <Tabs items={tabs} active={tab} label="Sicherheit" />
      {tab === "richtlinien" && <PolicyTab />}
      {tab === "protokoll" && <AuditTab sp={sp} />}
      {tab === "anmeldungen" && <LoginsTab sp={sp} />}
      {tab === "sperren" && <BlocksTab />}
      {tab === "emails" && <EmailsTab sp={sp} />}
      {tab === "sicherung" && <BackupTab />}
    </>
  );
}

const pageOf = (sp: SP) => Math.max(1, Number(one(sp.seite)) || 1);
const pagerProps = (page: number, total: number) => ({ page, total, pages: Math.max(1, Math.ceil(total / PER_PAGE)), from: (page - 1) * PER_PAGE + 1, to: Math.min(page * PER_PAGE, total) });

/* -------------------------------------------------------------- policy */

async function PolicyTab() {
  const [s, { ip }] = await Promise.all([getSettings("security"), requestInfo()]);
  return (
    <Panel className="a-panel--form">
      <ActionForm action={savePolicyAction} className="a-form">
        <FormSection title="Zwei-Faktor-Anmeldung" help="Empfohlen. Konten ohne 2FA müssen sie bei der nächsten Anmeldung einrichten.">
          <label className="a-check a-check--box">
            <input type="checkbox" name="require2fa" defaultChecked={s.require2fa} />
            <span>
              Für alle Konten verlangen
              <small>Ausgeschaltet können Personen 2FA unter «Mein Konto» freiwillig einrichten.</small>
            </span>
          </label>
        </FormSection>
        <FormSection title="Sitzungen" help="Nach Inaktivität oder spätestens nach der maximalen Dauer muss man sich neu anmelden.">
          <div className="a-fields2">
            <label className="a-field">
              <span>Abmelden nach Inaktivität</span>
              <input name="sessionIdleMinutes" type="number" min={5} max={1440} defaultValue={s.sessionIdleMinutes} />
              <small>Minuten (5–1440)</small>
            </label>
            <label className="a-field">
              <span>Maximale Sitzungsdauer</span>
              <input name="sessionMaxHours" type="number" min={1} max={720} defaultValue={s.sessionMaxHours} />
              <small>Stunden (1–720). Gilt für neue Anmeldungen.</small>
            </label>
          </div>
        </FormSection>
        <FormSection title="Passwörter und Sperre" help="Schutz gegen das Erraten von Passwörtern.">
          <div className="a-fields3">
            <label className="a-field">
              <span>Mindestlänge</span>
              <input name="passwordMinLength" type="number" min={8} max={128} defaultValue={s.passwordMinLength} />
              <small>Zeichen</small>
            </label>
            <label className="a-field">
              <span>Fehlversuche bis Sperre</span>
              <input name="loginMaxAttempts" type="number" min={3} max={50} defaultValue={s.loginMaxAttempts} />
            </label>
            <label className="a-field">
              <span>Sperrdauer</span>
              <input name="lockoutMinutes" type="number" min={1} max={1440} defaultValue={s.lockoutMinutes} />
              <small>Minuten</small>
            </label>
          </div>
        </FormSection>
        <FormSection title="IP-Freigabeliste" help="Optional: Das Dashboard ist nur aus diesen Netzwerken erreichbar (z. B. Büro, VPN). Leer = von überall. Die API ist nicht betroffen.">
          <p className="s-ip">
            <Icon name="globe" size={15} />
            Ihre aktuelle IP-Adresse: <code>{ip}</code>
          </p>
          <label className="a-field">
            <span>Erlaubte Adressen und Netze</span>
            <textarea name="adminIpAllowlist" rows={4} className="a-mono" defaultValue={s.adminIpAllowlist.join("\n")} placeholder={ip !== "unknown" ? ip : "203.0.113.0/24"} spellCheck={false} />
            <small>Eine pro Zeile: einzelne IP (203.0.113.7) oder IPv4-Netz (203.0.113.0/24). Eine Liste ohne Ihre aktuelle IP wird nicht gespeichert.</small>
          </label>
        </FormSection>
        <div className="a-savebar">
          <Submit>Richtlinie speichern</Submit>
        </div>
      </ActionForm>
    </Panel>
  );
}

/* --------------------------------------------------------------- audit */

const ENTITY_LABELS: Record<string, string> = {
  user: "Benutzer",
  role: "Rolle",
  settings: "Einstellungen",
  api_key: "API-Schlüssel",
  webhook: "Webhook",
  ip_block: "IP-Sperre",
  product: "Produkt",
  order: "Bestellung",
  customer: "Kunde",
  post: "Beitrag",
  inquiry: "Anfrage",
  media: "Medien",
  coupon: "Gutschein",
  category: "Kategorie",
};
const ACTION_LABELS: Record<string, string> = { user: "Benutzer", role: "Rollen", settings: "Einstellungen", security: "Sicherheit", api_key: "API-Schlüssel", webhook: "Webhooks", ip_block: "IP-Sperren", setup: "Einrichtung" };

async function AuditTab({ sp }: { sp: SP }) {
  const f = { user: one(sp.benutzer), action: one(sp.aktion), entity: one(sp.objekt), from: one(sp.von), to: one(sp.bis) };
  const page = pageOf(sp);
  const [{ rows, total }, opts] = await Promise.all([queryAudit(f, page), auditFilterOptions()]);
  const filtered = Object.values(f).some(Boolean);
  const link = (extra: Record<string, string | number | undefined>) => `${BASE}${qs({ tab: "protokoll", benutzer: f.user, aktion: f.action, objekt: f.entity, von: f.from, bis: f.to, ...extra })}`;
  const entryId = one(sp.eintrag);
  const entry = entryId ? await auditEntry(entryId) : null;
  return (
    <>
      <form className="s-filters" action={BASE} aria-label="Protokoll filtern">
        <input type="hidden" name="tab" value="protokoll" />
        <label className="a-field">
          <span>Person</span>
          <select name="benutzer" defaultValue={f.user}>
            <option value="">Alle</option>
            {opts.users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Bereich</span>
          <select name="aktion" defaultValue={f.action}>
            <option value="">Alle</option>
            {opts.actions.map((a) => (
              <option key={a} value={`${a}.`}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Objekt</span>
          <select name="objekt" defaultValue={f.entity}>
            <option value="">Alle</option>
            {opts.entities.map((e) => (
              <option key={e} value={e}>
                {ENTITY_LABELS[e] ?? e}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Von</span>
          <input type="date" name="von" defaultValue={f.from} />
        </label>
        <label className="a-field">
          <span>Bis</span>
          <input type="date" name="bis" defaultValue={f.to} />
        </label>
        <div className="s-filters__actions">
          <button type="submit" className="a-btn a-btn--ghost">
            <Icon name="filter" size={15} />
            Filtern
          </button>
          {filtered && (
            <Link href={`${BASE}?tab=protokoll`} className="a-btn a-btn--quiet">
              Zurücksetzen
            </Link>
          )}
        </div>
      </form>
      <Panel flush>
        {rows.length === 0 ? (
          <Empty icon="list" title={filtered ? "Keine Einträge für diese Filter" : "Noch keine Einträge"}>
            {filtered ? "Erweitern Sie den Zeitraum oder setzen Sie die Filter zurück." : "Änderungen an Benutzern, Einstellungen und Daten erscheinen hier automatisch."}
          </Empty>
        ) : (
          <>
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    <th scope="col">Ereignis</th>
                    <th scope="col">Person</th>
                    <th scope="col">Zeit</th>
                    <th scope="col">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={link({ seite: page > 1 ? page : undefined, eintrag: r.id })} className="a-rowlink" scroll={false}>
                          {r.summary || r.action}
                        </Link>
                        <small>
                          <code>{r.action}</code>
                        </small>
                      </td>
                      <td data-label="Person" className="s-mail">
                        {r.userEmail || <span className="a-muted">System</span>}
                      </td>
                      <td data-label="Zeit" className="a-nowrap">
                        {dateTime(r.createdAt)}
                      </td>
                      <td data-label="IP" className="a-mono-cell">
                        {r.ip || "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...pagerProps(page, total)} href={(p) => link({ seite: p > 1 ? p : undefined })} />
          </>
        )}
      </Panel>
      {entry && (
        <Drawer closeHref={link({ seite: page > 1 ? page : undefined })} title={entry.summary || entry.action} subtitle={dateTime(entry.createdAt)}>
          <div className="s-dbody">
            <dl className="a-dl">
              <div>
                <dt>Aktion</dt>
                <dd>
                  <code>{entry.action}</code>
                </dd>
              </div>
              <div>
                <dt>Person</dt>
                <dd>{entry.userEmail || "System"}</dd>
              </div>
              <div>
                <dt>Objekt</dt>
                <dd>{entry.entityType ? `${ENTITY_LABELS[entry.entityType] ?? entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ""}` : "–"}</dd>
              </div>
              <div>
                <dt>IP-Adresse</dt>
                <dd>{entry.ip || "–"}</dd>
              </div>
            </dl>
            <section className="s-dsec">
              <h3>Daten</h3>
              {Object.keys(entry.data).length ? <pre className="s-json">{JSON.stringify(entry.data, null, 2)}</pre> : <p className="a-muted a-small0">Keine zusätzlichen Daten.</p>}
            </section>
          </div>
        </Drawer>
      )}
    </>
  );
}

/* -------------------------------------------------------------- logins */

async function LoginsTab({ sp }: { sp: SP }) {
  const result = one(sp.ergebnis) === "ok" || one(sp.ergebnis) === "failed" ? (one(sp.ergebnis) as "ok" | "failed") : "";
  const q = one(sp.q);
  const page = pageOf(sp);
  const { rows, total, failed24 } = await queryLoginEvents({ result, q }, page);
  const link = (extra: Record<string, string | number | undefined>) => `${BASE}${qs({ tab: "anmeldungen", ergebnis: result, q, ...extra })}`;
  const chip = (key: string, label: string) => (
    <Link href={`${BASE}${qs({ tab: "anmeldungen", ergebnis: key, q })}`} className={`a-chip${result === key ? " is-active" : ""}`} scroll={false} aria-current={result === key ? "true" : undefined}>
      {label}
    </Link>
  );
  return (
    <>
      <div className="a-toolbar__row">
        <form className="a-search" role="search" action={BASE}>
          <Icon name="search" size={16} />
          <input type="hidden" name="tab" value="anmeldungen" />
          {result && <input type="hidden" name="ergebnis" value={result} />}
          <label className="sr-only" htmlFor="login-q">
            E-Mail oder IP suchen
          </label>
          <input id="login-q" name="q" type="search" defaultValue={q} placeholder="E-Mail oder IP suchen" />
        </form>
        <div className="a-chips">
          {chip("", "Alle")}
          {chip("ok", "Erfolgreich")}
          {chip("failed", "Fehlgeschlagen")}
        </div>
      </div>
      {failed24 > 0 && (
        <p className={`s-note${failed24 >= 20 ? " s-note--warn" : ""}`}>
          <Icon name="alert" size={16} />
          <span>
            {failed24} fehlgeschlagene {failed24 === 1 ? "Anmeldung" : "Anmeldungen"} in den letzten 24 Stunden. Bei vielen Versuchen von derselben Adresse können Sie diese unter «Sperren» blockieren.
          </span>
        </p>
      )}
      <Panel flush>
        {rows.length === 0 ? (
          <Empty icon="user" title="Keine Anmeldungen gefunden">
            {q || result ? "Ändern Sie die Suche oder den Filter." : "Jeder Anmeldeversuch wird hier 180 Tage lang aufbewahrt."}
          </Empty>
        ) : (
          <>
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    <th scope="col">E-Mail</th>
                    <th scope="col">Ergebnis</th>
                    <th scope="col">Zeit</th>
                    <th scope="col">IP</th>
                    <th scope="col">Gerät</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="s-mail">
                        <strong className="s-strong">{e.email}</strong>
                      </td>
                      <td data-label="Ergebnis">{e.success ? <span className="a-state a-state--ok">Erfolgreich</span> : <span className="a-state a-state--bad">{LOGIN_REASONS[e.reason] ?? e.reason}</span>}</td>
                      <td data-label="Zeit" className="a-nowrap">
                        <span title={dateTime(e.createdAt)}>{relative(e.createdAt)}</span>
                      </td>
                      <td data-label="IP" className="a-mono-cell">
                        <Link href={link({ q: e.ip, seite: undefined })} className="a-link" scroll={false}>
                          {e.ip || "–"}
                        </Link>
                      </td>
                      <td data-label="Gerät" className="a-clip" title={e.userAgent}>
                        {describeUserAgent(e.userAgent).label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...pagerProps(page, total)} href={(p) => link({ seite: p > 1 ? p : undefined })} />
          </>
        )}
      </Panel>
    </>
  );
}

/* -------------------------------------------------------------- blocks */

async function BlocksTab() {
  const [blocks, { ip }] = await Promise.all([listIpBlocks(), requestInfo()]);
  const now = new Date();
  return (
    <div className="s-twocol">
      <Panel flush title="Gesperrte Adressen" description="Gesperrte Adressen können sich nicht anmelden und erhalten bei der API den Fehler 403.">
        {blocks.length === 0 ? (
          <Empty icon="lock" title="Keine Sperren">
            Sperren Sie Adressen, von denen auffällig viele Fehlversuche kommen (siehe «Anmeldungen»).
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Adresse</th>
                  <th scope="col">Gültig bis</th>
                  <th scope="col">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => {
                  const expired = b.expiresAt && b.expiresAt <= now;
                  return (
                    <tr key={b.id} className={expired ? "s-revoked" : undefined}>
                      <td>
                        <code>{b.cidr}</code>
                        <small>
                          {b.reason || "Ohne Grund"} · {b.createdBy ?? "unbekannt"}, {dateTime(b.createdAt)}
                        </small>
                      </td>
                      <td data-label="Bis">{expired ? <span className="a-pill a-pill--muted">Abgelaufen</span> : b.expiresAt ? dateTime(b.expiresAt) : <span className="a-pill a-pill--bad">Dauerhaft</span>}</td>
                      <td className="s-rowactions">
                        <ActionButton action={deleteBlockAction} fields={{ id: b.id }} label="Aufheben" question={`Sperre für ${b.cidr} aufheben?`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Adresse sperren">
        <ActionForm action={createBlockAction} className="a-stack" resetOnSuccess>
          <label className="a-field">
            <span>IP-Adresse oder Netz</span>
            <input name="cidr" required placeholder="203.0.113.7 oder 203.0.113.0/24" spellCheck={false} className="a-mono" />
          </label>
          <label className="a-field">
            <span>
              Grund <em>optional</em>
            </span>
            <input name="reason" maxLength={200} placeholder="z. B. Viele Fehlversuche" />
          </label>
          <label className="a-field">
            <span>Dauer</span>
            <select name="duration" defaultValue="24h">
              <option value="1h">1 Stunde</option>
              <option value="24h">24 Stunden</option>
              <option value="7d">7 Tage</option>
              <option value="30d">30 Tage</option>
              <option value="never">Dauerhaft</option>
            </select>
          </label>
          <div>
            <Submit pending="Sperren …">Sperren</Submit>
          </div>
          <p className="a-footnote" style={{ margin: 0 }}>
            Ihre eigene Adresse ({ip}) kann nicht gesperrt werden.
          </p>
        </ActionForm>
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------- e-mails */

const MAIL_STATUS: Record<string, { label: string; pill: string }> = {
  sent: { label: "Gesendet", pill: "a-pill--ok" },
  failed: { label: "Fehlgeschlagen", pill: "a-pill--bad" },
  skipped: { label: "Nicht gesendet", pill: "a-pill--muted" },
};

async function EmailsTab({ sp }: { sp: SP }) {
  const status = Object.keys(MAIL_STATUS).includes(one(sp.status)) ? one(sp.status) : "";
  const q = one(sp.q);
  const page = pageOf(sp);
  const [{ rows, total }, counts] = await Promise.all([queryEmailLog({ status, q }, page), emailStatusCounts()]);
  const all = (counts.sent ?? 0) + (counts.failed ?? 0) + (counts.skipped ?? 0);
  const link = (extra: Record<string, string | number | undefined>) => `${BASE}${qs({ tab: "emails", status, q, ...extra })}`;
  const chip = (key: string, label: string, n: number) => (
    <Link href={`${BASE}${qs({ tab: "emails", status: key, q })}`} className={`a-chip${status === key ? " is-active" : ""}`} scroll={false} aria-current={status === key ? "true" : undefined}>
      {label} <span className="a-chip__count">{n}</span>
    </Link>
  );
  return (
    <>
      <div className="a-toolbar__row">
        <form className="a-search" role="search" action={BASE}>
          <Icon name="search" size={16} />
          <input type="hidden" name="tab" value="emails" />
          {status && <input type="hidden" name="status" value={status} />}
          <label className="sr-only" htmlFor="mail-q">
            Empfänger oder Betreff suchen
          </label>
          <input id="mail-q" name="q" type="search" defaultValue={q} placeholder="Empfänger oder Betreff" />
        </form>
        <div className="a-chips">
          {chip("", "Alle", all)}
          {chip("sent", "Gesendet", counts.sent ?? 0)}
          {chip("failed", "Fehlgeschlagen", counts.failed ?? 0)}
          {chip("skipped", "Nicht gesendet", counts.skipped ?? 0)}
        </div>
      </div>
      {(counts.skipped ?? 0) > 0 && status !== "sent" && (
        <p className="s-note s-note--warn">
          <Icon name="alert" size={16} />
          <span>
            «Nicht gesendet» heisst meist, dass kein SMTP-Server eingerichtet ist.{" "}
            <Link href="/admin/einstellungen?tab=email" className="a-link">
              E-Mail-Versand einrichten
            </Link>
          </span>
        </p>
      )}
      <Panel flush>
        {rows.length === 0 ? (
          <Empty icon="mail" title="Keine E-Mails gefunden">
            {q || status ? "Ändern Sie die Suche oder den Filter." : "Einladungen, Bestellbestätigungen und Benachrichtigungen erscheinen hier."}
          </Empty>
        ) : (
          <>
            <div className="a-tablewrap">
              <table className="a-table a-table--stack">
                <thead>
                  <tr>
                    <th scope="col">Betreff</th>
                    <th scope="col">Empfänger</th>
                    <th scope="col">Status</th>
                    <th scope="col">Zeit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong className="s-strong">{m.subject}</strong>
                        <small>
                          <code>{m.template}</code>
                        </small>
                      </td>
                      <td data-label="An" className="s-mail">
                        {m.to}
                      </td>
                      <td data-label="Status">
                        <span className={`a-pill ${MAIL_STATUS[m.status]?.pill ?? "a-pill--muted"}`}>{MAIL_STATUS[m.status]?.label ?? m.status}</span>
                        {m.error && (
                          <small className="s-clamp" title={m.error}>
                            {m.error}
                          </small>
                        )}
                      </td>
                      <td data-label="Zeit" className="a-nowrap">
                        {dateTime(m.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...pagerProps(page, total)} href={(p) => link({ seite: p > 1 ? p : undefined })} />
          </>
        )}
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------ Datensicherung */

function BackupTab() {
  const embedded = usesEmbeddedDb();
  const dataDir = dataFolder();
  return (
    <Panel title="Datensicherung" description={embedded ? "Die Daten liegen in der eingebauten Datenbank dieser Installation." : "Die Daten liegen auf einem externen PostgreSQL-Server (DATABASE_URL)."}>
      {embedded ? (
        <div className="a-stack">
          <p className="a-small0">
            Laden Sie regelmässig eine Sicherung herunter, zum Beispiel einmal pro Woche und vor grösseren Änderungen. Die Datei enthält alle Bestellungen, Kunden, Produkte, Anfragen, Benutzer und Einstellungen.
          </p>
          <div>
            <a href="/admin/sicherheit/backup" className="a-btn a-btn--primary" download>
              Datenbank herunterladen (.tar.gz)
            </a>
          </div>
          <p className="a-small a-muted">
            Bilder und Dateien der Mediathek liegen separat im Ordner <code>{path.join(dataDir, "uploads")}</code>, der Verschlüsselungsschlüssel in <code>{path.join(dataDir, ".app-secret")}</code> (falls
            APP_SECRET nicht gesetzt ist). Sichern Sie beides über den Dateimanager Ihres Hostings mit.
          </p>
          <p className="a-small a-muted">
            Wiederherstellen: App stoppen, im Terminal <code>npm run db:restore -- datenbank-….tar.gz</code> ausführen, App starten.
          </p>
        </div>
      ) : (
        <p className="a-small0">Sicherungen übernimmt der Datenbank-Anbieter (z. B. Coolify-Backups, Neon oder Supabase). Prüfen Sie dort, dass automatische Sicherungen aktiv sind.</p>
      )}
    </Panel>
  );
}
