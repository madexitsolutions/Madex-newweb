/** Result of a server action bound to a form. */
export type FormState = { error?: string; message?: string; fieldErrors?: Record<string, string>; data?: Record<string, unknown> } | undefined;

export const ok = (message: string, data?: Record<string, unknown>): FormState => ({ message, data });
export const fail = (error: string, fieldErrors?: Record<string, string>): FormState => ({ error, fieldErrors });

/** zod issues → { field: message } */
export function zodFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export const formString = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const formBool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true" || f.get(k) === "1";
export const formList = (f: FormData, k: string) =>
  String(f.get(k) ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
