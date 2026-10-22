import Link from "next/link";
import { Delta, LineChart } from "@/components/admin/charts-ext";
import { Empty, Icon, PageHeader, Panel, type IconName } from "@/components/admin/kit";
import { fullName, money, number, orderNumber, relative } from "@/lib/format";
import { enabledModules } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { atAGlance, latestInquiries, latestOrders, newInquiryCount, openOrderCount, recentActivity, revenueKpis, setupChecks, shopTodos, userNotifications, type Todo } from "@/server/analytics/overview";
import { MADEX, MadexMark } from "@/components/admin/madex";
import { AVAILABLE_PLUGINS, websiteEditing } from "@/modules/registry";
import { QuickDraft } from "./quick-draft";
import { change } from "@/server/analytics/sales";
import { bucketLabel } from "@/server/analytics/range";
import { ga4Visitors } from "@/server/analytics/ga4";
import { INQUIRY_STATUS } from "@/server/content/inquiries";
import { getSettings } from "@/server/settings";
import { markReadAction } from "./overview-actions";
import { ORDER_STATUS, type OrderStatus } from "@/lib/orders";
import "../content.css";

export const metadata = { title: "Übersicht" };


function greeting(now: Date) {
  const h = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Zurich" }));
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

function Kpi({ label, value, hint, delta, href, tone }: { label: string; value: string; hint?: React.ReactNode; delta?: number | null; href?: string; tone?: "accent" | "warn" }) {
  const body = (
    <>
      <span className="a-kpi__label">{label}</span>
      <strong>{value}</strong>
      {delta !== undefined ? <Delta value={delta} label={typeof hint === "string" ? hint : "vs. Vorperiode"} /> : hint ? <span className="a-kpi__hint">{hint}</span> : null}
    </>
  );
  const cls = `a-kpi${tone ? ` a-kpi--${tone}` : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function Overview() {
  const user = await requirePermission("dashboard.view");
  const now = new Date();
  const [modules, general] = await Promise.all([enabledModules(), getSettings("general")]);
  const can = (p: Parameters<typeof user.permissions.has>[0]) => user.permissions.has(p);
  const showSales = modules.shop && can("orders.view");
  const showInquiries = modules.inquiries && can("inquiries.view");
  const showVisitors = modules.analytics && can("analytics.view");
  const isAdmin = can("settings.manage");

  const [sales, open, newInq, visitors, todos, checks, orders, inqs, notes] = await Promise.all([
    showSales ? revenueKpis(now) : null,
    showSales ? openOrderCount() : 0,
    showInquiries ? newInquiryCount() : 0,
    showVisitors ? ga4Visitors() : null,
    modules.shop ? shopTodos(user, now) : [],
    isAdmin ? setupChecks(modules) : [],
    showSales ? latestOrders(6) : [],
    showInquiries ? latestInquiries(6) : [],
    userNotifications(user, 8),
  ]);
  const [glance, activity] = await Promise.all([atAGlance(modules), can("audit.view") ? recentActivity(6) : []]);
  const activePlugins = AVAILABLE_PLUGINS.filter((p) => modules[p.key]).length;

  const allTodos: Todo[] = [...todos];
  if (showInquiries && newInq) allTodos.push({ key: "inq", tone: "info", icon: "inbox", title: `${newInq} neue Anfrage${newInq === 1 ? "" : "n"}`, text: "Noch nicht bearbeitet – zeitnah antworten.", href: "/admin/anfragen", action: "Anfragen" });
  const openChecks = checks.filter((c) => !c.ok);
  const firstName = user.name.split(" ")[0];
  const showWelcome = isAdmin && (activePlugins === 0 || openChecks.length > 0);
  type Glance = { label: string; n: number; href: string; icon: IconName };
  const glanceItems = ([
    websiteEditing && { label: "Seiten", n: glance.pages, href: "/admin/seiten", icon: "pages" as const },
    glance.posts !== null && { label: "Beiträge", n: glance.posts, href: "/admin/beitraege", icon: "file" as const },
    glance.products !== null && { label: "Produkte", n: glance.products, href: "/admin/produkte", icon: "box" as const },
    glance.orders !== null && { label: "Bestellungen", n: glance.orders, href: "/admin/bestellungen?tab=alle", icon: "cart" as const },
    glance.inquiries !== null && { label: "Anfragen", n: glance.inquiries, href: "/admin/anfragen?status=alle", icon: "inbox" as const },
    { label: "Bilder & Dateien", n: glance.media, href: "/admin/medien", icon: "image" as const },
    { label: "Benutzer", n: glance.users, href: "/admin/benutzer", icon: "users" as const },
    { label: "Aktive Plugins", n: activePlugins, href: "/admin/plugins", icon: "plug" as const },
  ] as (Glance | false)[]).filter((x): x is Glance => Boolean(x));

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        description={`${now.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Zurich" })} · ${general.siteName}`}
        actions={
          modules.analytics && can("analytics.view") ? (
            <Link href="/admin/statistiken" className="a-btn a-btn--ghost">
              <Icon name="chart" size={16} />
              Statistiken
            </Link>
          ) : undefined
        }
      />

      {showWelcome && (
        <section className="ov-welcome" aria-labelledby="ov-welcome-title">
          <div className="ov-welcome__intro">
            <h2 id="ov-welcome-title">Willkommen in Ihrem Dashboard</h2>
            <p>Hier steuern Sie Ihre Website ohne Programmieren: Texte und Bilder ändern, Seiten anlegen und Funktionen wie Shop oder Google Analytics per Plugin dazuschalten.</p>
            <a href={general.siteUrl || "/"} target="_blank" rel="noopener" className="a-btn a-btn--primary">
              <Icon name="external" size={16} />
              Website ansehen
            </a>
          </div>
          <div className="ov-welcome__col">
            <h3>Erste Schritte</h3>
            <Link href="/admin/einstellungen">
              <Icon name="building" size={16} />
              Firmendaten eintragen
            </Link>
            <Link href="/admin/einstellungen?tab=branding">
              <Icon name="palette" size={16} />
              Logo und Farben festlegen
            </Link>
            <Link href="/admin/einstellungen?tab=email">
              <Icon name="mail" size={16} />
              E-Mail-Versand einrichten
            </Link>
          </div>
          {websiteEditing && (
            <div className="ov-welcome__col">
              <h3>Website gestalten</h3>
              <Link href="/admin/texte">
                <Icon name="type" size={16} />
                Texte und Bilder ändern
              </Link>
              <Link href="/admin/seiten">
                <Icon name="pages" size={16} />
                Seiten bearbeiten
              </Link>
              <Link href="/admin/menues">
                <Icon name="menuedit" size={16} />
                Menüs anpassen
              </Link>
            </div>
          )}
          <div className="ov-welcome__col">
            <h3>Mehr Funktionen</h3>
            <Link href="/admin/plugins">
              <Icon name="plug" size={16} />
              Plugins aktivieren
            </Link>
            <Link href="/admin/benutzer">
              <Icon name="users" size={16} />
              Team einladen
            </Link>
            <a href={`mailto:${MADEX.email}`}>
              <Icon name="chat" size={16} />
              Hilfe von Madex
            </a>
          </div>
        </section>
      )}

      {(sales || showInquiries || visitors) && (
        <div className="a-kpis ov-kpis">
          {sales && (
            <>
              <Kpi label="Umsatz heute" value={money(sales.today.current.revenue)} delta={change(sales.today.current.revenue, sales.today.previous.revenue)} hint="vs. gestern" href="/admin/bestellungen" tone="accent" />
              <Kpi label="Umsatz 7 Tage" value={money(sales.week.current.revenue)} delta={change(sales.week.current.revenue, sales.week.previous.revenue)} hint="vs. Vorwoche" />
              <Kpi label="Umsatz 30 Tage" value={money(sales.month.current.revenue)} delta={change(sales.month.current.revenue, sales.month.previous.revenue)} hint="vs. Vormonat" />
              <Kpi label="Bestellungen 7 Tage" value={number(sales.ordersWeek)} delta={change(sales.ordersWeek, sales.ordersPrevWeek)} hint="vs. Vorwoche" href="/admin/bestellungen" />
              <Kpi label="Offene Bestellungen" value={number(open)} hint={open ? "In Bearbeitung oder zurückgestellt" : "Alles versendet"} href="/admin/bestellungen?status=offen" tone={open ? "warn" : undefined} />
            </>
          )}
          {showInquiries && <Kpi label="Neue Anfragen" value={number(newInq)} hint={newInq ? "Warten auf Antwort" : "Alles beantwortet"} href="/admin/anfragen" tone={newInq ? "warn" : undefined} />}
          {visitors &&
            ("error" in visitors ? (
              <Kpi label="Besucher 7 Tage" value="–" hint={<span title={visitors.error}>Google Analytics: Fehler</span>} href="/admin/statistiken" />
            ) : (
              <Kpi label="Besucher 7 Tage" value={number(visitors.users)} delta={change(visitors.users, visitors.previous)} hint="vs. Vorwoche" href="/admin/statistiken#besucher" />
            ))}
        </div>
      )}

      <div className="a-grid2 a-grid2--wide">
        <div className="a-stack">
          <Panel title="Was ist zu tun" description={allTodos.length ? undefined : "Alles erledigt."}>
            {allTodos.length === 0 && openChecks.length === 0 ? (
              <Empty icon="check" title="Nichts Dringendes">
                Neue Bestellungen, überfällige Rechnungen, tiefe Lagerbestände und Anfragen erscheinen hier.
              </Empty>
            ) : (
              <ul className="a-todo">
                {allTodos.map((t) => (
                  <li key={t.key} className={`a-todo__item a-todo__item--${t.tone}`}>
                    <span className="a-todo__icon" aria-hidden="true">
                      <Icon name={t.icon as IconName} size={18} />
                    </span>
                    <span className="a-todo__text">
                      <strong>{t.title}</strong>
                      <small>{t.text}</small>
                    </span>
                    <Link href={t.href} className="a-btn a-btn--ghost a-btn--sm">
                      {t.action}
                    </Link>
                  </li>
                ))}
                {allTodos.length === 0 && (
                  <li className="a-todo__item a-todo__item--info">
                    <span className="a-todo__icon" aria-hidden="true">
                      <Icon name="check" size={18} />
                    </span>
                    <span className="a-todo__text">
                      <strong>Keine offenen Aufgaben</strong>
                      <small>Bestellungen, Rechnungen, Lager und Anfragen sind im grünen Bereich.</small>
                    </span>
                  </li>
                )}
              </ul>
            )}
          </Panel>
          {sales && (
            <Panel title="Umsatz der letzten 30 Tage" description={`${money(sales.month.current.revenue)} aus ${number(sales.month.current.orders)} bezahlten Bestellungen, nach Rückerstattungen`}>
              <LineChart
                title="Umsatz pro Tag, letzte 30 Tage"
                labels={sales.series.map((p) => bucketLabel(p.key, "day"))}
                shortLabels={sales.series.map((p) => bucketLabel(p.key, "day", true))}
                series={[{ name: "Umsatz", values: sales.series.map((p) => p.revenue) }]}
                format="money"
                unit="CHF"
                height={220}
              />
            </Panel>
          )}
          {sales && (
            <Panel
              title="Neueste Bestellungen"
              flush
              action={
                <Link href="/admin/bestellungen" className="a-link">
                  Alle <Icon name="arrow" size={14} />
                </Link>
              }
            >
              {orders.length === 0 ? (
                <Empty icon="cart" title="Noch keine Bestellungen">
                  Sobald im Shop bestellt wird, erscheinen die Bestellungen hier.
                </Empty>
              ) : (
                <div className="a-tablewrap">
                  <table className="a-table a-table--stack">
                    <thead>
                      <tr>
                        <th scope="col">Bestellung</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="a-num">
                          Betrag
                        </th>
                        <th scope="col">Eingang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <Link href={`/admin/bestellungen/${o.id}`} className="a-rowlink">
                              #{orderNumber(o.number)}
                            </Link>
                            <small>{fullName(o.billing) || o.email}</small>
                          </td>
                          <td data-label="Status">
                            <span className={`a-pill a-pill--${ORDER_STATUS[o.status as OrderStatus]?.tone ?? "muted"}`}>{ORDER_STATUS[o.status as OrderStatus]?.label ?? o.status}</span>
                          </td>
                          <td className="a-num" data-label="Betrag">
                            {money(o.total)}
                          </td>
                          <td className="a-nowrap" data-label="Eingang">
                            {relative(o.createdAt, now.getTime())}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
          {activity.length > 0 && (
            <Panel
              title="Letzte Änderungen"
              action={
                <Link href="/admin/sicherheit?tab=protokoll" className="a-link">
                  Protokoll <Icon name="arrow" size={14} />
                </Link>
              }
            >
              <ul className="ov-list">
                {activity.map((a) => (
                  <li key={a.id}>
                    <div>
                      <span>{a.summary}</span>
                      <small>{a.name || a.email || "System"}</small>
                    </div>
                    <div className="ov-list__meta">
                      <small>{relative(a.createdAt, now.getTime())}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="a-stack">
          <Panel title="Auf einen Blick">
            <ul className="ov-glance">
              {glanceItems.map((g) => (
                <li key={g.label}>
                  <Link href={g.href}>
                    <Icon name={g.icon} size={16} />
                    <strong>{number(g.n)}</strong>
                    <span>{g.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          {modules.blog && can("content.manage") && (
            <Panel title="Schnellentwurf" description="Idee festhalten, später fertig schreiben.">
              <QuickDraft />
            </Panel>
          )}
          <Panel
            title={
              <>
                Mitteilungen {notes.unread > 0 && <span className="a-tabs__count ov-unread">{notes.unread} neu</span>}
              </>
            }
            action={
              notes.unread > 0 ? (
                <form action={markReadAction}>
                  <button type="submit" className="a-btn a-btn--quiet a-btn--sm">
                    Alle gelesen
                  </button>
                </form>
              ) : undefined
            }
          >
            {notes.rows.length === 0 ? (
              <p className="a-muted a-small0">Keine Mitteilungen in den letzten 60 Tagen.</p>
            ) : (
              <ul className="ov-feed">
                {notes.rows.map((n) => (
                  <li key={n.id} className={n.read ? undefined : "is-unread"}>
                    <span className="ov-feed__dot" aria-hidden="true" />
                    <div className="ov-feed__text">
                      {n.href ? (
                        <Link href={n.href} className="a-rowlink">
                          {n.title}
                        </Link>
                      ) : (
                        <strong>{n.title}</strong>
                      )}
                      {n.body && <small>{n.body}</small>}
                      <time dateTime={n.createdAt.toISOString()}>{relative(n.createdAt, now.getTime())}</time>
                    </div>
                    {!n.read && (
                      <form action={markReadAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" className="a-iconbtn ov-feed__read" aria-label={`«${n.title}» als gelesen markieren`} title="Als gelesen markieren">
                          <Icon name="check" size={16} />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {showInquiries && (
            <Panel
              title="Neueste Anfragen"
              action={
                <Link href="/admin/anfragen?status=alle" className="a-link">
                  Alle <Icon name="arrow" size={14} />
                </Link>
              }
            >
              {inqs.length === 0 ? (
                <p className="a-muted a-small0">Noch keine Anfragen eingegangen.</p>
              ) : (
                <ul className="ov-list">
                  {inqs.map((q) => (
                    <li key={q.id}>
                      <div>
                        <Link href={`/admin/anfragen/${q.id}`} className="a-rowlink">
                          {q.name || q.email}
                        </Link>
                        <small>{q.subject || q.message.slice(0, 80) || "Ohne Betreff"}</small>
                      </div>
                      <div className="ov-list__meta">
                        <span className={`a-pill a-pill--${INQUIRY_STATUS[q.status].pill}`}>{INQUIRY_STATUS[q.status].label}</span>
                        <small>{relative(q.createdAt, now.getTime())}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {isAdmin && checks.length > 0 && (
            <Panel title="Einrichtung" description={openChecks.length ? `${checks.length - openChecks.length} von ${checks.length} erledigt` : "Alles eingerichtet."}>
              <ul className="ov-checks">
                {checks.map((c) => (
                  <li key={c.key} className={c.ok ? "is-ok" : "is-off"}>
                    <span className="a-checks__dot" aria-hidden="true">
                      <Icon name={c.ok ? "check" : "alert"} size={13} />
                    </span>
                    <span>
                      {c.ok ? (
                        <strong>{c.title}</strong>
                      ) : (
                        <Link href={c.href} className="a-rowlink">
                          {c.title}
                        </Link>
                      )}
                      <small>{c.text}</small>
                    </span>
                    <span className="sr-only">{c.ok ? "erledigt" : "offen"}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <section className="ov-madex" aria-label="Hilfe von Madex">
            <MadexMark size={16} />
            <p>
              <strong>Hilfe von {MADEX.name}</strong> Fragen, Änderungswünsche oder neue Funktionen? <a href={`mailto:${MADEX.email}`}>{MADEX.email}</a> · <a href={MADEX.phoneHref}>{MADEX.phone}</a>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
