/**
 * Development: bring the database in line with the TypeScript schema (no
 * migration files needed) and apply the bootstrap. Runs before `next dev`.
 */
import { pushSchema } from "drizzle-kit/api";
import * as schema from "../src/server/db/schema";
import { getDb } from "../src/server/db";
import { bootstrap } from "../src/server/db/bootstrap";

async function main() {
  const db = getDb();
  const res = await pushSchema(schema as unknown as Record<string, unknown>, db as never);
  if (res.hasDataLoss) console.warn("[db] Achtung, Schemaänderung löscht Daten:\n  " + res.warnings.join("\n  "));
  await res.apply();
  await bootstrap(db);
  console.log(`[db] Schema synchronisiert (${res.statementsToExecute.length} Änderungen).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
