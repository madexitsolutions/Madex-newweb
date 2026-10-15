import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { adminConfigured, currentAdmin, pendingState } from "@/lib/server/auth";
import { otpauthUrl } from "@/lib/server/totp";
import { CodeForm, PasswordForm } from "./forms";

export const metadata = { title: "Anmelden" };

export default async function Login({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { step } = await searchParams;
  const pending = step ? await pendingState() : null;
  let qr = "";
  let secret = "";
  if (pending?.stage === "enroll" && pending.secret) {
    secret = pending.secret;
    qr = await QRCode.toDataURL(otpauthUrl(secret, process.env.ADMIN_USERNAME || "admin"), { margin: 1, width: 220, color: { dark: "#01363b", light: "#ffffff" } });
  }
  return (
    <div className="a-login">
      <div className="a-login__card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.png" alt="Madex IT Solutions" className="a-login__logo" />
        {!adminConfigured() ? (
          <>
            <h1>Admin nicht eingerichtet</h1>
            <p className="a-muted">
              Setzen Sie <code>ADMIN_USERNAME</code> und <code>ADMIN_PASSWORD</code> (mindestens 10 Zeichen) in den Umgebungsvariablen und starten Sie den Server neu.
            </p>
          </>
        ) : !pending ? (
          <>
            <h1>Anmelden</h1>
            <p className="a-muted">Verwaltung von madex-it.ch</p>
            {step && <p className="a-alert a-alert--error">Die Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an.</p>}
            <PasswordForm />
          </>
        ) : pending.stage === "enroll" ? (
          <>
            <h1>Zwei-Faktor-Anmeldung einrichten</h1>
            <p className="a-muted">Scannen Sie den QR-Code mit einer Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator oder 1Password) und geben Sie den 6-stelligen Code ein.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR-Code für die Authenticator-App" width={220} height={220} className="a-login__qr" />
            <details className="a-login__manual">
              <summary>QR-Code lässt sich nicht scannen?</summary>
              <p>Schlüssel manuell eingeben:</p>
              <code>{secret.match(/.{1,4}/g)?.join(" ")}</code>
            </details>
            <CodeForm enroll />
          </>
        ) : (
          <>
            <h1>Bestätigungscode</h1>
            <p className="a-muted">Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein. Ohne Gerät können Sie einen Wiederherstellungscode verwenden.</p>
            <CodeForm />
          </>
        )}
      </div>
    </div>
  );
}
