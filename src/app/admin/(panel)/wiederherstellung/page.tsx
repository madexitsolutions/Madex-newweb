import { redirect } from "next/navigation";
import { freshRecoveryCodes } from "@/lib/server/auth";
import { confirmRecoveryCodes } from "../../actions";
import { Submit } from "../../ui";

export const metadata = { title: "Wiederherstellungscodes" };

export default async function RecoveryCodes() {
  const codes = await freshRecoveryCodes();
  if (!codes) redirect("/admin");
  return (
    <section className="a-panel a-narrow a-stack">
      <p className="a-alert a-alert--ok">Die Zwei-Faktor-Anmeldung ist aktiv.</p>
      <h1>Ihre Wiederherstellungscodes</h1>
      <p>Bewahren Sie diese Codes sicher auf, zum Beispiel im Passwort-Manager. Jeder Code funktioniert einmal, falls Sie keinen Zugriff auf Ihre Authenticator-App haben. Sie werden nur jetzt angezeigt.</p>
      <ul className="a-codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <form action={confirmRecoveryCodes}>
        <Submit>Codes gesichert – weiter zum Dashboard</Submit>
      </form>
    </section>
  );
}
