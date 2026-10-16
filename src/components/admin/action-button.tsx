"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import type { FormState } from "@/lib/form-state";

/**
 * One-button form for a server action returning FormState (resend, revoke,
 * delete …). Optionally asks for confirmation and shows the result inline –
 * unlike ConfirmForm, errors from the server reach the user.
 */
export function ActionButton({
  action,
  label,
  fields = {},
  question,
  variant = "ghost",
  small = true,
  pending = "Bitte warten …",
  icon,
  className,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  label: ReactNode;
  fields?: Record<string, string>;
  question?: string;
  variant?: "primary" | "ghost" | "danger" | "quiet";
  small?: boolean;
  pending?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const [state, run, isPending] = useActionState(action, undefined);
  return (
    <form
      className={`s-actionbtn${className ? " " + className : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (isPending) return;
        if (question && !window.confirm(question)) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={`a-btn a-btn--${variant}${small ? " a-btn--sm" : ""}`} disabled={isPending} aria-busy={isPending || undefined}>
        {icon}
        {isPending ? pending : label}
      </button>
      {state?.error && (
        <span className="s-inline-msg s-inline-msg--error" role="alert">
          {state.error}
        </span>
      )}
      {state?.message && !state.error && (
        <span className="s-inline-msg" role="status">
          {state.message}
        </span>
      )}
    </form>
  );
}

/** Shows a secret exactly once with a copy button (API keys, webhook secrets). */
export function SecretOnce({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="s-secret" role="status">
      <p className="s-secret__label">{label}</p>
      <div className="s-secret__row">
        <code className="s-secret__value">{value}</code>
        <button
          type="button"
          className="a-btn a-btn--primary a-btn--sm"
          onClick={async (e) => {
            const btn = e.currentTarget;
            await navigator.clipboard.writeText(value);
            btn.textContent = "Kopiert";
            setTimeout(() => (btn.textContent = "Kopieren"), 1500);
          }}
        >
          Kopieren
        </button>
      </div>
      {hint && <p className="s-secret__hint">{hint}</p>}
    </div>
  );
}
