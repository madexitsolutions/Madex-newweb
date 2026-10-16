/**
 * Swiss QR-bill (SIX "Swiss Implementation Guidelines for the QR-bill",
 * version 2.3 – data structure SPC / 0200 / coding 1).
 *
 * - creditor account: IBAN or QR-IBAN (CH/LI only)
 * - addresses: structured (type "S") only – combined addresses (type "K")
 *   are no longer accepted since November 2025
 * - reference: QRR (27 digits, modulo 10 recursive; requires a QR-IBAN),
 *   SCOR (ISO 11649 creditor reference "RF…"; requires a normal IBAN) or NON
 * - QR code: byte mode (UTF-8), error correction M, 46 × 46 mm, with the
 *   Swiss cross (7 × 7 mm) in the centre
 */
import QRCode from "qrcode";

export type QrAddress = {
  name: string;
  street?: string;
  buildingNumber?: string;
  postalCode: string;
  town: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
};

export type QrReferenceType = "QRR" | "SCOR" | "NON";

export type QrBillData = {
  /** IBAN or QR-IBAN of the creditor (spaces allowed) */
  account: string;
  creditor: QrAddress;
  /** Rappen; null/undefined = amount left open (filled in by the payer) */
  amount?: number | null;
  currency?: "CHF" | "EUR";
  debtor?: QrAddress | null;
  referenceType: QrReferenceType;
  reference?: string;
  /** unstructured message (Ustrd) */
  message?: string;
  /** structured billing information (StrdBkgInf, e.g. Swico S1) */
  billInfo?: string;
};

/* ---------------------------------------------------------------- IBAN */

export const compactIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();

export const formatIban = (iban: string) => compactIban(iban).replace(/(.{4})(?=.)/g, "$1 ");

