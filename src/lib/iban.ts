/**
 * IBAN checks (ISO 13616, mod 97) usable on server and client. Swiss and
 * Liechtenstein IBANs have 21 characters; QR-IBANs (IID 30000–31999) only work
 * with a QR reference and are rejected for plain bank transfers.
 */
const LENGTHS: Record<string, number> = {
  CH: 21, LI: 21, DE: 22, AT: 20, FR: 27, IT: 27, LU: 20, NL: 18, BE: 16, ES: 24, PT: 25, GB: 22, IE: 22, DK: 18, SE: 24, NO: 15, FI: 18, PL: 28, CZ: 24, SK: 24, SI: 19, HR: 21, HU: 28, MC: 27, SM: 27,
};

export function normalizeIban(input: string) {
  return String(input ?? "").replace(/[\s-]+/g, "").toUpperCase();
}

/** "CH9300762011623852957" → "CH93 0076 2011 6238 5295 7" */
export function formatIban(input: string) {
  return normalizeIban(input).replace(/(.{4})(?=.)/g, "$1 ");
}

function mod97(iban: string) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of rearranged) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest;
}

/** Problem with an IBAN as a sentence that says how to fix it, or null when it is valid. */
export function ibanError(input: string): string | null {
  const iban = normalizeIban(input);
  if (!iban) return "Bitte eine IBAN eingeben.";
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return "Die IBAN beginnt mit dem Ländercode und zwei Prüfziffern, z. B. CH93 0076 2011 6238 5295 7.";
  const len = LENGTHS[iban.slice(0, 2)];
  if (len && iban.length !== len) return `Eine IBAN aus ${iban.slice(0, 2)} hat ${len} Zeichen, eingegeben wurden ${iban.length}.`;
  if (!len && (iban.length < 15 || iban.length > 34)) return "Die IBAN hat nicht die richtige Länge.";
  if ((iban.startsWith("CH") || iban.startsWith("LI")) && !/^[A-Z]{2}\d{7}[A-Z0-9]{12}$/.test(iban)) return "Eine Schweizer IBAN enthält nach dem Ländercode 7 Ziffern und 12 Zeichen.";
  if (mod97(iban) !== 1) return "Die Prüfziffer der IBAN stimmt nicht. Bitte prüfen Sie die Eingabe auf Tippfehler.";
  if (iban.startsWith("CH") || iban.startsWith("LI")) {
    const iid = Number(iban.slice(4, 9));
    if (iid >= 30000 && iid <= 31999) return "Das ist eine QR-IBAN. Für Banküberweisungen ohne QR-Referenz brauchen Sie die normale IBAN des Kontos.";
  }
  return null;
}

export const isValidIban = (input: string) => ibanError(input) === null;
