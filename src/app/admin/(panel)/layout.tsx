import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listRequests } from "@/lib/server/requests";
import { signOut } from "../actions";
import { AdminNav } from "./nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const open = (await listRequests()).filter((r) => r.status === "new").length;
  return (
    <div className="a-shell">
      <aside className="a-side">
        <Link href="/admin" className="a-side__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-light.png" alt="Madex IT Solutions" />
        </Link>
        <AdminNav openRequests={open} />
        <div className="a-side__foot">
          <span>Angemeldet als {admin.username}</span>
          <div className="a-side__links">
            <a href="/" target="_blank" rel="noopener">
              Website öffnen
            </a>
            <form action={signOut}>
              <button type="submit">Abmelden</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="a-main">{children}</div>
    </div>
  );
}
