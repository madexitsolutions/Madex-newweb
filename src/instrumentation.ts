/** Runs once when the server starts: in production the database is migrated before requests are served. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.SKIP_MIGRATIONS === "true") return;
  const { runMigrations } = await import("./server/db/migrate");
  const { ensureSecret } = await import("./server/lib/crypto");
  try {
    ensureSecret();
    await runMigrations();
  } catch (e) {
    // keep the server up so /madexadm/status can show what is wrong
    const msg = e instanceof Error ? e.message : String(e);
    (globalThis as { __startupError?: string }).__startupError = msg;
    console.error("[db] Start fehlgeschlagen:", msg);
  }
}
