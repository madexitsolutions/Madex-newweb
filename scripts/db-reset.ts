/** Development only: delete the embedded database (a fresh one is created by `npm run dev`). */
import { rmSync } from "node:fs";
import { embeddedDir } from "../src/server/db";

if (process.env.DATABASE_URL) {
  console.error("db:reset löscht nur die eingebettete Datenbank. DATABASE_URL ist gesetzt – abgebrochen.");
  process.exit(1);
}
rmSync(embeddedDir(), { recursive: true, force: true });
console.log("[db] Eingebettete Datenbank gelöscht:", embeddedDir());
