import { Logo } from "@/components/ui/Logo";
import { requireAdmin } from "@/lib/server/auth";
import { listRequests } from "@/lib/server/requests";
import { AdminNav } from "./nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const open = (await listRequests()).filter((r) => r.status === "new").length;
  return (
    <div className="a-shell">
      <AdminNav openRequests={open} username={admin.username} brand={<Logo tone="light" />} />
      <main className="a-main">{children}</main>
    </div>
  );
}
