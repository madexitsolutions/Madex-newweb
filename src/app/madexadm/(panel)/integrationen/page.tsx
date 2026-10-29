import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { Drawer } from "@/components/admin/drawer";
import { ActionForm, CopyButton, Submit } from "@/components/admin/forms";
import { Empty, Icon, PageHeader, Pager, Panel, Tabs, one, qs } from "@/components/admin/kit";
import { dateTime, relative } from "@/lib/format";
import { SCOPES } from "@/server/api/keys";
import { requirePermission } from "@/server/auth/session";
import { EVENTS } from "@/server/events";
import { getWebhook, listApiKeys, listDeliveries, listWebhooks } from "@/server/integrations";
import { appUrl } from "@/server/lib/app-url";
import { getSettings } from "@/server/settings";
import { deleteWebhookAction, redeliverAction, revokeKeyAction, saveCorsAction, testWebhookAction, toggleWebhookAction } from "./actions";
import { KeyForm, RotateSecret, WebhookForm } from "./ui";
import "../../system.css";

export const metadata = { title: "Integrationen" };

const BASE = "/madexadm/integrationen";
const TABS = [
  { key: "schluessel", label: "API-Schlüssel", href: BASE, icon: "key" as const },
  { key: "webhooks", label: "Webhooks", href: `${BASE}?tab=webhooks`, icon: "refresh" as const },
  { key: "verbindung", label: "Verbindung", href: `${BASE}?tab=verbindung`, icon: "plug" as const },
];

type SP = Record<string, string | string[] | undefined>;

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("integrations.manage");
  const sp = await searchParams;
  if (one(sp.tab) === "analytics") redirect("/madexadm/plugins/analytics");
  const tab = TABS.some((t) => t.key === one(sp.tab)) ? one(sp.tab) : "schluessel";
  return (
    <>
      <PageHeader title="Integrationen" description="Nur falls nötig: externe Systeme wie eine Mobile-App, ein Kassensystem oder ein ERP über API und Webhooks. Die eigene Website braucht keinen API-Schlüssel." />
      <Tabs items={TABS} active={tab} label="Integrationen" />
      {tab === "schluessel" && <KeysTab sp={sp} />}
      {tab === "webhooks" && <WebhooksTab sp={sp} />}
      {tab === "verbindung" && <ConnectTab />}
    </>
  );
}

/* ---------------------------------------------------------------- keys */

