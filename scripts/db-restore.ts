/**
 * Restores the built-in database from a backup downloaded under Sicherheit → Datensicherung.
 *   npm run db:restore -- datenbank-202610201230.tar.gz
 * Stop the app first. The current database folder is kept as <folder>.vor-wiederherstellung.
 */
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { embeddedDir } from "../src/server/db";

async function main() {
  const file = process.argv[2];
  if (process.env.DATABASE_URL) throw new Error("DATABASE_URL ist gesetzt – die Wiederherstellung gilt nur für die eingebaute Datenbank.");
  if (!file || !existsSync(file)) throw new Error("Aufruf: npm run db:restore -- <datensicherung.tar.gz>");
  const dir = embeddedDir();
  const keep = `${dir}.vor-wiederherstellung`;
  if (existsSync(dir)) {
    rmSync(keep, { recursive: true, force: true });
    renameSync(dir, keep);
  }
  const blob = new Blob([readFileSync(file)], { type: "application/gzip" });
  const pg = new PGlite({ dataDir: dir, loadDataDir: blob });
  const r = await pg.query<{ n: number }>("select count(*)::int as n from users");
  await pg.close();
  console.log(`Wiederhergestellt nach ${dir} (${r.rows[0]?.n ?? 0} Benutzer). Die vorherige Datenbank liegt in ${keep}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
