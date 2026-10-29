"use client";

import Link from "next/link";
import { ActionForm, Submit } from "@/components/admin/forms";
import { codeAction, enrollAction, loginAction } from "../../auth-actions";

export function PasswordForm() {
  return (
    <ActionForm action={loginAction} className="a-form">
      <label className="a-field">
        <span>E-Mail</span>
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="a-field">
        <span>Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <Submit pending="Anmelden …">Anmelden</Submit>
      <Link href="/madexadm/passwort-vergessen" className="a-link a-small">
        Passwort vergessen?
      </Link>
    </ActionForm>
  );
}

export function CodeForm({ enroll = false, next }: { enroll?: boolean; next?: string }) {
  return (
    <ActionForm action={enroll ? enrollAction : codeAction} className="a-form">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="a-field">
        <span>{enroll ? "6-stelliger Code aus der App" : "Code oder Wiederherstellungscode"}</span>
        <input
          name="code"
          className="a-code-input"
          inputMode={enroll ? "numeric" : "text"}
          autoComplete="one-time-code"
          pattern={enroll ? "[0-9]*" : undefined}
          maxLength={enroll ? 6 : 11}
          required
          autoFocus
        />
      </label>
      <Submit pending="Prüfen …">{enroll ? "Einrichten und anmelden" : "Bestätigen"}</Submit>
    </ActionForm>
  );
}
