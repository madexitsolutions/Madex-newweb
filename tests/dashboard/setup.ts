/**
 * Every test file gets a fresh in-memory PostgreSQL (PGlite) with the current
 * schema pushed and the bootstrap applied.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import { beforeAll } from "vitest";
import * as schema from "@/server/db/schema";
import { setDb } from "@/server/db";
import { bootstrap } from "@/server/db/bootstrap";

(process.env as Record<string, string>).NODE_ENV = "test";
process.env.APP_SECRET = "test-secret-test-secret-test-secret-123";

beforeAll(async () => {
  const db = drizzle(new PGlite("memory://"), { schema });
  const res = await pushSchema(schema as unknown as Record<string, unknown>, db as never);
  await res.apply();
  setDb(db);
  await bootstrap(db);
});
