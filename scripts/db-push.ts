/**
 * Development: bring the database in line with the TypeScript schema (no
 * migration files needed) and apply the bootstrap. Runs before `next dev`.
 *
 * The built-in database (PGlite) can't be introspected by drizzle-kit, so the
 * schema of the last sync is kept next to it (.dev-schema.json) and only the
 * difference is applied. An external DATABASE_URL is synced with pushSchema.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { generateDrizzleJson, generateMigration, pushSchema } from "drizzle-kit/api";
import * as schema from "../src/server/db/schema";
import { embeddedDir, getDb, usesEmbeddedDb } from "../src/server/db";
import { bootstrap } from "../src/server/db/bootstrap";

const imports = schema as unknown as Record<string, unknown>;

async function main() {
  const db = getDb();
  let changes = 0;
  if (!usesEmbeddedDb()) {
    const res = await pushSchema(imports, db as never, ["public"]);
    if (res.hasDataLoss) console.warn("[db] Achtung, Schemaänderung löscht Daten:\n  " + res.warnings.join("\n  "));
    await res.apply();
    changes = res.statementsToExecute.length;
  } else {
    const file = path.join(embeddedDir(), ".dev-schema.json");
    const current = generateDrizzleJson(imports, undefined, ["public"]);
    const [{ exists }] = (await db.execute(sql`select to_regclass('public.users') is not null as exists`)).rows as { exists: boolean }[];
    if (!exists) {
      // empty database: pushSchema works here (nothing to introspect)
      const res = await pushSchema(imports, db as never, ["public"]);
      await res.apply();
      changes = res.statementsToExecute.length;
    } else if (existsSync(file)) {
      const previous = JSON.parse(readFileSync(file, "utf8"));
      const statements = await generateMigration(previous, current);
      for (const s of statements) await db.execute(sql.raw(s));
      changes = statements.length;
    } else {
      console.warn("[db] Unbekannter Schema-Stand dieser Datenbank – es wird angenommen, dass sie aktuell ist. Bei Fehlern: npm run db:reset");
    }
    writeFileSync(file, JSON.stringify(current));
  }
  await bootstrap(db);
  console.log(`[db] Schema synchronisiert (${changes} Änderungen).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
