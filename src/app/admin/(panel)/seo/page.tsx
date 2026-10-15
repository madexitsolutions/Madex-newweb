import { allSeoPages } from "@/lib/seo-pages";
import { getSettings } from "@/lib/server/settings";
import { site } from "@/content/site";
import { SeoEditor } from "./editor";

export const metadata = { title: "SEO" };

export default async function Seo({ searchParams }: { searchParams: Promise<{ q?: string; group?: string }> }) {
  const sp = await searchParams;
  const { seo } = await getSettings();
  const q = (sp.q ?? "").toLowerCase();
  const pages = allSeoPages().filter((p) => (!sp.group || p.group === sp.group) && (!q || p.path.includes(q) || p.title.toLowerCase().includes(q)));
  const custom = Object.keys(seo).length;
  return (
    <>
      <header className="a-head">
        <h1>SEO</h1>
        <p className="a-muted">
          Titel und Beschreibung, wie sie bei Google erscheinen – pro Seite. Leere Felder verwenden den Standardtext. {custom > 0 && `${custom} Seiten sind angepasst.`}
        </p>
      </header>
      <form className="a-filters" role="search">
        <label className="a-field a-field--grow">
          <span className="sr-only">Seite suchen</span>
          <input name="q" defaultValue={sp.q} placeholder="Seite oder Titel suchen …" />
        </label>
        <label className="a-field">
          <span className="sr-only">Bereich</span>
          <select name="group" defaultValue={sp.group ?? ""}>
            <option value="">Alle Bereiche</option>
            <option>Seiten</option>
            <option>Leistungen</option>
            <option>Beiträge</option>
          </select>
        </label>
        <button className="a-btn a-btn--primary">Filtern</button>
      </form>
      <div className="a-stack">
        {pages.map((p) => (
          <SeoEditor key={p.path} page={p} override={seo[p.path]} origin={site.url} />
        ))}
      </div>
    </>
  );
}
