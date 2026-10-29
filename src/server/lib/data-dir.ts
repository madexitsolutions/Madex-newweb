/**
 * The folder for ALL data: built-in database (pglite/), uploads, analyses, projects,
 * chats and the encryption key (.app-secret).
 *
 * DATA_DIR when set. Without it, production uses ~/madex-data – outside the app folder,
 * because hosts like Hostinger replace the app folder on every deploy (the database and
 * with it the 2FA setup would be lost each time). Development uses ./.data.
 */
import os from "node:os";
import path from "node:path";

export function dataDir(): string {
  const env = process.env.DATA_DIR?.trim();
  if (env) return path.resolve(/*turbopackIgnore: true*/ env);
  if (process.env.NODE_ENV === "production") return path.join(/*turbopackIgnore: true*/ os.homedir(), "madex-data");
  return path.resolve(/*turbopackIgnore: true*/ ".data");
}

/** True when the data folder lies inside the app folder – a redeploy then deletes it. */
export function dataDirInsideApp(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  const d = dataDir();
  const app = process.cwd();
  return d === app || d.startsWith(app + path.sep);
}
