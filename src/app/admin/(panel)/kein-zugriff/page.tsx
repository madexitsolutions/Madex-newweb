import Link from "next/link";
import { Icon } from "@/components/admin/kit";
import { requireUser } from "@/server/auth/session";

export const metadata = { title: "Kein Zugriff" };

export default async function Denied() {
  const user = await requireUser();
  return (
    <div className="a-denied">
      <span className="a-emptystate__icon">
        <Icon name="lock" size={22} />
      </span>
      <h1>Kein Zugriff</h1>
      <p className="a-muted">
        Ihre Rolle «{user.role.name}» hat für diesen Bereich keine Berechtigung. Wenden Sie sich an eine Person mit der Rolle Inhaber oder Administrator, wenn Sie Zugriff brauchen.
      </p>
      <Link href="/admin" className="a-btn a-btn--primary">
        Zur Übersicht
      </Link>
    </div>
  );
}
