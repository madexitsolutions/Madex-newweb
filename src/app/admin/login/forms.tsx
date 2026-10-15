"use client";

import { useActionState } from "react";
import { loginCode, loginPassword } from "../actions";
import { Submit } from "../ui";

export function PasswordForm() {
  const [state, run] = useActionState(loginPassword, undefined);
  return (
    <form action={run} className="a-stack">
      {state?.error && (
        <p className="a-alert a-alert--error" role="alert">
          {state.error}
        </p>
      )}
      <label className="a-field">
        <span>Benutzername</span>
        <input name="username" autoComplete="username" required autoFocus={!state?.username} defaultValue={state?.username} />
      </label>
      <label className="a-field">
        <span>Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required autoFocus={Boolean(state?.username)} />
      </label>
      <Submit pending="Wird geprüft …">Weiter</Submit>
    </form>
  );
}

export function CodeForm({ enroll }: { enroll?: boolean }) {
  const [state, run] = useActionState(loginCode, undefined);
  return (
    <form action={run} className="a-stack">
      {state?.error && (
        <p className="a-alert a-alert--error" role="alert">
          {state.error}
        </p>
      )}
      <label className="a-field">
        <span>{enroll ? "Code aus der App" : "Code oder Wiederherstellungscode"}</span>
        <input name="code" inputMode={enroll ? "numeric" : "text"} autoComplete="one-time-code" required autoFocus maxLength={14} className="a-code-input" />
      </label>
      <Submit pending="Wird geprüft …">{enroll ? "Aktivieren und anmelden" : "Anmelden"}</Submit>
    </form>
  );
}
