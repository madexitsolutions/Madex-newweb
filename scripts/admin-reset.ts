/**
 * Emergency access: creates or resets the owner account.
 *   npm run admin:reset -- name@firma.ch            (prints a new random password)
 *   npm run admin:reset -- name@firma.ch "Neues Passwort mit 12+ Zeichen"
 * With the built-in database stop the app first (only one process may open it).
 */
import { randomBytes } from "node:crypto";
import { getDb } from "../src/server/db";
import { bootstrap, resetOwner } from "../src/server/db/bootstrap";
import { runMigrations } from "../src/server/db/migrate";

async function main() {
  const [email, given] = process.argv.slice(2);
  if (!email) {
    console.error('Aufruf: npm run admin:reset -- name@firma.ch ["Passwort"]');
    process.exit(1);
  }
  const password = given || randomBytes(12).toString("base64url");
  try {
    await runMigrations();
  } catch (e) {
    // a development database is synced without migration files – that's fine here
    console.warn("[db] Migrationen übersprungen:", e instanceof Error ? e.message.split("\n")[0] : e);
  }
  const db = getDb();
  await bootstrap(db);
  const r = await resetOwner(db, email, password);
  console.log(`\nKonto ${email} ${r === "reset" ? "zurückgesetzt" : "angelegt"} (Rolle Inhaber, 2FA wird beim nächsten Login neu eingerichtet).`);
  if (!given) console.log(`Neues Passwort: ${password}\n`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
