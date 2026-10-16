"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form-state";

/** pending state of an ActionForm (which submits via onSubmit so React keeps the typed values) */
const PendingContext = createContext(false);

export function Submit({ children, variant = "primary", pending, name, value, disabled }: { children: ReactNode; variant?: "primary" | "ghost" | "danger"; pending?: string; name?: string; value?: string; disabled?: boolean }) {
  const status = useFormStatus();
  const ctx = useContext(PendingContext);
  const busy = status.pending || ctx;
  return (
    <button type="submit" className={`a-btn a-btn--${variant}`} disabled={busy || disabled} name={name} value={value} aria-busy={busy || undefined}>
      {busy ? (pending ?? "Wird gespeichert …") : children}
    </button>
  );
}

/**
 * Form bound to a server action returning FormState. It submits through
 * onSubmit (not the `action` prop) so React does not clear what the user typed
 * when the action returns an error.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  id,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children: ReactNode | ((state: FormState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, run, isPending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.message && !state.error) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <PendingContext.Provider value={isPending}>
      <form
        ref={ref}
        id={id}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isPending) return;
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const data = new FormData(e.currentTarget, submitter);
          startTransition(() => run(data));
        }}
      >
        {state?.error && (
          <p className="a-alert a-alert--error" role="alert">
            {state.error}
          </p>
        )}
        {state?.message && !state.error && (
          <p className="a-alert a-alert--ok" role="status">
            {state.message}
          </p>
        )}
        {typeof children === "function" ? children(state) : children}
      </form>
    </PendingContext.Provider>
  );
}

/** Inline field error from FormState.fieldErrors */
export function FieldError({ state, name }: { state: FormState; name: string }) {
  const msg = state?.fieldErrors?.[name];
  if (!msg) return null;
  return (
    <span className="a-field__error" role="alert">
      {msg}
    </span>
  );
}

/** Button that asks for confirmation before running a (usually destructive) server action. */
export function ConfirmForm({ action, label, question, variant = "danger", children }: { action: (f: FormData) => Promise<void>; label: string; question: string; variant?: "danger" | "ghost" | "primary"; children?: ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(question)) e.preventDefault();
      }}
    >
      {children}
      <Submit variant={variant} pending="Bitte warten …">
        {label}
      </Submit>
    </form>
  );
}

/** Copies a value to the clipboard (API keys, links). */
export function CopyButton({ value, label = "Kopieren" }: { value: string; label?: string }) {
  return (
    <button
      type="button"
      className="a-btn a-btn--ghost a-btn--sm"
      onClick={async (e) => {
        const btn = e.currentTarget;
        await navigator.clipboard.writeText(value);
        const old = btn.textContent;
        btn.textContent = "Kopiert";
        setTimeout(() => (btn.textContent = old), 1500);
      }}
    >
      {label}
    </button>
  );
}
