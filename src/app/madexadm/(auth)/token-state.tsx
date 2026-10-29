import Link from "next/link";
import { Brand } from "@/components/admin/brand";
import { Icon } from "@/components/admin/kit";
import type { TokenState } from "@/server/users";

const TEXT: Record<"invite" | "reset", Record<Exclude<TokenState, "valid">, { title: string; body: string }>> = {
  invite: {
    expired: { title: "Einladung abgelaufen", body: "Der Link war 7 Tage gültig. Bitten Sie die Person, die Sie eingeladen hat, die Einladung erneut zu senden." },
    used: { title: "Einladung bereits angenommen", body: "Mit diesem Link wurde schon ein Konto eingerichtet. Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an." },
    invalid: { title: "Einladung ungültig", body: "Der Link ist unvollständig oder wurde zurückgezogen. Kopieren Sie ihn vollständig aus der E-Mail oder bitten Sie um eine neue Einladung." },
  },
  reset: {
    expired: { title: "Link abgelaufen", body: "Links zum Zurücksetzen sind 60 Minuten gültig. Fordern Sie einfach einen neuen an." },
    used: { title: "Link bereits verwendet", body: "Mit diesem Link wurde das Passwort schon geändert. Melden Sie sich an oder fordern Sie einen neuen Link an." },
    invalid: { title: "Link ungültig", body: "Der Link ist unvollständig oder wurde durch einen neueren ersetzt. Verwenden Sie den Link aus der neuesten E-Mail." },
  },
};

/** Clear message for expired, used or unknown one-time links. */
export function TokenProblem({ kind, state }: { kind: "invite" | "reset"; state: Exclude<TokenState, "valid"> }) {
  const t = TEXT[kind][state];
  return (
    <div className="a-login">
      <div className="a-login__card">
        <Brand className="a-login__logo" />
        <span className="a-emptystate__icon" style={{ margin: 0 }}>
          <Icon name={state === "used" ? "check" : "clock"} size={22} />
        </span>
        <h1>{t.title}</h1>
        <p className="a-muted">{t.body}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/madexadm/login" className="a-btn a-btn--primary">
            Zur Anmeldung
          </Link>
          {kind === "reset" && (
            <Link href="/madexadm/passwort-vergessen" className="a-btn a-btn--ghost">
              Neuen Link anfordern
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
