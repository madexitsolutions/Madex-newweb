import Link from "next/link";
import { Drawer } from "@/components/admin/drawer";
import { CopyButton } from "@/components/admin/forms";
import { Empty, Icon, PageHeader, Pager, Tabs, one, qs } from "@/components/admin/kit";
import { requirePermission } from "@/server/auth/session";
import { getMedia, listMedia, mediaTypeCounts, mediaUsage, type MediaType } from "@/server/media/library";
import { mediaPath, mediaUrl } from "@/server/media/store";
import { date, dateTime, number } from "@/lib/format";
import { AltForm, DeleteMediaForm, LibraryUploader } from "./client";
import "../../content.css";

export const metadata = { title: "Mediathek" };

const PER_PAGE = 40;
const TYPE_PARAM: Record<string, MediaType> = { bilder: "image", pdf: "pdf" };

function fileSize(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toLocaleString("de-CH", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

const kind = (mime: string) => (mime === "application/pdf" ? "PDF" : mime === "image/svg+xml" ? "SVG" : mime.replace("image/", "").toUpperCase().replace("JPEG", "JPG"));

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("media.manage");
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100);
  const typ = one(sp.typ);
  const type = TYPE_PARAM[typ] ?? "all";
  const view = one(sp.ansicht) === "liste" ? "liste" : "raster";
  const page = Math.max(1, Number(one(sp.seite)) || 1);
  const openId = one(sp.datei);

  const [{ rows, total }, counts, opened] = await Promise.all([listMedia({ q, type }, page, PER_PAGE), mediaTypeCounts(q), openId ? getMedia(openId) : null]);
  const usage = opened ? await mediaUsage(opened) : [];
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const base = { q, typ: typ in TYPE_PARAM ? typ : undefined, ansicht: view === "liste" ? "liste" : undefined };
  const href = (p: Record<string, string | number | undefined>) => `/madexadm/medien${qs({ ...base, seite: page > 1 ? page : undefined, ...p })}`;
  const closeHref = href({});

  return (
    <>
      <PageHeader title="Mediathek" description="Alle Bilder und Dokumente an einem Ort. Klicken Sie auf eine Datei für Details, Alternativtext und Verwendung." />
      <LibraryUploader startOpen={counts.all === 0 && !q} />

      <div className="a-toolbar">
        <div className="a-toolbar__row">
          <form className="a-search" role="search" action="/madexadm/medien">
            <Icon name="search" size={16} />
            <label className="sr-only" htmlFor="mx-q">
              Dateien suchen
            </label>
            <input id="mx-q" type="search" name="q" defaultValue={q} placeholder="Dateiname oder Alternativtext" />
            {base.typ && <input type="hidden" name="typ" value={base.typ} />}
            {base.ansicht && <input type="hidden" name="ansicht" value={base.ansicht} />}
          </form>
          <Tabs
            variant="segment"
            label="Ansicht"
            active={view}
            items={[
              { key: "raster", label: "Raster", icon: "layers", href: `/madexadm/medien${qs({ ...base, ansicht: undefined })}` },
              { key: "liste", label: "Liste", icon: "list", href: `/madexadm/medien${qs({ ...base, ansicht: "liste" })}` },
            ]}
          />
        </div>
        <div className="a-chips" role="group" aria-label="Dateityp">
          {[
            { key: "", label: "Alle", n: counts.all },
            { key: "bilder", label: "Bilder", n: counts.image },
            { key: "pdf", label: "PDF", n: counts.pdf },
          ].map((c) => (
            <Link key={c.key || "all"} href={`/madexadm/medien${qs({ ...base, typ: c.key || undefined })}`} className={`a-chip${(base.typ ?? "") === c.key ? " is-active" : ""}`} aria-current={(base.typ ?? "") === c.key ? "true" : undefined} scroll={false}>
              {c.label} <span className="a-chip__count">{number(c.n)}</span>
            </Link>
          ))}
        </div>
      </div>

      <section className="a-panel a-panel--flush" aria-label="Dateien">
        {rows.length === 0 ? (
          <Empty icon="image" title={q || type !== "all" ? "Keine Dateien gefunden" : "Noch keine Dateien"}>
            {q || type !== "all" ? (
              <>
                Passen Sie Suche oder Filter an oder{" "}
                <Link href="/madexadm/medien" className="a-link">
                  alle Dateien anzeigen
                </Link>
                .
              </>
            ) : (
              "Ziehen Sie Bilder oder PDFs in das Feld oben, um sie hochzuladen."
            )}
          </Empty>
        ) : view === "raster" ? (
          <ul className="mx-grid">
            {rows.map((m) => (
              <li key={m.id}>
                <Link href={href({ datei: m.id })} scroll={false} className={`mx-tile${m.id === openId ? " is-selected" : ""}`} aria-label={`${m.filename}, ${kind(m.mime)}, ${fileSize(m.size)}`}>
                  <span className="mx-tile__media">
                    {m.mime.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaPath(m.path)} alt="" loading="lazy" />
                    ) : (
                      <span className="mx-tile__doc">
                        <Icon name="file" size={28} />
                        PDF
                      </span>
                    )}
                    {!m.alt && m.mime.startsWith("image/") && <span className="mx-tile__flag">Ohne Alt-Text</span>}
                  </span>
                  <span className="mx-tile__name">{m.filename}</span>
                  <span className="mx-tile__meta">
                    {kind(m.mime)} · {fileSize(m.size)}
                    {m.width ? ` · ${m.width}×${m.height}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Datei</th>
                  <th scope="col">Typ</th>
                  <th scope="col" className="a-num">
                    Grösse
                  </th>
                  <th scope="col">Abmessungen</th>
                  <th scope="col">Alternativtext</th>
                  <th scope="col">Hochgeladen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className={m.id === openId ? "is-selected" : undefined}>
                    <td>
                      <div className="a-cellmain">
                        {m.mime.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mediaPath(m.path)} alt="" className="a-thumb" loading="lazy" />
                        ) : (
                          <span className="a-thumb mx-thumbdoc">
                            <Icon name="file" size={18} />
                          </span>
                        )}
                        <Link href={href({ datei: m.id })} scroll={false} className="a-rowlink mx-clipname">
                          {m.filename}
                        </Link>
                      </div>
                    </td>
                    <td data-label="Typ">{kind(m.mime)}</td>
                    <td className="a-num" data-label="Grösse">
                      {fileSize(m.size)}
                    </td>
                    <td data-label="Abmessungen">{m.width ? `${m.width} × ${m.height}` : "–"}</td>
                    <td className="a-clip" data-label="Alt">
                      {m.alt || <span className="a-muted">fehlt</span>}
                    </td>
                    <td data-label="Hochgeladen" className="a-nowrap">
                      {date(m.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={pages} total={total} from={total ? (page - 1) * PER_PAGE + 1 : 0} to={Math.min(total, page * PER_PAGE)} href={(p) => `/madexadm/medien${qs({ ...base, seite: p > 1 ? p : undefined })}`} />
      </section>

      {openId && !opened && (
        <Drawer closeHref={closeHref} title="Datei nicht gefunden">
          <div className="mx-detail">
            <p className="a-muted">Die Datei wurde gelöscht oder der Link ist ungültig.</p>
          </div>
        </Drawer>
      )}
      {opened && (
        <Drawer closeHref={closeHref} title={opened.filename} subtitle={`${kind(opened.mime)} · ${fileSize(opened.size)}${opened.width ? ` · ${opened.width} × ${opened.height} px` : ""}`}>
          <div className="mx-detail">
            <div className="mx-preview">
              {opened.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaPath(opened.path)} alt={opened.alt} />
              ) : (
                <a href={mediaPath(opened.path)} target="_blank" rel="noopener" className="mx-preview__doc">
                  <Icon name="file" size={36} />
                  <span>PDF öffnen</span>
                </a>
              )}
            </div>
            {opened.mime.startsWith("image/") && <AltForm key={opened.id} id={opened.id} alt={opened.alt} />}
            <dl className="a-dl">
              <div>
                <dt>Dateiname</dt>
                <dd>{opened.filename}</dd>
              </div>
              <div>
                <dt>Grösse</dt>
                <dd>{fileSize(opened.size)}</dd>
              </div>
              <div>
                <dt>Abmessungen</dt>
                <dd>{opened.width ? `${opened.width} × ${opened.height} px` : "–"}</dd>
              </div>
              <div>
                <dt>Hochgeladen</dt>
                <dd>{dateTime(opened.createdAt)}</dd>
              </div>
            </dl>
            <div className="a-field">
              <span>Adresse (URL)</span>
              <div className="mx-url">
                <code>{mediaUrl(opened.path)}</code>
                <CopyButton value={mediaUrl(opened.path)} />
              </div>
            </div>
            <div className="mx-usage">
              <h3>Verwendet in</h3>
              {usage.length === 0 ? (
                <p className="a-muted a-small0">Nirgends – die Datei kann gefahrlos gelöscht werden.</p>
              ) : (
                <ul>
                  {usage.map((u, i) => (
                    <li key={i}>
                      <Icon name={u.kind === "post" || u.kind === "post_body" ? "file" : u.kind === "branding" ? "gear" : u.kind === "seo" ? "search" : u.kind === "category" ? "layers" : "box"} size={16} />
                      {u.href ? (
                        <Link href={u.href} className="a-link">
                          {u.label}
                        </Link>
                      ) : (
                        u.label
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={`a-danger mx-danger${usage.length ? " is-used" : ""}`}>
              <div>
                <h2>Datei löschen</h2>
                <p>{usage.length ? `Achtung: wird noch ${usage.length}× verwendet. Dort fehlt das Bild danach.` : "Kann nicht rückgängig gemacht werden."}</p>
              </div>
              <DeleteMediaForm key={opened.id} id={opened.id} used={usage.length} back={closeHref} />
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