/** Generic mod-97 check over an alphanumeric string (letters A=10 … Z=35). */
function mod97(input: string) {
  let rest = 0;
  for (const ch of input) {
    const v = /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest;
}

export function isValidIban(iban: string) {
  const s = compactIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  return mod97(s.slice(4) + s.slice(0, 4)) === 1;
}

/** Swiss/Liechtenstein IBAN with 21 characters (the only ones allowed on a QR-bill). */
export const isChLiIban = (iban: string) => /^(CH|LI)\d{2}[0-9A-Z]{17}$/.test(compactIban(iban)) && isValidIban(iban);

/** QR-IBAN: the institution id (positions 5–9) lies between 30000 and 31999. */
export function isQrIban(iban: string) {
  const s = compactIban(iban);
  if (!isChLiIban(s)) return false;
  const iid = Number(s.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/* ---------------------------------------------------------- references */

const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

/** Check digit of the QR reference (modulo 10, recursive) for a string of digits. */
export function mod10Recursive(digits: string) {
  let carry = 0;
  for (const d of digits) carry = MOD10_TABLE[(carry + Number(d)) % 10];
  return (10 - carry) % 10;
}

/** 27-digit QR reference from up to 26 digits (left-padded with zeros) + check digit. */
export function makeQrReference(base: string | number) {
  const digits = String(base).replace(/\D/g, "");
  if (!digits || digits.length > 26) throw new Error("Die QR-Referenz braucht 1 bis 26 Ziffern.");
  const body = digits.padStart(26, "0");
  return body + mod10Recursive(body);
}

export function isValidQrReference(ref: string) {
  const s = ref.replace(/\s+/g, "");
  return /^\d{27}$/.test(s) && !/^0+$/.test(s) && mod10Recursive(s.slice(0, 26)) === Number(s[26]);
}

/** ISO 11649 creditor reference ("RF" + 2 check digits + 1–21 alphanumerics). */
export function makeScorReference(base: string | number) {
  const body = String(base).replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{1,21}$/.test(body)) throw new Error("Die Creditor Reference braucht 1 bis 21 Buchstaben oder Ziffern.");
  const check = 98 - mod97(body + "RF00");
  return `RF${String(check).padStart(2, "0")}${body}`;
}

export function isValidScorReference(ref: string) {
  const s = ref.replace(/\s+/g, "").toUpperCase();
  return /^RF\d{2}[A-Z0-9]{1,21}$/.test(s) && mod97(s.slice(4) + s.slice(0, 4)) === 1;
}

/** Display format: QRR in blocks of 5 from the right ("21 00000 00003 …"), SCOR in blocks of 4. */
export function formatReference(type: QrReferenceType, ref: string | undefined) {
  const s = (ref ?? "").replace(/\s+/g, "");
  if (type === "QRR") return s.replace(/^(\d{2})(\d{5})(\d{5})(\d{5})(\d{5})(\d{5})$/, "$1 $2 $3 $4 $5 $6");
  if (type === "SCOR") return s.replace(/(.{4})(?=.)/g, "$1 ");
  return "";
}

/* ----------------------------------------------------------- addresses */

/** "Bahnhofstrasse 12a" → { street: "Bahnhofstrasse", buildingNumber: "12a" } */
export function splitStreet(line: string | undefined | null): { street: string; buildingNumber: string } {
  const s = (line ?? "").trim().replace(/\s+/g, " ");
  const m = s.match(/^(.*\D)\s+(\d+[a-zA-Z]?(?:[-/]\d*[a-zA-Z]?)?)$/);
  if (m) return { street: m[1].trim(), buildingNumber: m[2] };
  return { street: s, buildingNumber: "" };
}

/**
 * Keeps only characters allowed by the implementation guidelines (Latin
 * character set) and trims to the field length.
 */
function clean(value: string | undefined | null, max: number) {
  const s = (value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^ -~ -ÿĀ-ſȘ-ț€]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s.slice(0, max);
}

function addressLinesS(a: QrAddress | null | undefined): string[] {
  if (!a) return ["", "", "", "", "", "", ""];
  return ["S", clean(a.name, 70), clean(a.street, 70), clean(a.buildingNumber, 16), clean(a.postalCode, 16), clean(a.town, 35), clean(a.country, 2).toUpperCase()];
}

/** "1234.50" (two decimals, dot) as required in the QR payload. */
export const qrAmount = (cents: number) => (cents / 100).toFixed(2);

/** Problems that prevent a valid QR-bill (German, for the shop owner). */
export function validateQrBill(d: QrBillData): string[] {
  const errors: string[] = [];
  if (!isChLiIban(d.account)) errors.push("Die IBAN ist ungültig oder nicht aus der Schweiz/Liechtenstein.");
  const qrIban = isQrIban(d.account);
  if (d.referenceType === "QRR" && !qrIban) errors.push("Eine QR-Referenz ist nur mit einer QR-IBAN möglich.");
  if (d.referenceType !== "QRR" && qrIban) errors.push("Mit einer QR-IBAN muss eine QR-Referenz verwendet werden.");
  if (d.referenceType === "QRR" && !isValidQrReference(d.reference ?? "")) errors.push("Die QR-Referenz ist ungültig.");
  if (d.referenceType === "SCOR" && !isValidScorReference(d.reference ?? "")) errors.push("Die Creditor Reference (RF) ist ungültig.");
  if (!d.creditor.name || !d.creditor.postalCode || !d.creditor.town || !d.creditor.country) errors.push("Name, PLZ, Ort und Land des Zahlungsempfängers fehlen (Einstellungen → Allgemein).");
  if (d.amount !== null && d.amount !== undefined && (d.amount < 1 || d.amount > 99_999_999_999)) errors.push("Der Betrag muss zwischen 0.01 und 999 999 999.99 liegen.");
  if ((d.message ?? "").length + (d.billInfo ?? "").length > 140) errors.push("Mitteilung und Rechnungsinformationen sind zusammen länger als 140 Zeichen.");
  return errors;
}

/** The QR code payload (elements separated by LF, no trailing separator). */
export function buildQrPayload(d: QrBillData): string {
  const lines = [
    "SPC",
    "0200",
    "1",
    compactIban(d.account),
    ...addressLinesS(d.creditor),
    // ultimate creditor: reserved for future use, must stay empty
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    d.amount !== null && d.amount !== undefined ? qrAmount(d.amount) : "",
    d.currency ?? "CHF",
    ...addressLinesS(d.debtor),
    d.referenceType,
    d.referenceType === "NON" ? "" : (d.reference ?? "").replace(/\s+/g, "").toUpperCase(),
    clean(d.message, 140),
    "EPD",
  ];
  if (d.billInfo) lines.push(clean(d.billInfo, 140));
  return lines.join("\n");
}

/* ----------------------------------------------------------------- SVG */

/**
 * The QR code as SVG (46 × 46 mm, no quiet zone) with the Swiss cross. The
 * caller places it with a 5 mm quiet zone in the payment part.
 */
export function qrBillSvg(payload: string, opts: { sizeMm?: number; title?: string } = {}): string {
  const size = opts.sizeMm ?? 46;
  const qr = QRCode.create([{ data: Buffer.from(payload, "utf8"), mode: "byte" }], { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let path = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!qr.modules.get(y, x)) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < n && qr.modules.get(y, x + w)) w++;
      path += `M${x} ${y}h${w}v1h-${w}z`;
      x += w;
    }
  }
  // Swiss cross: 7 × 7 mm white field with a black square and the white cross
  const u = n / size; // modules per mm
  const outer = 7 * u;
  const inner = outer * (6 / 7);
  const c = n / 2;
  const bar = (inner * 6) / 32;
  const len = (inner * 20) / 32;
  const f = (v: number) => Number(v.toFixed(3));
  const cross =
    `<rect x="${f(c - outer / 2)}" y="${f(c - outer / 2)}" width="${f(outer)}" height="${f(outer)}" fill="#fff"/>` +
    `<rect x="${f(c - inner / 2)}" y="${f(c - inner / 2)}" width="${f(inner)}" height="${f(inner)}" fill="#000"/>` +
    `<rect x="${f(c - bar / 2)}" y="${f(c - len / 2)}" width="${f(bar)}" height="${f(len)}" fill="#fff"/>` +
    `<rect x="${f(c - len / 2)}" y="${f(c - bar / 2)}" width="${f(len)}" height="${f(bar)}" fill="#fff"/>`;
  const title = opts.title ? `<title>${opts.title.replace(/[<&>]/g, "")}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}mm" height="${size}mm" shape-rendering="crispEdges" role="img">${title}<rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/>${cross}</svg>`;
}
