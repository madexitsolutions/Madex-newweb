import { accessSync, constants, mkdirSync } from "node:fs";
import path from "node:path";
import { count, sql } from "drizzle-orm";
import Link from "next/link";
import { db, embeddedDir, usesEmbeddedDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { secretSource } from "@/server/lib/crypto";
import { requestInfo } from "@/server/lib/request";

export const metadata = { title: "Status" };
export const dynamic = "force-dynamic";

type Check = { label: string; ok: boolean | null; value: string; hint?: string };

function dataDirWritable() {
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || ".data");
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return { ok: true, dir };
  } catch {
    return { ok: false, dir };
  }
}

/**
 * Public setup check – no login needed, no secrets shown. Helps when the login
 * does not work on a new server.
 */
export default async function StatusPage() {
  const startupError = (globalThis as { __startupError?: string }).__startupError;
  const embedded = usesEmbeddedDb();
  let dbOk = false;
  let dbError = "";
  let userCount = 0;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
    [{ n: userCount }] = await db.select({ n: count() }).from(users);
  } catch (e) {
    dbError = e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "Unbekannter Fehler";
  }
  const { https } = await requestInfo();
  const data = dataDirWritable();
  const secret = secretSource();
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

  const checks: Check[] = [
    {
      label: "Datenbank",
      ok: dbOk && !startupError,
      value: `${embedded ? "Eingebaut (Ordner " + embeddedDir() + ")" : "Externer PostgreSQL-Server (DATABASE_URL)"} · ${dbOk ? "erreichbar" : "nicht erreichbar"}`,
      hint: startupError
        ? `Beim Start ist ein Fehler aufgetreten: ${startupError.slice(0, 200)}`
        : dbOk
          ? undefined
          : embedded
            ? `Die eingebaute Datenbank liess sich nicht öffnen (${dbError}). Läuft die App nur einmal? Ist DATA_DIR beschreibbar?`
            : `Der Server unter DATABASE_URL antwortet nicht (${dbError}). Adresse, Benutzer und Passwort prüfen.`,
    },
    {
      label: "Datenordner",
      ok: data.ok,
      value: data.dir,
      hint: data.ok ? (process.env.DATA_DIR ? undefined : "DATA_DIR ist nicht gesetzt – setzen Sie einen Ordner, der Neuinstallationen übersteht.") : "Der Ordner ist nicht beschreibbar. DATA_DIR auf einen beschreibbaren, dauerhaften Ordner setzen.",
    },
    {
      label: "Verschlüsselungsschlüssel",
      ok: secret === "missing" ? null : true,
      value: secret === "env" ? "APP_SECRET gesetzt" : secret === "file" ? "Automatisch erzeugt (DATA_DIR/.app-secret)" : "Wird beim ersten Speichern erzeugt",
      hint: secret === "file" ? "Die Datei .app-secret gehört zur Datensicherung – ohne sie sind 2FA und gespeicherte Zugangsdaten nicht lesbar." : undefined,
    },
    {
      label: "Benutzerkonto",
      ok: dbOk ? userCount > 0 : null,
      value: dbOk ? (userCount > 0 ? `${userCount} Konto${userCount === 1 ? "" : "s"} vorhanden` : "Noch kein Konto") : "–",
      hint: dbOk && userCount === 0 ? "Unter /admin die Ersteinrichtung machen oder ADMIN_EMAIL und ADMIN_PASSWORD (mind. 12 Zeichen) setzen und die App neu starten." : undefined,
    },
    {
      label: "Verbindung",
      ok: https ? true : null,
      value: https ? "HTTPS" : "HTTP (unverschlüsselt)",
      hint: https ? undefined : "Für den Betrieb HTTPS verwenden. Die Anmeldung funktioniert auch über HTTP, das Passwort wird dann aber unverschlüsselt übertragen.",
    },
    {
      label: "Öffentliche Adresse",
      ok: appUrl ? true : null,
      value: appUrl || "nicht gesetzt",
      hint: appUrl ? undefined : "APP_URL (oder NEXT_PUBLIC_SITE_URL) setzen – wird für Links in E-Mails gebraucht.",
    },
  ];
  const allOk = checks.every((c) => c.ok !== false);

  return (
    <div className="a-login">
      <div className="a-login__card" style={{ width: "min(620px, 100%)" }}>
        <h1>Systemstatus</h1>
        <p className="a-muted">{allOk ? "Alles bereit. Probleme bei der Anmeldung? Siehe Hinweise unten." : "Mindestens eine Einstellung braucht Ihre Aufmerksamkeit."}</p>
        <ul className="a-checks" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {checks.map((c) => (
            <li key={c.label} style={{ display: "grid", gap: 2 }}>
              <span>
                <span className={`a-pill a-pill--${c.ok === true ? "ok" : c.ok === false ? "bad" : "warn"}`}>{c.ok === true ? "OK" : c.ok === false ? "Fehler" : "Hinweis"}</span> <strong>{c.label}</strong>
              </span>
              <span className="a-small">{c.value}</span>
              {c.hint && <span className="a-small a-muted">{c.hint}</span>}
            </li>
          ))}
        </ul>
        <details className="a-login__manual">
          <summary>Anmeldung klappt trotzdem nicht?</summary>
          <p>
            Setzen Sie <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> (mind. 12 Zeichen) und <code>ADMIN_RESET=true</code>, starten Sie die App neu und melden Sie sich mit dieser E-Mail an.
            Das Konto wird zurückgesetzt und die Zwei-Faktor-Anmeldung neu eingerichtet. Danach <code>ADMIN_RESET</code> wieder entfernen.
          </p>
        </details>
        <Link href="/admin/login" className="a-btn a-btn--primary">
          Zur Anmeldung
        </Link>
      </div>
    </div>
  );
}
