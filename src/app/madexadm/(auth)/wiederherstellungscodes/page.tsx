import { redirect } from "next/navigation";
import { Submit } from "@/components/admin/forms";
import { getCurrentUser, takeFreshRecoveryCodes } from "@/server/auth/session";
import { dismissCodesAction } from "../../auth-actions";

export const metadata = { title: "Wiederherstellungscodes" };

/** Shown once after setting up 2FA or regenerating codes. */
export default async function RecoveryCodes() {
  const user = await getCurrentUser();
  if (!user) redirect("/madexadm/login");
  const codes = await takeFreshRecoveryCodes();
  if (!codes) redirect("/madexadm");
  return (
    <div className="a-login">
      <div className="a-login__card">
        <h1>Wiederherstellungscodes sichern</h1>
        <p className="a-muted">
          Mit diesen Codes melden Sie sich an, falls Ihr Telefon verloren geht. Jeder Code funktioniert einmal. Speichern Sie sie im Passwort-Manager oder drucken Sie sie aus – sie werden nur jetzt
          angezeigt.
        </p>
        <ul className="a-codes" aria-label="Wiederherstellungscodes">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <form action={dismissCodesAction}>
          <Submit>Ich habe die Codes gesichert</Submit>
        </form>
      </div>
    </div>
  );
}
