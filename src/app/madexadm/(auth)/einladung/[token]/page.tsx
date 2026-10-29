import { Brand } from "@/components/admin/brand";
import { ActionForm, Submit } from "@/components/admin/forms";
import { dateTime } from "@/lib/format";
import { getSettings } from "@/server/settings";
import { findInvite } from "@/server/users";
import { acceptInviteAction } from "../../../recovery-actions";
import { TokenProblem } from "../../token-state";

export const metadata = { title: "Einladung annehmen", referrer: "no-referrer" as const };

export default async function AcceptInvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await findInvite(token);
  if (res.state !== "valid" || !res.invite) return <TokenProblem kind="invite" state={res.state === "valid" ? "invalid" : res.state} />;
  const { invite } = res;
  const [general, { passwordMinLength }] = await Promise.all([getSettings("general"), getSettings("security")]);
  return (
    <div className="a-login">
      <div className="a-login__card">
        <Brand className="a-login__logo" />
        <h1>Willkommen im Dashboard</h1>
        <p className="a-muted">
          {invite.invitedBy ? `${invite.invitedBy} hat Sie` : "Sie wurden"} zum Dashboard von {general.siteName} eingeladen – mit der Rolle <strong>{invite.roleName}</strong>. Legen Sie Ihr Passwort fest.
        </p>
        <ActionForm action={acceptInviteAction} className="a-form">
          <input type="hidden" name="token" value={token} />
          <label className="a-field">
            <span>E-Mail</span>
            <input value={invite.email} readOnly autoComplete="username" name="username" aria-readonly="true" />
          </label>
          <label className="a-field">
            <span>Ihr Name</span>
            <input name="name" defaultValue={invite.name} autoComplete="name" required maxLength={100} />
          </label>
          <label className="a-field">
            <span>Passwort</span>
            <input name="password" type="password" autoComplete="new-password" minLength={passwordMinLength} required autoFocus />
            <small className="a-muted">Mindestens {passwordMinLength} Zeichen. Ein Satz aus mehreren Wörtern ist sicher und gut zu merken.</small>
          </label>
          <label className="a-field">
            <span>Passwort wiederholen</span>
            <input name="password2" type="password" autoComplete="new-password" required />
          </label>
          <Submit pending="Konto wird aktiviert …">Konto aktivieren</Submit>
          <p className="a-small0 a-muted">Danach melden Sie sich an und richten die Zwei-Faktor-Anmeldung ein. Der Link ist gültig bis {dateTime(invite.expiresAt)}.</p>
        </ActionForm>
      </div>
    </div>
  );
}
