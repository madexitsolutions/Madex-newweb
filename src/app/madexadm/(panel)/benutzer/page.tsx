import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { Drawer } from "@/components/admin/drawer";
import { ActionForm, Submit } from "@/components/admin/forms";
import { Empty, Icon, PageHeader, Panel, Tabs, one, qs } from "@/components/admin/kit";
import { dateTime, relative } from "@/lib/format";
import { ALL_PERMISSIONS } from "@/server/auth/permissions";
import { requirePermission, type CurrentUser } from "@/server/auth/session";
import { ADMIN_ONLY_PERMISSIONS, listRoles, permissionGroups } from "@/server/roles";
import { getUser, isPrivileged, listInvitations, listUsers, roleAssignError, sessionCount } from "@/server/users";
import {
  changeRoleAction,
  deleteRoleAction,
  deleteUserAction,
  inviteAction,
  resendInviteAction,
  resetTwoFactorAction,
  revokeInviteAction,
  saveRoleAction,
  signOutUserAction,
  userStatusAction,
} from "./actions";
import { PermissionMatrix } from "./permission-matrix";
import "../../system.css";

export const metadata = { title: "Benutzer & Rollen" };

type SP = Promise<Record<string, string | string[] | undefined>>;
type Roles = Awaited<ReturnType<typeof listRoles>>;

const BASE = "/madexadm/benutzer";

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  const me = await requirePermission("users.view");
  const sp = await searchParams;
  const tab = ["rollen", "einladungen"].includes(one(sp.tab)) ? one(sp.tab) : "benutzer";
  const canManage = me.permissions.has("users.manage");
  const canRoles = me.permissions.has("roles.manage");

  const [allUsers, roles, invites] = await Promise.all([listUsers(), listRoles(), listInvitations()]);

  const tabs = [
    { key: "benutzer", label: "Benutzer", href: BASE, count: allUsers.length, icon: "users" as const },
    { key: "rollen", label: "Rollen", href: `${BASE}?tab=rollen`, count: roles.length, icon: "key" as const },
    { key: "einladungen", label: "Einladungen", href: `${BASE}?tab=einladungen`, count: invites.length, icon: "mail" as const },
  ];

  return (
    <>
      <PageHeader
        title="Benutzer & Rollen"
        description="Wer Zugriff auf das Dashboard hat und was diese Personen tun dürfen. Jede Änderung wird im Protokoll festgehalten."
        actions={
          canManage ? (
            <Link href={`${BASE}${qs({ tab: tab === "benutzer" ? undefined : tab, einladen: 1 })}`} className="a-btn a-btn--primary" scroll={false}>
              <Icon name="plus" size={16} />
              Person einladen
            </Link>
          ) : undefined
        }
      />
      <Tabs items={tabs} active={tab} label="Bereiche" />
      {one(sp.geloescht) && (
        <p className="a-alert a-alert--ok" role="status">
          Das Konto wurde gelöscht. Einträge im Protokoll bleiben erhalten.
        </p>
      )}

      {tab === "benutzer" && <UsersTab me={me} sp={sp} canManage={canManage} />}
      {tab === "rollen" && <RolesTab me={me} roles={roles} canRoles={canRoles} saved={one(sp.gespeichert)} />}
      {tab === "einladungen" && <InvitesTab invites={invites} canManage={canManage} />}

      {canManage && one(sp.einladen) && <InviteDrawer me={me} roles={roles} closeHref={`${BASE}${qs({ tab: tab === "benutzer" ? undefined : tab })}`} />}
      {tab === "benutzer" && one(sp.bearbeiten) && <UserDrawer me={me} id={one(sp.bearbeiten)} roles={roles} canManage={canManage} closeHref={`${BASE}${qs({ q: one(sp.q), status: one(sp.status) })}`} />}
      {tab === "rollen" && one(sp.rolle) && <RoleDrawer me={me} roles={roles} id={one(sp.rolle)} template={one(sp.vorlage)} canRoles={canRoles} />}
    </>
  );
}

/* ---------------------------------------------------------------- users */

