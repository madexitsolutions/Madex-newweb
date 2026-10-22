/** Order labels, tones and carrier presets – shared by server and client (no server imports). */

export type OrderStatus = "pending" | "processing" | "on_hold" | "completed" | "cancelled" | "refunded" | "failed";
export type PaymentStatus = "unpaid" | "pending" | "authorized" | "paid" | "partially_refunded" | "refunded" | "failed";
export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled" | "returned";
export type Tone = "ok" | "warn" | "bad" | "info" | "muted" | "accent";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; hint: string }> = {
  pending: { label: "Ausstehend", tone: "muted", hint: "Wartet auf die Online-Zahlung." },
  processing: { label: "In Bearbeitung", tone: "warn", hint: "Bezahlt oder freigegeben – bereit zum Versand." },
  on_hold: { label: "Wartend", tone: "info", hint: "Wartet auf den Zahlungseingang (Vorauskasse, Rechnung)." },
  completed: { label: "Abgeschlossen", tone: "ok", hint: "Bezahlt und versendet." },
  cancelled: { label: "Storniert", tone: "muted", hint: "Storniert, Lager zurückgebucht." },
  refunded: { label: "Rückerstattet", tone: "muted", hint: "Vollständig rückerstattet." },
  failed: { label: "Fehlgeschlagen", tone: "bad", hint: "Zahlung abgebrochen oder abgelehnt." },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unbezahlt", tone: "warn" },
  pending: { label: "Zahlung ausstehend", tone: "muted" },
  authorized: { label: "Autorisiert", tone: "info" },
  paid: { label: "Bezahlt", tone: "ok" },
  partially_refunded: { label: "Teilweise erstattet", tone: "info" },
  refunded: { label: "Erstattet", tone: "muted" },
  failed: { label: "Fehlgeschlagen", tone: "bad" },
};

export const FULFILLMENT_STATUS: Record<FulfillmentStatus, { label: string; tone: Tone }> = {
  unfulfilled: { label: "Nicht versendet", tone: "warn" },
  partial: { label: "Teilweise versendet", tone: "info" },
  fulfilled: { label: "Versendet", tone: "ok" },
  returned: { label: "Retourniert", tone: "muted" },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  stripe: "Karte / TWINT (Stripe)",
  payrexx: "Online (Payrexx)",
  invoice: "Rechnung",
  bank_transfer: "Vorauskasse",
  pickup: "Barzahlung bei Abholung",
  manual: "Manuell",
};

export const paymentMethodLabel = (key: string) => PAYMENT_METHOD_LABELS[key] ?? (key || "–");

/** Tracking link templates; {n} is replaced by the URL-encoded tracking number. */
export const CARRIERS = {
  post: { label: "Post CH", url: "https://www.post.ch/swisspost-tracking?formattedParcelCodes={n}" },
  dhl: { label: "DHL", url: "https://www.dhl.com/ch-de/home/tracking.html?tracking-id={n}&submit=1" },
  dpd: { label: "DPD", url: "https://tracking.dpd.de/status/de_CH/parcel/{n}" },
  ups: { label: "UPS", url: "https://www.ups.com/track?loc=de_CH&tracknum={n}" },
  planzer: { label: "Planzer", url: "https://www.planzer.ch/de/sendungsverfolgung?sendungsnummer={n}" },
} as const;

export type CarrierKey = keyof typeof CARRIERS;

export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  if (!carrier || !number) return null;
  const c = CARRIERS[carrier as CarrierKey];
  return c ? c.url.replace("{n}", encodeURIComponent(number.trim())) : null;
}

export const COUNTRY_NAMES: Record<string, string> = {
  CH: "Schweiz",
  LI: "Liechtenstein",
  DE: "Deutschland",
  AT: "Österreich",
  FR: "Frankreich",
  IT: "Italien",
  NL: "Niederlande",
  BE: "Belgien",
  LU: "Luxemburg",
  ES: "Spanien",
  PT: "Portugal",
  GB: "Vereinigtes Königreich",
  US: "Vereinigte Staaten",
  DK: "Dänemark",
  SE: "Schweden",
  NO: "Norwegen",
  FI: "Finnland",
  PL: "Polen",
  CZ: "Tschechien",
};

export const countryName = (code: string | null | undefined) => (code ? (COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase()) : "");

/** Address lines for display (name, company, street, zip city, country unless CH). */
export function addressLines(a: { firstName?: string; lastName?: string; company?: string; street?: string; street2?: string; zip?: string; city?: string; country?: string } | null | undefined, opts: { homeCountry?: string } = {}) {
  if (!a) return [];
  const home = (opts.homeCountry ?? "CH").toUpperCase();
  return [
    [a.firstName, a.lastName].filter(Boolean).join(" "),
    a.company,
    a.street,
    a.street2,
    [a.zip, a.city].filter(Boolean).join(" "),
    a.country && a.country.toUpperCase() !== home ? countryName(a.country) : "",
  ].filter((x): x is string => Boolean(x && x.trim()));
}

/** What the customer reads on the order status page. */
export function customerOrderState(o: { status: string; paymentStatus: string; fulfillmentStatus: string }) {
  if (o.status === "cancelled") return "Die Bestellung wurde storniert.";
  if (o.status === "refunded") return "Die Bestellung wurde zurückerstattet.";
  if (o.status === "failed") return "Die Zahlung ist fehlgeschlagen.";
  if (o.fulfillmentStatus === "fulfilled") return "Ihre Bestellung ist unterwegs.";
  if (o.paymentStatus === "paid") return "Zahlung erhalten – wir bereiten Ihre Bestellung vor.";
  if (o.status === "pending") return "Wir warten auf Ihre Zahlung.";
  return "Ihre Bestellung ist eingegangen.";
}
