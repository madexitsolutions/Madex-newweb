import { inArray } from "drizzle-orm";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Icon, PageHeader, Panel, Tabs, one } from "@/components/admin/kit";
import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker";
import { RichText } from "@/components/admin/rich-text";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { appUrl } from "@/server/lib/app-url";
import { siteContent } from "@/server/site/content";
import { getSettings } from "@/server/settings";
import { CONTENT, type ContentField } from "@/site/fields";
import { resetTextsAction, saveTextsAction } from "./actions";
import "../../content.css";
import "../../system.css";
import "../seiten/website.css";
import "../plugins/plugins.css";
import "./texte.css";

export const metadata = { title: "Texte & Bilder" };

export default async function TextsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("website.manage");
  const sp = await searchParams;
  const group = CONTENT.find((g) => g.key === one(sp.bereich)) ?? CONTENT[0];
  const [values, stored] = await Promise.all([siteContent(), getSettings("siteContent")]);
  const changed = group.fields.filter((f) => stored[f.key] !== undefined && stored[f.key] !== f.default).length;

  const imagePaths = group.fields.filter((f) => f.type === "image" && values[f.key].startsWith("/uploads/")).map((f) => values[f.key].slice("/uploads/".length));
  const files = imagePaths.length ? await db.select().from(media).where(inArray(media.path, imagePaths)) : [];
  const picked = (url: string): PickedMedia[] => {
    const m = files.find((x) => `/uploads/${x.path}` === url);
    return m ? [{ id: m.id, path: m.path, alt: m.alt, filename: m.filename, mime: m.mime }] : [];
  };

  return (
    <>
      <PageHeader
        title="Texte & Bilder"
        description="Überschriften, Texte, Bilder und Knöpfe der Website direkt ändern. Leere Felder werden auf der Website ausgeblendet."
        actions={
          <a href={appUrl("/")} target="_blank" rel="noopener" className="a-btn a-btn--ghost">
            <Icon name="external" size={16} />
            Website ansehen
          </a>
        }
      />
      <Tabs label="Bereich" active={group.key} items={CONTENT.map((g) => ({ key: g.key, label: g.title, href: `/admin/texte?bereich=${g.key}` }))} />
      <div className="s-twocol tx-layout">
        <Panel className="a-panel--form">
          <ActionForm action={saveTextsAction} className="a-form" key={group.key}>
            <input type="hidden" name="_group" value={group.key} />
            <div className="a-form__intro">
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <div className="tx-fields">
              {group.fields.map((f) => (
                <Field key={f.key} field={f} value={values[f.key]} picked={f.type === "image" ? picked(values[f.key]) : []} canUpload={user.permissions.has("media.manage")} />
              ))}
            </div>
            <div className="a-savebar">
              <Submit>Speichern</Submit>
              {changed > 0 && <span className="a-small0 a-muted">{changed} von {group.fields.length} Feldern angepasst</span>}
            </div>
          </ActionForm>
        </Panel>
        <div className="a-stack">
          <Panel title="So funktioniert es">
            <ul className="pl-list tx-help">
              <li>Änderungen sind nach dem Speichern sofort auf der Website sichtbar.</li>
              <li>Ein leeres Feld blendet den Text oder Knopf auf der Website aus.</li>
              <li>Bilder kommen aus der Mediathek – neue können Sie direkt hochladen.</li>
              <li>Weitere Felder richtet Madex auf Wunsch ein, ohne dass Sie Code anfassen müssen.</li>
            </ul>
          </Panel>
          {changed > 0 && (
            <Panel title="Zurücksetzen" description={`Alle Felder im Bereich «${group.title}» auf die ursprünglichen Texte zurücksetzen.`}>
              <ActionButton action={resetTextsAction} fields={{ _group: group.key }} label="Standardtexte wiederherstellen" variant="danger" question={`Alle Änderungen im Bereich «${group.title}» verwerfen?`} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ field, value, picked, canUpload }: { field: ContentField; value: string; picked: PickedMedia[]; canUpload: boolean }) {
  if (field.type === "toggle")
    return (
      <label className="a-check a-check--box tx-field--wide">
        <input type="checkbox" name={field.key} defaultChecked={value === "1"} />
        <span>
          {field.label}
          {field.help && <small>{field.help}</small>}
        </span>
      </label>
    );
  if (field.type === "image")
    return (
      <div className="tx-field--wide">
        <MediaPicker name={field.key} label={field.label} defaultValue={picked} canUpload={canUpload} help={field.help} />
      </div>
    );
  if (field.type === "richtext")
    return (
      <div className="tx-field--wide">
        <RichText name={field.key} label={field.label} defaultValue={value} minHeight={180} help={field.help} />
      </div>
    );
  return (
    <label className={`a-field${field.type === "textarea" ? " tx-field--wide" : ""}`}>
      <span>{field.label}</span>
      {field.type === "textarea" ? (
        <textarea name={field.key} defaultValue={value} rows={3} maxLength={2000} />
      ) : (
        <input name={field.key} defaultValue={value} maxLength={field.type === "url" ? 500 : 300} placeholder={field.type === "url" ? "/kontakt oder https://…" : undefined} spellCheck={field.type !== "url"} inputMode={field.type === "url" ? "url" : undefined} />
      )}
      {field.help && <small>{field.help}</small>}
    </label>
  );
}
