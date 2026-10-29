import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/admin/forms";
import { hasAnyUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { setupAction } from "../../auth-actions";

export const metadata = { title: "Einrichtung" };

/** First run: creates the owner account. Disappears as soon as a user exists. */
export default async function Setup() {
  if (await hasAnyUser()) redirect("/madexadm/login");
  const { passwordMinLength } = await getSettings("security");
  return (
    <div className="a-login">
      <div className="a-login__card">
        <h1>Dashboard einrichten</h1>
        <p className="a-muted">Erstellen Sie das Inhaber-Konto. Weitere Benutzer laden Sie danach unter «Benutzer &amp; Rollen» ein.</p>
        <ActionForm action={setupAction} className="a-form">
          <label className="a-field">
            <span>Ihr Name</span>
            <input name="name" autoComplete="name" required autoFocus />
          </label>
          <label className="a-field">
            <span>E-Mail</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="a-field">
            <span>Passwort</span>
            <input name="password" type="password" autoComplete="new-password" minLength={passwordMinLength} required />
            <small className="a-muted">Mindestens {passwordMinLength} Zeichen. Ein Satz aus mehreren Wörtern ist sicher und gut zu merken.</small>
          </label>
          <label className="a-field">
            <span>Passwort wiederholen</span>
            <input name="password2" type="password" autoComplete="new-password" required />
          </label>
          <Submit pending="Konto wird erstellt …">Konto erstellen</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
