"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "./actions";

export function Submit({ children, variant = "primary", pending }: { children: ReactNode; variant?: "primary" | "ghost" | "danger"; pending?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" className={`a-btn a-btn--${variant}`} disabled={busy}>
      {busy ? (pending ?? "Wird gespeichert …") : children}
    </button>
  );
}

/** A form bound to a server action that returns a status message. */
export function ActionForm({ action, children, className }: { action: (s: FormState, f: FormData) => Promise<FormState>; children: ReactNode; className?: string }) {
  const [state, run] = useActionState(action, undefined);
  return (
    <form action={run} className={className}>
      {state?.error && (
        <p className="a-alert a-alert--error" role="alert">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="a-alert a-alert--ok" role="status">
          {state.message}
        </p>
      )}
      {children}
    </form>
  );
}

/** Button that asks for confirmation before running a destructive action. */
export function ConfirmForm({ action, label, question, variant = "danger" }: { action: () => Promise<void>; label: string; question: string; variant?: "danger" | "ghost" }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(question)) e.preventDefault();
      }}
    >
      <Submit variant={variant} pending="Bitte warten …">
        {label}
      </Submit>
    </form>
  );
}