function statusPill(u: { status: string; lockedUntil: Date | null }) {
  if (u.status === "disabled") return <span className="a-pill a-pill--muted">Gesperrt</span>;
  if (u.lockedUntil && u.lockedUntil > new Date()) return <span className="a-pill a-pill--warn">Vorübergehend gesperrt</span>;
  return <span className="a-pill a-pill--ok">Aktiv</span>;
}

async function UsersTab({ me, sp, canManage }: { me: CurrentUser; sp: Record<string, string | string[] | undefined>; canManage: boolean }) {
  const q = one(sp.q);
  const status = one(sp.status) === "active" || one(sp.status) === "disabled" ? (one(sp.status) as "active" | "disabled") : "";
  const rows = await listUsers({ q, status });
  const all = await listUsers();
  const chip = (key: string, label: string, n: number) => (
    <Link href={`${BASE}${qs({ q, status: key })}`} className={`a-chip${status === key ? " is-active" : ""}`} aria-current={status === key ? "true" : undefined} scroll={false}>
      {label} <span className="a-chip__count">{n}</span>
    </Link>
  );
  return (
    <>
      <div className="a-toolbar__row">
        <form className="a-search" role="search" action={BASE}>
          <Icon name="search" size={16} />
          <label className="sr-only" htmlFor="user-q">
            Benutzer suchen
          </label>
          <input id="user-q" name="q" type="search" defaultValue={q} placeholder="Name oder E-Mail suchen" />
          {status && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="a-chips" aria-label="Status">
          {chip("", "Alle", all.length)}
          {chip("active", "Aktiv", all.filter((u) => u.status === "active").length)}
          {chip("disabled", "Gesperrt", all.filter((u) => u.status === "disabled").length)}
        </div>
      </div>
      <Panel flush>
        {rows.length === 0 ? (
          <Empty icon="users" title={q || status ? "Keine Treffer" : "Noch keine weiteren Personen"} action={q || status ? <Link href={BASE} className="a-btn a-btn--ghost a-btn--sm">Filter zurücksetzen</Link> : undefined}>
            {q || status ? "Ändern Sie die Suche oder den Filter." : canManage ? "Laden Sie Mitarbeitende über «Person einladen» ein. Sie erhalten einen Link per E-Mail." : "Hier erscheinen alle Personen mit Zugang."}
          </Empty>
        ) : (
          <div className="a-tablewrap">
            <table className="a-table a-table--stack">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Rolle</th>
                  <th scope="col">Status</th>
                  <th scope="col">2FA</th>
                  <th scope="col">Letzte Anmeldung</th>
                  <th scope="col">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="s-person">
                        <span className="s-avatar" aria-hidden="true">
                          {initials(u.name)}
                        </span>
                        <div>
                          <Link href={`${BASE}${qs({ q, status, bearbeiten: u.id })}`} className="a-rowlink" scroll={false}>
                            {u.name}
                          </Link>
                          {u.id === me.id && <span className="a-pill a-pill--accent s-you">Sie</span>}
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Rolle">{u.roleName}</td>
                    <td data-label="Status">{statusPill(u)}</td>
                    <td data-label="2FA">{u.totpEnabled ? <span className="a-state a-state--ok">An</span> : <span className="a-state a-state--bad">Aus</span>}</td>
                    <td data-label="Zuletzt">
                      {u.lastLoginAt ? <span title={dateTime(u.lastLoginAt)}>{relative(u.lastLoginAt)}</span> : <span className="a-muted">Noch nie</span>}
                    </td>
                    <td className="a-actions">
                      <Link href={`${BASE}${qs({ q, status, bearbeiten: u.id })}`} className="a-btn a-btn--quiet a-btn--sm" scroll={false} aria-label={`${u.name} ${canManage ? "bearbeiten" : "ansehen"}`}>
                        {canManage ? "Bearbeiten" : "Ansehen"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function assignable(me: CurrentUser, roles: Roles) {
  return roles.filter((r) => !roleAssignError(me, r));
}

async function UserDrawer({ me, id, roles, canManage, closeHref }: { me: CurrentUser; id: string; roles: Roles; canManage: boolean; closeHref: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const t = await getUser(id);
  if (!t || t.user.status === "invited") return null;
  const { user, role } = t;
  const self = user.id === me.id;
  const ownerGuard = role.key === "owner" && me.role.key !== "owner";
  const editable = canManage && !self && !ownerGuard;
  const sessions = await sessionCount(user.id);
  const options = assignable(me, roles);
  const locked = user.lockedUntil && user.lockedUntil > new Date();

  return (
    <Drawer closeHref={closeHref} title={user.name} subtitle={user.email}>
      <div className="s-dbody">
        <dl className="a-dl">
          <div>
            <dt>Rolle</dt>
            <dd>{role.name}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusPill(user)}</dd>
          </div>
          <div>
            <dt>Zwei-Faktor-Anmeldung</dt>
            <dd>{user.totpEnabled ? `Eingerichtet (${user.recoveryCodes.length} Wiederherstellungscodes übrig)` : "Nicht eingerichtet"}</dd>
          </div>
          <div>
            <dt>Aktive Sitzungen</dt>
            <dd>{sessions}</dd>
          </div>
          <div>
            <dt>Letzte Anmeldung</dt>
            <dd>{user.lastLoginAt ? dateTime(user.lastLoginAt) : "Noch nie"}</dd>
          </div>
          <div>
            <dt>Konto erstellt</dt>
            <dd>{dateTime(user.createdAt)}</dd>
          </div>
          {locked && (
            <div>
              <dt>Gesperrt bis</dt>
              <dd>{dateTime(user.lockedUntil)}</dd>
            </div>
          )}
        </dl>

        {self && (
          <p className="s-note">
            <Icon name="user" size={16} />
            <span>
              Das ist Ihr eigenes Konto. Passwort, 2FA und Sitzungen verwalten Sie unter{" "}
              <Link href="/madexadm/konto" className="a-link">
                Mein Konto
              </Link>
              . Ihre Rolle kann nur eine andere Person mit entsprechender Berechtigung ändern.
            </span>
          </p>
        )}
        {ownerGuard && canManage && (
          <p className="s-note">
            <Icon name="lock" size={16} />
            <span>Konten mit der Rolle Inhaber können nur von Inhabern geändert werden.</span>
          </p>
        )}

        {editable && (
          <>
            <section className="s-dsec" aria-labelledby="sec-role">
              <h3 id="sec-role">Rolle</h3>
              <ActionForm action={changeRoleAction} className="s-inlineform">
                <input type="hidden" name="userId" value={user.id} />
                <label className="a-field a-field--grow">
                  <span className="sr-only">Rolle</span>
                  <select name="roleId" defaultValue={role.id}>
                    {options.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                    {!options.some((r) => r.id === role.id) && (
                      <option value={role.id} disabled>
                        {role.name}
                      </option>
                    )}
                  </select>
                </label>
                <Submit>Rolle speichern</Submit>
              </ActionForm>
              <p className="a-footnote">Sie sehen nur Rollen, die Sie vergeben dürfen.</p>
            </section>

            <section className="s-dsec" aria-labelledby="sec-access">
              <h3 id="sec-access">Zugang</h3>
              <div className="s-actionlist">
                <div className="s-actionrow">
                  <div>
                    <strong>{user.status === "disabled" ? "Konto entsperren" : "Konto sperren"}</strong>
                    <small>{user.status === "disabled" ? "Die Person kann sich wieder anmelden." : "Meldet die Person sofort ab und verhindert neue Anmeldungen. Daten bleiben erhalten."}</small>
                  </div>
                  <ActionButton
                    action={userStatusAction}
                    fields={{ userId: user.id, status: user.status === "disabled" ? "active" : "disabled" }}
                    label={user.status === "disabled" ? "Entsperren" : "Sperren"}
                    question={user.status === "disabled" ? undefined : `${user.name} sperren und abmelden?`}
                  />
                </div>
                {user.totpEnabled && (
                  <div className="s-actionrow">
                    <div>
                      <strong>2FA zurücksetzen</strong>
                      <small>Bei verlorenem Telefon: Die Person richtet die Zwei-Faktor-Anmeldung bei der nächsten Anmeldung neu ein.</small>
                    </div>
                    <ActionButton action={resetTwoFactorAction} fields={{ userId: user.id }} label="Zurücksetzen" question={`Zwei-Faktor-Anmeldung von ${user.name} zurücksetzen? Die Person wird abgemeldet.`} />
                  </div>
                )}
                <div className="s-actionrow">
                  <div>
                    <strong>Alle Sitzungen beenden</strong>
                    <small>{sessions ? `Meldet die Person auf ${sessions === 1 ? "einem Gerät" : `${sessions} Geräten`} ab.` : "Die Person ist derzeit nirgends angemeldet."}</small>
                  </div>
                  <ActionButton action={signOutUserAction} fields={{ userId: user.id }} label="Abmelden" question={`${user.name} auf allen Geräten abmelden?`} />
                </div>
              </div>
            </section>

            <div className="a-danger">
              <div>
                <h2>Konto löschen</h2>
                <p>Entfernt den Zugang endgültig. Das Protokoll behält die Einträge mit der E-Mail-Adresse.</p>
              </div>
              <ActionButton action={deleteUserAction} fields={{ userId: user.id }} label="Löschen" variant="danger" small={false} question={`${user.name} (${user.email}) endgültig löschen?`} />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

function InviteDrawer({ me, roles, closeHref }: { me: CurrentUser; roles: Roles; closeHref: string }) {
  const options = assignable(me, roles);
  const preferred = options.find((r) => r.key === "editor") ?? options[options.length - 1];
  return (
    <Drawer closeHref={closeHref} title="Person einladen" subtitle="Die Person erhält einen Link per E-Mail, legt ihr Passwort fest und richtet die Zwei-Faktor-Anmeldung ein.">
      <ActionForm action={inviteAction} className="a-seoform" resetOnSuccess>
        <div className="a-seoform__body">
          <label className="a-field">
            <span>Name</span>
            <input name="name" autoComplete="off" required maxLength={100} placeholder="Vorname Nachname" />
          </label>
          <label className="a-field">
            <span>E-Mail</span>
            <input name="email" type="email" autoComplete="off" required placeholder="name@firma.ch" />
          </label>
          <fieldset className="s-radiocards">
            <legend>Rolle</legend>
            {options.map((r) => (
              <label key={r.id} className="a-check a-check--box">
                <input type="radio" name="roleId" value={r.id} defaultChecked={r.id === preferred?.id} />
                <span>
                  {r.name}
                  <small>{r.description || `${r.permissions.length} Berechtigungen`}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="a-footnote">Der Link ist 7 Tage gültig und funktioniert einmal. Unter «Einladungen» können Sie ihn erneut senden oder zurückziehen.</p>
        </div>
        <div className="a-savebar">
          <Submit pending="Wird gesendet …">Einladung senden</Submit>
          <Link href={closeHref} className="a-btn a-btn--quiet" scroll={false}>
            Abbrechen
          </Link>
        </div>
      </ActionForm>
    </Drawer>
  );
}

/* ---------------------------------------------------------------- roles */

function RolesTab({ me, roles, canRoles, saved }: { me: CurrentUser; roles: Roles; canRoles: boolean; saved: string }) {
  const total = ALL_PERMISSIONS.length;
  const savedRole = saved ? roles.find((r) => r.id === saved) : null;
  return (
    <>
      {savedRole && (
        <p className="a-alert a-alert--ok" role="status">
          Rolle «{savedRole.name}» erstellt. Sie können sie jetzt beim Einladen oder im Benutzer-Bereich vergeben.
        </p>
      )}
      <div className="a-toolbar__row">
        <p className="a-lead">Eingebaute Rollen sind fest. Für eigene Bedürfnisse erstellen Sie eine eigene Rolle – am einfachsten als Kopie einer eingebauten.</p>
        {canRoles && (
          <Link href={`${BASE}?tab=rollen&rolle=neu`} className="a-btn a-btn--ghost" scroll={false}>
            <Icon name="plus" size={16} />
            Neue Rolle
          </Link>
        )}
      </div>
      <Panel flush>
        <div className="a-tablewrap">
          <table className="a-table a-table--stack">
            <thead>
              <tr>
                <th scope="col">Rolle</th>
                <th scope="col">Typ</th>
                <th scope="col" className="a-num">
                  Personen
                </th>
                <th scope="col">Berechtigungen</th>
                <th scope="col">
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className={r.id === me.role.id ? "is-selected" : undefined}>
                  <td>
                    <Link href={`${BASE}?tab=rollen&rolle=${r.id}`} className="a-rowlink" scroll={false}>
                      {r.name}
                    </Link>
                    {r.id === me.role.id && <span className="a-pill a-pill--accent s-you">Ihre Rolle</span>}
                    <small className="s-clamp">{r.description || "Ohne Beschreibung"}</small>
                  </td>
                  <td data-label="Typ">{r.isSystem ? <span className="a-pill a-pill--muted">{r.key === "owner" ? "Gesperrt" : "Eingebaut"}</span> : <span className="a-pill a-pill--info">Eigene</span>}</td>
                  <td data-label="Personen" className="a-num">
                    {r.userCount}
                  </td>
                  <td data-label="Rechte">
                    <span className="s-meter" aria-label={`${r.permissions.length} von ${total}`}>
                      <span className="s-meter__bar">
                        <i style={{ width: `${Math.round((r.permissions.length / total) * 100)}%` }} />
                      </span>
                      {r.permissions.length} / {total}
                    </span>
                  </td>
                  <td className="a-actions">
                    <Link href={`${BASE}?tab=rollen&rolle=${r.id}`} className="a-btn a-btn--quiet a-btn--sm" scroll={false}>
                      {!r.isSystem && canRoles ? "Bearbeiten" : "Ansehen"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function RoleDrawer({ me, roles, id, template, canRoles }: { me: CurrentUser; roles: Roles; id: string; template: string; canRoles: boolean }) {
  const isNew = id === "neu";
  if (isNew && !canRoles) return null;
  const role = isNew ? null : roles.find((r) => r.id === id);
  if (!isNew && !role) return null;
  const tpl = isNew && template ? roles.find((r) => r.id === template) : null;
  const closeHref = `${BASE}?tab=rollen`;
  const groups = permissionGroups();
  const privileged = isPrivileged(me);
  const locked = privileged ? [] : ALL_PERMISSIONS.filter((p) => ADMIN_ONLY_PERMISSIONS.includes(p) || !me.permissions.has(p));
  const readOnly = !canRoles || Boolean(role?.isSystem);

  if (readOnly && role) {
    return (
      <Drawer closeHref={closeHref} title={role.name} subtitle={role.isSystem ? "Eingebaute Rolle – nicht veränderbar" : "Eigene Rolle"}>
        <div className="s-dbody">
          <p className="a-muted">{role.description}</p>
          <p className="a-small0 a-muted">
            {role.userCount === 1 ? "1 Person hat" : `${role.userCount} Personen haben`} diese Rolle.
            {role.key === "owner" && " Inhaber haben immer alle Rechte; mindestens ein aktiver Inhaber muss bestehen bleiben."}
          </p>
          <PermissionMatrix groups={groups} initial={role.permissions} readOnly />
        </div>
        {canRoles && role.key !== "owner" && (
          <div className="a-savebar">
            <Link href={`${BASE}?tab=rollen&rolle=neu&vorlage=${role.id}`} className="a-btn a-btn--primary" scroll={false}>
              <Icon name="copy" size={16} />
              Als Vorlage für eigene Rolle
            </Link>
          </div>
        )}
      </Drawer>
    );
  }

  const initial = role?.permissions ?? tpl?.permissions.filter((p) => privileged || !locked.includes(p as never)) ?? [];
  return (
    <Drawer closeHref={closeHref} title={isNew ? "Neue Rolle" : `Rolle «${role!.name}»`} subtitle={isNew ? (tpl ? `Vorlage: ${tpl.name}` : "Wählen Sie, was Personen mit dieser Rolle dürfen.") : `${role!.userCount === 1 ? "1 Person" : `${role!.userCount} Personen`} mit dieser Rolle`}>
      <ActionForm action={saveRoleAction} className="a-seoform">
        <input type="hidden" name="id" value={role?.id ?? ""} />
        <div className="a-seoform__body">
          <label className="a-field">
            <span>Name</span>
            <input name="name" required maxLength={60} defaultValue={role?.name ?? (tpl ? `${tpl.name} (angepasst)` : "")} placeholder="z. B. Buchhaltung" />
          </label>
          <label className="a-field">
            <span>
              Beschreibung <em>optional</em>
            </span>
            <input name="description" maxLength={300} defaultValue={role?.description ?? tpl?.description ?? ""} placeholder="Wofür ist diese Rolle gedacht?" />
          </label>
          {!privileged && <p className="a-footnote">Sie können nur Berechtigungen vergeben, die Sie selbst haben. Gesperrte Felder ändert eine Person mit der Rolle Inhaber oder Administrator.</p>}
          <PermissionMatrix groups={groups} initial={initial} locked={locked} />
          {role && (
            <div className="a-danger">
              <div>
                <h2>Rolle löschen</h2>
                <p>{role.userCount > 0 ? `Nicht möglich, solange ${role.userCount === 1 ? "eine Person" : `${role.userCount} Personen`} diese Rolle haben.` : "Die Rolle wird endgültig entfernt."}</p>
              </div>
              {role.userCount === 0 && <ActionButton action={deleteRoleAction} fields={{ id: role.id }} label="Löschen" variant="danger" small={false} question={`Rolle «${role.name}» löschen?`} />}
            </div>
          )}
        </div>
        <div className="a-savebar">
          <Submit>{isNew ? "Rolle erstellen" : "Speichern"}</Submit>
          <Link href={closeHref} className="a-btn a-btn--quiet" scroll={false}>
            Abbrechen
          </Link>
        </div>
      </ActionForm>
    </Drawer>
  );
}

/* ---------------------------------------------------------- invitations */

function InvitesTab({ invites, canManage }: { invites: Awaited<ReturnType<typeof listInvitations>>; canManage: boolean }) {
  return (
    <Panel flush>
      {invites.length === 0 ? (
        <Empty
          icon="mail"
          title="Keine offenen Einladungen"
          action={
            canManage ? (
              <Link href={`${BASE}?tab=einladungen&einladen=1`} className="a-btn a-btn--ghost a-btn--sm" scroll={false}>
                Person einladen
              </Link>
            ) : undefined
          }
        >
          Angenommene Einladungen erscheinen als aktive Benutzer. Abgelaufene Links können Sie hier erneut senden.
        </Empty>
      ) : (
        <div className="a-tablewrap">
          <table className="a-table a-table--stack">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Rolle</th>
                <th scope="col">Eingeladen</th>
                <th scope="col">Link</th>
                {canManage && (
                  <th scope="col">
                    <span className="sr-only">Aktionen</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.userId}>
                  <td>
                    <strong className="s-strong">{i.name}</strong>
                    <small>{i.email}</small>
                  </td>
                  <td data-label="Rolle">{i.roleName}</td>
                  <td data-label="Eingeladen">
                    {relative(i.invitedAt)}
                    <small>von {i.invitedBy}</small>
                  </td>
                  <td data-label="Link">
                    {i.expired ? <span className="a-pill a-pill--bad">Abgelaufen</span> : <span className="a-pill a-pill--info">Gültig bis {dateTime(i.expiresAt)}</span>}
                  </td>
                  {canManage && (
                    <td className="s-rowactions">
                      <ActionButton action={resendInviteAction} fields={{ userId: i.userId }} label="Erneut senden" pending="Senden …" />
                      <ActionButton action={revokeInviteAction} fields={{ userId: i.userId }} label="Zurückziehen" variant="quiet" question={`Einladung an ${i.email} zurückziehen? Der Link wird ungültig.`} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
