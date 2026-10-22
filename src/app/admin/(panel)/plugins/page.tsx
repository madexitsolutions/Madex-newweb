import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { Empty, Icon, PageHeader, Tabs, one } from "@/components/admin/kit";
import { AVAILABLE_PLUGINS as PLUGINS, PLUGIN_CATEGORIES } from "@/modules/registry";
import { requirePermission } from "@/server/auth/session";
import { pluginSetupStates } from "@/server/plugins";
import { getSettings } from "@/server/settings";
import { togglePluginAction } from "./actions";
import "../../system.css";
import "./plugins.css";

export const metadata = { title: "Plugins" };

export default async function PluginsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("settings.manage");
  const sp = await searchParams;
  const filter = one(sp.filter) === "aktiv" ? "aktiv" : one(sp.filter) === "inaktiv" ? "inaktiv" : "alle";
  const [m, states] = await Promise.all([getSettings("modules"), pluginSetupStates()]);
  const active = PLUGINS.filter((p) => m[p.key]).length;
  const shown = PLUGINS.filter((p) => (filter === "aktiv" ? m[p.key] : filter === "inaktiv" ? !m[p.key] : true));

  return (
    <>
      <PageHeader
        title="Plugins"
        description="Funktionen für diese Website ein- und ausschalten. Ein aktiviertes Plugin bringt seine Seiten im Dashboard und auf der Website mit. Beim Deaktivieren bleiben alle Daten erhalten."
        meta={
          <span className="a-pill a-pill--info">
            {active} von {PLUGINS.length} aktiv
          </span>
        }
      />
      <Tabs
        variant="segment"
        label="Plugins filtern"
        active={filter}
        items={[
          { key: "alle", label: "Alle", href: "/admin/plugins", count: PLUGINS.length },
          { key: "aktiv", label: "Aktiv", href: "/admin/plugins?filter=aktiv", count: active },
          { key: "inaktiv", label: "Inaktiv", href: "/admin/plugins?filter=inaktiv", count: PLUGINS.length - active },
        ]}
      />
      {shown.length === 0 && (
        <Empty icon="plug" title={filter === "aktiv" ? "Noch kein Plugin aktiv" : "Alle Plugins sind aktiv"}>
          {filter === "aktiv" ? "Aktivieren Sie unter «Alle» die Funktionen, die diese Website braucht – zum Beispiel Shop, Kontaktformular oder Google Analytics." : "Es gibt keine weiteren Plugins."}
        </Empty>
      )}
      {PLUGIN_CATEGORIES.map((cat) => {
        const list = shown.filter((p) => p.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="pl-group" aria-labelledby={`pl-${cat}`}>
            <h2 id={`pl-${cat}`} className="pl-group__title">
              {cat}
            </h2>
            <div className="pl-grid">
              {list.map((p) => {
                const on = m[p.key];
                const state = states[p.key];
                return (
                  <article key={p.key} className={`pl-card${on ? " is-on" : ""}`}>
                    <header className="pl-card__head">
                      <span className="pl-card__icon" aria-hidden="true">
                        <Icon name={p.icon} size={22} />
                      </span>
                      <div className="pl-card__title">
                        <h3>{p.name}</h3>
                        {on ? <span className="a-pill a-pill--ok">Aktiv</span> : <span className="a-pill a-pill--muted">Inaktiv</span>}
                      </div>
                    </header>
                    <p className="pl-card__desc">{p.description}</p>
                    {(p.dashboard.length > 0 || p.website.length > 0) && (
                      <dl className="pl-card__adds">
                        {p.dashboard.length > 0 && (
                          <div>
                            <dt>Im Dashboard</dt>
                            <dd>{p.dashboard.join(", ")}</dd>
                          </div>
                        )}
                        {p.website.length > 0 && (
                          <div>
                            <dt>Auf der Website</dt>
                            <dd>{p.website.join(", ")}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    {on && state && (
                      <p className={`pl-card__state pl-card__state--${state.tone}`}>
                        <Icon name={state.tone === "ok" ? "check" : state.tone === "warn" ? "alert" : "sparkle"} size={15} />
                        {state.text}
                      </p>
                    )}
                    <footer className="pl-card__foot">
                      {on ? (
                        <>
                          {p.setup && (
                            <Link href={p.setup.href} className="a-btn a-btn--primary a-btn--sm">
                              <Icon name="gear" size={15} />
                              {p.setup.label}
                            </Link>
                          )}
                          <ActionButton action={togglePluginAction} fields={{ key: p.key, active: "0" }} label="Deaktivieren" variant="quiet" pending="Wird deaktiviert …" question={`«${p.name}» deaktivieren? Seiten des Plugins verschwinden aus Dashboard und Website, die Daten bleiben erhalten.`} />
                        </>
                      ) : (
                        <ActionButton action={togglePluginAction} fields={{ key: p.key, active: "1" }} label="Aktivieren" variant="ghost" pending="Wird aktiviert …" icon={<Icon name="plus" size={15} />} />
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