async function KeysTab({ sp }: { sp: SP }) {
  const keys = await listApiKeys();
  const active = keys.filter((k) => !k.revokedAt);
  const scopes = Object.entries(SCOPES).map(([key, v]) => ({ key, label: v.label, public: v.public }));
  return (
    <>
      <div className="a-toolbar__row">
        <p className="a-lead">Öffentliche Schlüssel (pk_) dürfen im Browser stehen, geheime (sk_) nur auf Servern. Schlüssel werden nur einmal angezeigt und als Hash gespeichert.</p>
        <Link href={`${BASE}?neu=1`} className="a-btn a-btn--primary" scroll={false}>
          <Icon name="plus" size={16} />
          Neuer Schlüssel
        </Link>
      </div>
      <Panel flush>
        {keys.length === 0 ? (
          <Empty
            icon="key"
            title="Noch keine API-Schlüssel"
            action={
              <Link href={`${BASE}?neu=1`} className="a-btn a-btn--ghost a-btn--sm" scroll={false}>
                Ersten Schlüssel erstellen
              </Link>
            }
          >
            Für eine Website, die Produkte anzeigt oder Anfragen sendet, genügt ein öffentlicher Schlüssel mit den passenden Berechtigungen.
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Art</th>
                  <th scope="col">Berechtigungen</th>
                  <th scope="col">Zuletzt verwendet</th>
                  <th scope="col">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className={k.revokedAt ? "s-revoked" : undefined}>
                    <td>
                      <strong className="s-strong">{k.name}</strong>
                      <small>
                        <code>{k.prefix}…</code> · erstellt {dateTime(k.createdAt)}
                        {k.allowedOrigins.length > 0 && ` · ${k.allowedOrigins.join(", ")}`}
                      </small>
                    </td>
                    <td data-label="Art">
                      {k.revokedAt ? (
                        <span className="a-pill a-pill--muted">Widerrufen</span>
                      ) : k.kind === "public" ? (
                        <span className="a-pill a-pill--info">Öffentlich</span>
                      ) : (
                        <span className="a-pill a-pill--warn">Geheim</span>
                      )}
                    </td>
                    <td data-label="Scopes">
                      <span className="s-scopes">
                        {k.scopes.map((s) => (
                          <code key={s}>{s}</code>
                        ))}
                      </span>
                    </td>
                    <td data-label="Zuletzt">{k.lastUsedAt ? <span title={dateTime(k.lastUsedAt)}>{relative(k.lastUsedAt)}</span> : <span className="a-muted">Nie</span>}</td>
                    <td className="s-rowactions">
                      {!k.revokedAt && <ActionButton action={revokeKeyAction} fields={{ id: k.id }} label="Widerrufen" variant="danger" question={`Schlüssel «${k.name}» widerrufen? Verbundene Anwendungen erhalten danach den Fehler 401.`} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {active.length > 0 && <p className="a-footnote">Verwendung: Header <code>Authorization: Bearer &lt;Schlüssel&gt;</code>. Beispiele finden Sie unter «Verbindung».</p>}
      {one(sp.neu) && (
        <Drawer closeHref={BASE} title="Neuer API-Schlüssel" subtitle="Wählen Sie nur die Berechtigungen, die die Anwendung wirklich braucht.">
          <KeyForm scopes={scopes} closeHref={BASE} />
        </Drawer>
      )}
    </>
  );
}

/* ------------------------------------------------------------- webhooks */

function deliveryPill(status: string, code: number | null) {
  if (status === "success") return <span className="a-pill a-pill--ok">{code ?? "OK"}</span>;
  if (status === "pending") return <span className="a-pill a-pill--warn">Wiederholung geplant</span>;
  return <span className="a-pill a-pill--bad">{code ? `Fehler ${code}` : "Fehler"}</span>;
}

async function WebhooksTab({ sp }: { sp: SP }) {
  const hooks = await listWebhooks();
  const events = Object.entries(EVENTS).map(([key, label]) => ({ key, label }));
  const closeHref = `${BASE}?tab=webhooks`;
  const editId = one(sp.bearbeiten);
  const hook = editId && /^[0-9a-f-]{36}$/i.test(editId) ? await getWebhook(editId) : null;
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const deliveries = hook ? await listDeliveries(hook.id, page) : null;
  return (
    <>
      <div className="a-toolbar__row">
        <p className="a-lead">Webhooks melden Ereignisse (z. B. «Bestellung bezahlt») sofort an andere Systeme. Jede Zustellung ist mit HMAC-SHA256 signiert und wird bei Fehlern bis zu fünfmal wiederholt.</p>
        <Link href={`${closeHref}&neu=1`} className="a-btn a-btn--primary" scroll={false}>
          <Icon name="plus" size={16} />
          Neuer Webhook
        </Link>
      </div>
      <Panel flush>
        {hooks.length === 0 ? (
          <Empty
            icon="refresh"
            title="Noch keine Webhooks"
            action={
              <Link href={`${closeHref}&neu=1`} className="a-btn a-btn--ghost a-btn--sm" scroll={false}>
                Webhook erstellen
              </Link>
            }
          >
            Zum Beispiel, um neue Bestellungen an ein ERP oder an Make/Zapier zu senden.
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Webhook</th>
                  <th scope="col">Ereignisse</th>
                  <th scope="col">Status</th>
                  <th scope="col">Letzte Zustellung</th>
                  <th scope="col">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {hooks.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <Link href={`${closeHref}&bearbeiten=${h.id}`} className="a-rowlink" scroll={false}>
                        {h.name}
                      </Link>
                      <small className="s-clamp">{h.url}</small>
                    </td>
                    <td data-label="Ereignisse">{h.events.includes("*") ? "Alle" : h.events.length === 1 ? EVENTS[h.events[0] as keyof typeof EVENTS] : `${h.events.length} Ereignisse`}</td>
                    <td data-label="Status">{h.active ? <span className="a-state a-state--ok">Aktiv</span> : <span className="a-state a-state--muted">Pausiert</span>}</td>
                    <td data-label="Zuletzt">
                      {h.last ? (
                        <>
                          {deliveryPill(h.last.status, h.last.code)} <span className="a-small0 a-muted">{relative(h.last.createdAt)}</span>
                        </>
                      ) : (
                        <span className="a-muted">Noch keine</span>
                      )}
                      {h.failedCount > 0 && <small className="a-warn">{h.failedCount} fehlgeschlagen</small>}
                    </td>
                    <td className="a-actions">
                      <Link href={`${closeHref}&bearbeiten=${h.id}`} className="a-btn a-btn--quiet a-btn--sm" scroll={false}>
                        Öffnen
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {one(sp.neu) && (
        <Drawer closeHref={closeHref} title="Neuer Webhook" subtitle="Das Signatur-Geheimnis wird nach dem Erstellen einmal angezeigt.">
          <WebhookForm hook={null} events={events} closeHref={closeHref} />
        </Drawer>
      )}
      {hook && deliveries && (
        <Drawer closeHref={closeHref} title={hook.name} subtitle={hook.url}>
          <div className="s-dbody">
            <div className="s-actionlist">
              <div className="s-actionrow">
                <div>
                  <strong>Test senden</strong>
                  <small>Sendet ein Ereignis «ping» an die Adresse und zeigt die Antwort.</small>
                </div>
                <ActionButton action={testWebhookAction} fields={{ id: hook.id }} label="Test senden" pending="Senden …" />
              </div>
              <div className="s-actionrow">
                <div>
                  <strong>{hook.active ? "Pausieren" : "Aktivieren"}</strong>
                  <small>{hook.active ? "Ereignisse werden nicht mehr gesendet, bis Sie den Webhook wieder aktivieren." : "Der Webhook ist pausiert und erhält keine Ereignisse."}</small>
                </div>
                <ActionButton action={toggleWebhookAction} fields={{ id: hook.id, active: hook.active ? "0" : "1" }} label={hook.active ? "Pausieren" : "Aktivieren"} />
              </div>
            </div>
            <section className="s-dsec">
              <RotateSecret id={hook.id} />
            </section>
            <section className="s-dsec" aria-labelledby="sec-deliveries">
              <h3 id="sec-deliveries">Zustellungen</h3>
              {deliveries.rows.length === 0 ? (
                <p className="a-muted a-small0">Noch keine Zustellungen. Senden Sie einen Test.</p>
              ) : (
                <div className="s-deliveries">
                  <table className="a-table a-table--stack">
                    <thead>
                      <tr>
                        <th scope="col">Ereignis</th>
                        <th scope="col">Ergebnis</th>
                        <th scope="col" className="a-num">
                          Dauer
                        </th>
                        <th scope="col">
                          <span className="sr-only">Aktionen</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.rows.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <code>{d.event}</code>
                            <small>
                              {dateTime(d.createdAt)} · Versuch {d.attempt}
                            </small>
                          </td>
                          <td data-label="Ergebnis">
                            {deliveryPill(d.status, d.responseCode)}
                            {d.error && <small className="s-clamp a-warn" title={d.error}>{d.error}</small>}
                            {d.status === "pending" && d.nextRetryAt && <small>nächster Versuch {relative(d.nextRetryAt)}</small>}
                          </td>
                          <td data-label="Dauer" className="a-num">
                            {d.responseMs !== null ? `${d.responseMs} ms` : "–"}
                          </td>
                          <td className="s-rowactions">{d.status !== "success" && <ActionButton action={redeliverAction} fields={{ id: d.id }} label="Erneut senden" pending="Senden …" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pager
                    page={page}
                    pages={Math.max(1, Math.ceil(deliveries.total / 25))}
                    total={deliveries.total}
                    from={(page - 1) * 25 + 1}
                    to={Math.min(page * 25, deliveries.total)}
                    href={(p) => `${BASE}${qs({ tab: "webhooks", bearbeiten: hook.id, seite: p > 1 ? p : undefined })}`}
                  />
                </div>
              )}
            </section>
            <section className="s-dsec" aria-labelledby="sec-edit">
              <h3 id="sec-edit">Einstellungen</h3>
            </section>
          </div>
          <WebhookForm hook={{ id: hook.id, name: hook.name, url: hook.url, events: hook.events, active: hook.active }} events={events} closeHref={closeHref} />
          <div className="a-danger a-danger--inset">
            <div>
              <h2>Webhook löschen</h2>
              <p>Entfernt den Webhook mit allen Zustellungen.</p>
            </div>
            <ActionButton action={deleteWebhookAction} fields={{ id: hook.id }} label="Löschen" variant="danger" small={false} question={`Webhook «${hook.name}» löschen?`} />
          </div>
        </Drawer>
      )}
    </>
  );
}

/* ------------------------------------------------------------- connect */

function CodeBlock({ title, help, code }: { title: string; help?: string; code: string }) {
  return (
    <div className="s-code">
      <div className="s-code__head">
        <div>
          <h3>{title}</h3>
          {help && <p>{help}</p>}
        </div>
        <CopyButton value={code} />
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

async function ConnectTab() {
  const api = await getSettings("api");
  const base = appUrl();
  const fetchProducts = `// Produkte laden (öffentlicher Schlüssel, z. B. in Next.js, Astro, React)
const API = "${base}/api/v1";
const KEY = process.env.NEXT_PUBLIC_DASHBOARD_KEY; // pk_…

const res = await fetch(\`\${API}/products?limit=12\`, {
  headers: { Authorization: \`Bearer \${KEY}\` },
});
if (!res.ok) throw new Error((await res.json()).error.message);
const { data: products } = await res.json();`;
  const cart = `// Warenkorb: das Token aus der Antwort (Header x-cart-token) aufbewahren
let cartToken = localStorage.getItem("cart") ?? "";

async function addToCart(variantId, quantity = 1) {
  const res = await fetch(\`\${API}/cart/items\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${KEY}\`,
      "content-type": "application/json",
      ...(cartToken && { "x-cart-token": cartToken }),
    },
    body: JSON.stringify({ variantId, quantity }),
  });
  cartToken = res.headers.get("x-cart-token") ?? cartToken;
  localStorage.setItem("cart", cartToken);
  return res.json();
}

// Kasse: Bestellung auslösen, danach zur Zahlungsseite weiterleiten
async function checkout(customer) {
  const res = await fetch(\`\${API}/checkout\`, {
    method: "POST",
    headers: { Authorization: \`Bearer \${KEY}\`, "content-type": "application/json", "x-cart-token": cartToken },
    body: JSON.stringify(customer),
  });
  const { data } = await res.json();
  if (data.paymentUrl) location.href = data.paymentUrl;
}`;
  const inquiry = `// Kontaktformular senden (Scope inquiries:write)
await fetch("${base}/api/v1/inquiries", {
  method: "POST",
  headers: { Authorization: \`Bearer \${KEY}\`, "content-type": "application/json" },
  body: JSON.stringify({
    name: form.name,
    email: form.email,
    message: form.message,
    source: "kontakt",
  }),
});`;
  const verify = `// Webhook-Signatur prüfen (Node.js, z. B. Next.js Route Handler)
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req) {
  const body = await req.text(); // unveränderten Text verwenden
  const header = req.headers.get("x-webhook-signature") ?? ""; // t=…,v1=…
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = createHmac("sha256", process.env.DASHBOARD_WEBHOOK_SECRET)
    .update(\`\${t}.\${body}\`)
    .digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300; // max. 5 Minuten alt
  const valid = v1 && expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  if (!fresh || !valid) return new Response("Ungültige Signatur", { status: 401 });

  const event = JSON.parse(body); // { id, event, createdAt, data }
  // … verarbeiten (id für Doppelzustellungen merken)
  return new Response("ok");
}`;
  return (
    <>
      <Panel title="Adresse dieses Dashboards" description="Basis für alle API-Aufrufe externer Systeme.">
        <div className="s-urlbox">
          <code>{base}/api/v1</code>
          <CopyButton value={`${base}/api/v1`} />
        </div>
        {base.startsWith("http://localhost") && <p className="a-footnote">Lokale Adresse – in Produktion setzt die Umgebungsvariable APP_URL die öffentliche Adresse.</p>}
      </Panel>

      <div className="s-twocol">
        <Panel title="So binden Sie ein externes System an">
          <ol className="s-steps">
            <li>
              Unter <Link href={BASE} className="a-link">API-Schlüssel</Link> einen öffentlichen Schlüssel mit den nötigen Berechtigungen erstellen.
            </li>
            <li>Die Domain der Website rechts als Herkunft freigeben (oder beim Schlüssel eintragen).</li>
            <li>Schlüssel als Umgebungsvariable im externen System hinterlegen und die Beispiele unten verwenden.</li>
            <li>
              Für Benachrichtigungen an das System einen <Link href={`${BASE}?tab=webhooks`} className="a-link">Webhook</Link> anlegen und die Signatur prüfen.
            </li>
          </ol>
        </Panel>
        <Panel title="Freigegebene Herkünfte (CORS)" description="Websites, die die API direkt aus dem Browser aufrufen dürfen. Gilt für alle Schlüssel.">
          <ActionForm action={saveCorsAction} className="a-stack">
            <label className="a-field">
              <span>Eine Herkunft pro Zeile</span>
              <textarea name="corsOrigins" rows={4} defaultValue={api.corsOrigins.join("\n")} placeholder={"https://www.kunde.ch\nhttp://localhost:3000"} spellCheck={false} className="a-mono" />
              <small>Nur Protokoll und Domain, ohne Pfad. Serveraufrufe brauchen keinen Eintrag.</small>
            </label>
            <div>
              <Submit>Herkünfte speichern</Submit>
            </div>
          </ActionForm>
        </Panel>
      </div>

      <Panel title="Code-Beispiele" description="JavaScript (fetch) – funktioniert im Browser, in Next.js, Astro, Nuxt und Node.js. Fehler kommen als { error: { code, message } }.">
        <div className="a-stack" style={{ gap: 24 }}>
          <CodeBlock title="Produkte laden" help="Scope catalog:read" code={fetchProducts} />
          <CodeBlock title="Warenkorb und Kasse" help="Scopes cart:write und checkout:write" code={cart} />
          <CodeBlock title="Kontaktanfrage senden" help="Scope inquiries:write" code={inquiry} />
          <CodeBlock title="Webhook-Signatur prüfen" help="Header X-Webhook-Signature: t=<Unix-Zeit>,v1=<HMAC-SHA256 von «t.body»>" code={verify} />
        </div>
      </Panel>
    </>
  );
}

