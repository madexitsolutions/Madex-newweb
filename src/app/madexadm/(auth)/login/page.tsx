import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Brand } from "@/components/admin/brand";
import { otpauthUrl } from "@/server/auth/totp";
import { getCurrentUser, hasAnyUser, pendingLogin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { CodeForm, PasswordForm } from "./forms";

export const metadata = { title: "Anmelden" };

export default async function Login({ searchParams }: { searchParams: Promise<{ schritt?: string; eingerichtet?: string; zurueckgesetzt?: string; next?: string }> }) {
  if (!(await hasAnyUser())) redirect("/madexadm/einrichtung");
  if (await getCurrentUser()) redirect("/madexadm");
  const { schritt, eingerichtet, zurueckgesetzt, next } = await searchParams;
  const pending = await pendingLogin();
  const general = await getSettings("general");

  let qr = "";
  if (pending?.stage === "enroll" && pending.secret) {
    qr = await QRCode.toDataURL(otpauthUrl(pending.secret, pending.email, `${general.siteName} Dashboard`), { margin: 1, width: 220, color: { dark: "#12262a", light: "#ffffff" } });
  }

  return (
    <div className="a-login">
      <div className="a-login__card">
        <Brand className="a-login__logo" />
        {!pending ? (
          <>
            <h1>Anmelden</h1>
            <p className="a-muted">Dashboard von {general.siteName}</p>
            {eingerichtet && (
              <p className="a-alert a-alert--ok" role="status">
                Ihr Konto ist erstellt. Melden Sie sich jetzt an und richten Sie die Zwei-Faktor-Anmeldung ein.
              </p>
            )}
            {zurueckgesetzt && (
              <p className="a-alert a-alert--ok" role="status">
                Ihr Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.
              </p>
            )}
            {schritt && (
              <p className="a-alert a-alert--error" role="alert">
                Die Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an.
              </p>
            )}
            <PasswordForm />
          </>
        ) : pending.stage === "enroll" ? (
          <>
            <h1>Zwei-Faktor-Anmeldung einrichten</h1>
            <p className="a-muted">
              Scannen Sie den QR-Code mit einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator oder 1Password) und geben Sie den 6-stelligen Code ein.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR-Code für die Authenticator-App" width={220} height={220} className="a-login__qr" />
            <details className="a-login__manual">
              <summary>QR-Code lässt sich nicht scannen?</summary>
              <p>Schlüssel manuell in der App eingeben:</p>
              <code>{pending.secret?.match(/.{1,4}/g)?.join(" ")}</code>
            </details>
            <CodeForm enroll />
          </>
        ) : (
          <>
            <h1>Bestätigungscode</h1>
            <p className="a-muted">
              Angemeldet als <strong>{pending.email}</strong>. Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein. Ohne Gerät können Sie einen Wiederherstellungscode verwenden.
            </p>
            <CodeForm next={next} />
          </>
        )}
      </div>
    </div>
  );
}
