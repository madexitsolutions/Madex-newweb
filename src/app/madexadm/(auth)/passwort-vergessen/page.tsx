import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/admin/brand";
import { ActionForm, Submit } from "@/components/admin/forms";
import { getCurrentUser } from "@/server/auth/session";
import { forgotPasswordAction } from "../../recovery-actions";

export const metadata = { title: "Passwort vergessen" };

export default async function ForgotPassword() {
  if (await getCurrentUser()) redirect("/madexadm/konto");
  return (
    <div className="a-login">
      <div className="a-login__card">
        <Brand className="a-login__logo" />
        <h1>Passwort vergessen</h1>
        <p className="a-muted">Geben Sie die E-Mail-Adresse Ihres Kontos ein. Sie erhalten einen Link, mit dem Sie ein neues Passwort festlegen. Ihre Zwei-Faktor-Anmeldung bleibt bestehen.</p>
        <ActionForm action={forgotPasswordAction} className="a-form">
          <label className="a-field">
            <span>E-Mail</span>
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <Submit pending="Wird gesendet …">Link senden</Submit>
          <Link href="/madexadm/login" className="a-link a-small">
            Zurück zur Anmeldung
          </Link>
        </ActionForm>
      </div>
    </div>
  );
}
