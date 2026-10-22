import Link from "next/link";
import "../../shop.css";
import "../../system.css";
import { ActionButton } from "@/components/admin/action-button";
import { Drawer } from "@/components/admin/drawer";
import { Empty, Icon, one, PageHeader, Panel, Tabs } from "@/components/admin/kit";
import { money, percent } from "@/lib/format";
import { requireModule } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { appUrl } from "@/server/lib/app-url";
import { getSettings, getSettingsForForm } from "@/server/settings";
import { listShipping, SHIPPING_TYPE_LABEL } from "@/server/shop/shipping-admin";
import { countryLabel, nextOrderNumberPreview, paymentReadiness, uncoveredCountries } from "@/server/shop/shop-settings";
import { listTaxClasses, taxClassUsage } from "@/server/shop/tax-admin";
import { deleteMethodAction, deleteTaxClassAction, deleteZoneAction, setDefaultTaxClassAction, toggleMethodAction } from "./actions";
import { CheckoutForm, GeneralForm, MethodForm, PaymentsForm, ShipToForm, TaxClassForm, TaxDisplayForm, ZoneForm } from "./forms";

export const metadata = { title: "Shop-Einstellungen" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const BASE = "/admin/shop-einstellungen";
const TABS = [
  { key: "allgemein", label: "Allgemein", icon: "store" as const },
  { key: "versand", label: "Versand", icon: "truck" as const },
  { key: "steuern", label: "Steuern", icon: "percent" as const },
  { key: "zahlung", label: "Zahlungsarten", icon: "card" as const },
  { key: "kasse", label: "Kasse", icon: "cart" as const },
];

export default async function ShopSettingsPage({ searchParams }: { searchParams: SP }) {
  await requirePermission("shop.settings");
  await requireModule("shop");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === one(sp.tab)) ? one(sp.tab) : "allgemein";
  const meldung = one(sp.meldung);
  const edit = one(sp.bearbeiten);

  return (
    <>
      <PageHeader title="Shop-Einstellungen" description="Bestellnummern, Versand, Mehrwertsteuer, Zahlungsarten und Kasse." />
      <Tabs items={TABS.map((t) => ({ ...t, href: t.key === "allgemein" ? BASE : `${BASE}?tab=${t.key}` }))} active={tab} label="Shop-Einstellungen" />
      {meldung && (
        <p className="a-alert a-alert--ok" role="status">
          <Icon name="check" size={16} />
          {meldung}
        </p>
      )}
      {tab === "allgemein" && <GeneralTab />}
      {tab === "versand" && <ShippingTab edit={edit} zoneParam={one(sp.zone)} />}
      {tab === "steuern" && <TaxTab edit={edit} />}
      {tab === "zahlung" && <PaymentsTab />}
      {tab === "kasse" && <CheckoutTab />}
    </>
  );
}

/* ------------------------------------------------------------ general */

async function GeneralTab() {
  const [shop, next] = await Promise.all([getSettings("shop"), nextOrderNumberPreview()]);
  return (
    <Panel className="a-panel--form">
      <GeneralForm shop={shop} nextNumber={next} storefront={(await getSettings("modules")).storefront} />
    </Panel>
  );
}

/* ------------------------------------------------------------ checkout */

async function CheckoutTab() {
  const shop = await getSettings("shop");
  return (
    <Panel className="a-panel--form">
      <CheckoutForm shop={shop} />
    </Panel>
  );
}

/* ------------------------------------------------------------ shipping */

