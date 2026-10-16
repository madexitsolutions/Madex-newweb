/** Runs once when the server starts: in production the database is migrated before requests are served. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.SKIP_MIGRATIONS === "true") return;
  const { runMigrations } = await import("./server/db/migrate");
  await runMigrations();
}
