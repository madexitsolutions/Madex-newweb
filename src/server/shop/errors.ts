/** Input errors raised by the shop logic; actions turn them into FormState, the API into 422. */
import type { ZodError } from "zod";
import { fail, type FormState } from "@/lib/form-state";

export class InputError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "InputError";
    this.fieldErrors = fieldErrors;
  }
}

/** zod error → InputError with the first message per field. */
export function fromZod(error: ZodError, message?: string) {
  const fields: Record<string, string> = {};
  for (const i of error.issues) {
    const k = i.path.join(".");
    if (!fields[k]) fields[k] = i.message;
  }
  const first = error.issues[0]?.message;
  return new InputError(message ?? (error.issues.length === 1 && first ? first : "Bitte prüfen Sie die markierten Felder."), fields);
}

/** For server actions: InputError → fail(), anything else is rethrown (Next.js redirects too). */
export function toFormState(e: unknown): FormState {
  if (e instanceof InputError) return fail(e.message, e.fieldErrors);
  throw e;
}

/**
 * Errors of the shop services. `message` is German and safe to show to the
 * customer or staff; `code` is stable for the API (maps to HTTP status codes).
 */
export type ShopErrorCode =
  | "not_found"
  | "validation"
  | "out_of_stock"
  | "unavailable"
  | "coupon_invalid"
  | "shipping_unavailable"
  | "payment_unavailable"
  | "payment_failed"
  | "price_changed"
  | "cart_empty"
  | "conflict"
  | "forbidden";

export class ShopError extends Error {
  constructor(
    public code: ShopErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ShopError";
  }
}

/** HTTP status for API route handlers. */
export function shopErrorStatus(code: ShopErrorCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "conflict":
    case "price_changed":
      return 409;
    case "payment_failed":
      return 502;
    default:
      return 422;
  }
}

export const isShopError = (e: unknown): e is ShopError => e instanceof ShopError;