async function ShippingTab({ edit, zoneParam }: { edit: string; zoneParam: string }) {
  const [zones, shop, uncovered, taxes] = await Promise.all([listShipping(), getSettings("shop"), uncoveredCountries(), listTaxClasses()]);
  const close = `${BASE}?tab=versand`;
  const [kind, id] = edit.split(":");
  const zone = kind === "zone" && id !== "neu" ? zones.find((z) => z.id === id) : undefined;
  const methods = zones.flatMap((z) => z.methods);
  const method = kind === "methode" && id !== "neu" ? methods.find((m) => m.id === id) : undefined;
  const zoneOpen = kind === "zone" && (id === "neu" || Boolean(zone));
  const methodOpen = kind === "methode" && zones.length > 0 && (id === "neu" || Boolean(method));
  const newZone = (
    <Link href={`${close}&bearbeiten=zone:neu`} scroll={false} className="a-btn a-btn--primary">
      <Icon name="plus" size={16} />
      Zone erstellen
    </Link>
  );

  return (
    <>
      {uncovered.length > 0 && (
        <p className="a-alert a-alert--error" role="alert">
          <Icon name="alert" size={16} />
          Keine aktive Versandart für {uncovered.map(countryLabel).join(", ")}. Kundinnen und Kunden aus {uncovered.length === 1 ? "diesem Land" : "diesen Ländern"} können nicht bestellen. Legen Sie eine Zone mit Versandart an oder entfernen Sie das Land aus den Lieferländern.
        </p>
      )}
      <Panel title="Lieferländer" description="In welche Länder Sie liefern. Für jedes Land braucht es eine Zone mit mindestens einer aktiven Versandart.">
        <ShipToForm countries={shop.shipToCountries} />
      </Panel>

      {zones.length === 0 ? (
        <Panel>
          <Empty icon="truck" title="Noch keine Versandzonen" action={newZone}>
            Eine Zone fasst Länder mit gleichen Versandkosten zusammen, z. B. «Schweiz & Liechtenstein». Danach fügen Sie Versandarten wie «PostPac Priority» oder «Abholung» hinzu.
          </Empty>
        </Panel>
      ) : (
        <>
          <div className="a-actions">{newZone}</div>
          {zones.map((z) => (
            <section key={z.id} className="a-panel s-zone">
              <div className="s-zone__head">
                <div>
                  <h2>{z.name}</h2>
                  <div className="s-zone__countries">
                    {z.countries.map((c) => (
                      <span key={c} className="a-tag" title={countryLabel(c)}>
                        {c === "*" ? "Übrige Welt" : c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="a-inline">
                  <Link href={`${close}&bearbeiten=zone:${z.id}`} scroll={false} className="a-btn a-btn--ghost a-btn--sm">
                    Zone bearbeiten
                  </Link>
                  <Link href={`${close}&bearbeiten=methode:neu&zone=${z.id}`} scroll={false} className="a-btn a-btn--ghost a-btn--sm">
                    <Icon name="plus" size={14} />
                    Versandart
                  </Link>
                </div>
              </div>
              {z.methods.length === 0 ? (
                <p className="a-small a-muted" style={{ padding: "0 22px 18px" }}>
                  Noch keine Versandart – ohne sie kann in diese Länder nicht bestellt werden.
                </p>
              ) : (
                <div className="a-tablewrap">
                  <table className="a-table a-table--stack">
                    <thead>
                      <tr>
                        <th>Versandart</th>
                        <th>Art</th>
                        <th className="a-num">Preis</th>
                        <th>Lieferzeit</th>
                        <th>Status</th>
                        <th>
                          <span className="sr-only">Aktionen</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {z.methods.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <Link href={`${close}&bearbeiten=methode:${m.id}`} scroll={false} className="a-link">
                              <strong>{m.name}</strong>
                            </Link>
                            {m.description && <div className="a-small a-muted">{m.description}</div>}
                          </td>
                          <td>{SHIPPING_TYPE_LABEL[m.type]}</td>
                          <td className="a-num">
                            {m.type === "free" || (m.type !== "weight" && m.price === 0) ? "Gratis" : m.type === "weight" ? `ab ${money(Math.min(...m.weightRates.map((r) => r.price)))}` : money(m.price)}
                            {m.freeAbove !== null && <div className="a-small a-muted">gratis ab {money(m.freeAbove)}</div>}
                          </td>
                          <td className="a-muted">{deliveryDays(m.deliveryDaysMin, m.deliveryDaysMax)}</td>
                          <td>{m.active ? <span className="a-pill a-pill--ok">Aktiv</span> : <span className="a-pill a-pill--muted">Inaktiv</span>}</td>
                          <td className="a-right">
                            <ActionButton action={toggleMethodAction} fields={{ id: m.id, active: m.active ? "0" : "1" }} label={m.active ? "Deaktivieren" : "Aktivieren"} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {zoneOpen && (
        <Drawer closeHref={close} title={zone ? `Zone «${zone.name}»` : "Neue Versandzone"} subtitle={zone ? `${zone.methods.length} Versandart${zone.methods.length === 1 ? "" : "en"}` : undefined}>
          <ZoneForm key={zone?.id ?? "neu"} current={zone ? { id: zone.id, name: zone.name, countries: zone.countries, sort: zone.sort } : null} />
          {zone && (
            <div className="a-danger">
              <h3>Zone löschen</h3>
              <p className="a-small a-muted">Löscht auch die {zone.methods.length} Versandarten dieser Zone. Bestehende Bestellungen bleiben unverändert.</p>
              <ActionButton action={deleteZoneAction} fields={{ id: zone.id }} label="Zone löschen" variant="danger" question={`Zone «${zone.name}» mit allen Versandarten löschen?`} />
            </div>
          )}
        </Drawer>
      )}
      {methodOpen && (
        <Drawer closeHref={close} title={method ? `«${method.name}» bearbeiten` : "Neue Versandart"}>
          <MethodForm
            key={method?.id ?? "neu"}
            current={method ?? null}
            zoneId={zones.some((z) => z.id === zoneParam) ? zoneParam : zones[0].id}
            zones={zones.map((z) => ({ id: z.id, name: z.name }))}
            taxClasses={taxes.map((t) => ({ id: t.id, name: `${t.name} (${percent(t.rateBp)})` }))}
          />
          {method && (
            <div className="a-danger">
              <h3>Versandart löschen</h3>
              <p className="a-small a-muted">Bestehende Bestellungen behalten ihre Versandkosten. Zum vorübergehenden Ausblenden besser deaktivieren.</p>
              <ActionButton action={deleteMethodAction} fields={{ id: method.id }} label="Versandart löschen" variant="danger" question={`Versandart «${method.name}» löschen?`} />
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}

function deliveryDays(min: number | null, max: number | null) {
  if (min === null && max === null) return "–";
  if (min !== null && max !== null && min !== max) return `${min}–${max} Tage`;
  const d = (min ?? max)!;
  return `${d} Tag${d === 1 ? "" : "e"}`;
}

/* ------------------------------------------------------------ taxes */

async function TaxTab({ edit }: { edit: string }) {
  const [classes, shop] = await Promise.all([listTaxClasses(), getSettings("shop")]);
  const close = `${BASE}?tab=steuern`;
  const current = edit && edit !== "neu" ? classes.find((c) => c.id === edit) : undefined;
  const open = edit === "neu" || Boolean(current);
  const usage = current ? await taxClassUsage(current.id) : null;
  const defaultName = classes.find((c) => c.isDefault)?.name ?? "Standard";

  return (
    <>
      <Panel title="Preiseingabe" description="Gilt für alle Preise im Dashboard, in den Shop-Seiten und in der API.">
        <TaxDisplayForm includeTax={shop.pricesIncludeTax} />
      </Panel>
      <Panel
        flush
        title="Steuerklassen"
        description="Jedes Produkt und jede Versandart hat eine Steuerklasse. Ohne Angabe gilt die Standardklasse."
        action={
          <Link href={`${close}&bearbeiten=neu`} scroll={false} className="a-btn a-btn--primary a-btn--sm">
            <Icon name="plus" size={14} />
            Steuerklasse
          </Link>
        }
      >
        {classes.length === 0 ? (
          <Empty icon="percent" title="Noch keine Steuerklassen" action={<Link href={`${close}&bearbeiten=neu`} className="a-btn a-btn--primary">Steuerklasse erstellen</Link>}>
            Legen Sie mindestens den Normalsatz (8.1 %) an. Ohne Steuerklasse wird keine MWST berechnet.
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th>Steuerklasse</th>
                  <th className="a-num">Satz</th>
                  <th className="a-num">Produkte</th>
                  <th className="a-num">Versandarten</th>
                  <th>
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`${close}&bearbeiten=${c.id}`} scroll={false} className="a-link">
                        <strong>{c.name}</strong>
                      </Link>{" "}
                      {c.isDefault && <span className="a-pill a-pill--info">Standard</span>}
                    </td>
                    <td className="a-num">{percent(c.rateBp)}</td>
                    <td className="a-num">
                      {c.products}
                      {c.defaultProducts > 0 && <div className="a-small a-muted">+ {c.defaultProducts} ohne Angabe</div>}
                    </td>
                    <td className="a-num">{c.shippingMethods}</td>
                    <td className="a-right">{!c.isDefault && <ActionButton action={setDefaultTaxClassAction} fields={{ id: c.id }} label="Als Standard" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {open && (
        <Drawer closeHref={close} title={current ? `«${current.name}» bearbeiten` : "Neue Steuerklasse"}>
          <TaxClassForm key={current?.id ?? "neu"} current={current ? { id: current.id, name: current.name, rateBp: current.rateBp, isDefault: current.isDefault } : null} />
          {current && !current.isDefault && usage && (
            <div className="a-danger">
              <h3>Steuerklasse löschen</h3>
              <p className="a-small a-muted">
                {usage.products
                  ? `${usage.products} Produkte (${usage.variants} Varianten) verwenden danach die Standardklasse «${defaultName}». Bestehende Bestellungen bleiben unverändert.`
                  : "Kein Produkt verwendet diese Klasse."}
              </p>
              <ActionButton action={deleteTaxClassAction} fields={{ id: current.id }} label="Steuerklasse löschen" variant="danger" question={`Steuerklasse «${current.name}» löschen?`} />
            </div>
          )}
        </Drawer>
      )}
    </>
  );
}

/* ------------------------------------------------------------ payments */

async function PaymentsTab() {
  const [form, readiness] = await Promise.all([getSettingsForForm("payments"), paymentReadiness()]);
  const { _secrets, ...p } = form; // secret fields are already blank here
  const active = readiness.filter((r) => r.enabled && !r.problems.length);
  return (
    <>
      {active.length === 0 && (
        <p className="a-alert a-alert--error" role="alert">
          <Icon name="alert" size={16} />
          Keine Zahlungsart ist vollständig eingerichtet. Ohne sie kann im Shop nicht bestellt werden.
        </p>
      )}
      <Panel className="a-panel--form">
        <PaymentsForm
          p={p}
          secrets={{ stripeSecretKey: _secrets.stripeSecretKey ?? "", stripeWebhookSecret: _secrets.stripeWebhookSecret ?? "", payrexxApiSecret: _secrets.payrexxApiSecret ?? "" }}
          readiness={readiness}
          webhooks={{ stripe: appUrl("/api/payments/stripe/webhook"), payrexx: appUrl("/api/payments/payrexx/webhook") }}
        />
      </Panel>
    </>
  );
}
