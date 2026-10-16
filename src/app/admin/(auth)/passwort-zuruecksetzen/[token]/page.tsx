import { Brand } from "@/components/admin/brand";
import { ActionForm, Submit } from "@/components/admin/forms";
import { getSettings } from "@/server/settings";
import { findResetToken } from "@/server/users";
import { resetPasswordAction } from "../../../recovery-actions";
import { TokenProblem } from "../../token-state";

export const metadata = { title: "Neues Passwort", referrer: "no-referrer" as const };

export default async function ResetPassword({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await findResetToken(token);
  if (res.state !== "valid") return <TokenProblem kind="reset" state={res.state} />;
  const { passwordMinLength } = await getSettings("security");
  return (
    <div className="a-login">
      <div className="a-login__card">
        <Brand className="a-login__logo" />
        <h1>Neues Passwort festlegen</h1>
        <p className="a-muted">
          Für <strong>{res.email}</strong>. Nach dem Speichern werden alle bestehenden Sitzungen beendet.
        </p>
        <ActionForm action={resetPasswordAction} className="a-form">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="username" value={res.email} autoComplete="username" />
          <label className="a-field">
            <span>Neues Passwort</span>
            <input name="password" type="password" autoComplete="new-password" minLength={passwordMinLength} required autoFocus />
            <small className="a-muted">Mindestens {passwordMinLength} Zeichen.</small>
          </label>
          <label className="a-field">
            <span>Passwort wiederholen</span>
            <input name="password2" type="password" autoComplete="new-password" required />
          </label>
          <Submit pending="Wird gespeichert …">Passwort speichern</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
