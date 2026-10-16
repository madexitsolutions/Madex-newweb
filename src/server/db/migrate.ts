/** Production: apply SQL migrations from ./drizzle, then the idempotent bootstrap. */
import path from "node:path";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { bootstrap } from "./bootstrap";
import { getDb } from "./index";

export async function runMigrations() {
  const db = getDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) await migratePostgres(db as unknown as PostgresJsDatabase, { migrationsFolder });
  else await migratePglite(db, { migrationsFolder });
  await bootstrap(db);
}
