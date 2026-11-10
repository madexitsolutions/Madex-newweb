/** Runs once when the server starts: in production the database is migrated before requests are served. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.SKIP_MIGRATIONS === "true") return;
  const { runMigrations } = await import("./server/db/migrate");
  const { ensureSecret } = await import("./server/lib/crypto");
  const care = await import("./server/db/care");
  try {
    ensureSecret();
    // a second copy of the app (deploy) waits until the first one has released the database
    await care.holdDatabaseLock();
    await runMigrations()
      .catch(async (e) => {
        // the built-in database may have just fallen back to its default settings (server/db): try once more
        if (!(globalThis as { __pgliteDefaults?: boolean }).__pgliteDefaults) throw e;
        await runMigrations();
      })
      .catch(async (e) => {
        // still not: start from the latest backup or a new database (the old folder is kept, see server/db)
        const { errorChain, recoverEmbedded } = await import("./server/db");
        if (!(await recoverEmbedded(errorChain(e)))) throw e;
        await runMigrations();
      });
    care.scheduleBackups();
  } catch (e) {
    // keep the server up so /madexadm/status can show what is wrong
    const { errorChain } = await import("./server/db");
    const msg = errorChain(e);
    (globalThis as { __startupError?: string }).__startupError = msg;
    console.error("[db] Start fehlgeschlagen:", msg);
  }
}
