import { checkPermission } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { embeddedClient } from "@/server/db";

/** Download of the built-in database (tar.gz). Restore with `npm run db:restore -- <file>`. */
export async function GET() {
  const user = await checkPermission("security.manage");
  if (!user) return new Response("Keine Berechtigung", { status: 403 });
  const client = embeddedClient();
  if (!client) return new Response("Mit einem externen PostgreSQL-Server übernimmt dessen Anbieter die Sicherung.", { status: 400 });
  const dump = await client.dumpDataDir("gzip");
  await audit(user, "security.backup_downloaded", { entityType: "security", summary: "Datensicherung der Datenbank heruntergeladen" });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new Response(await dump.arrayBuffer(), {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="datenbank-${stamp}.tar.gz"`,
      "cache-control": "no-store",
    },
  });
}
