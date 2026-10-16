/**
 * CSV reading and writing (RFC 4180) without dependencies: quoted fields with
 * delimiters, quotes and line breaks, UTF-8 BOM, delimiter detection (, ; or tab).
 */

/** Guesses the delimiter from the header line. */
export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, 5000).split(/\r?\n/)[0] ?? "";
  let best = ",";
  let bestCount = -1;
  for (const d of [",", ";", "\t"]) {
    // count delimiters outside quotes
    let n = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) n++;
    }
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

/** Parses CSV text into rows of fields. */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === d) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Parses CSV with a header row into objects keyed by the (trimmed) header names. */
export function parseCsvObjects(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const [head, ...body] = parseCsv(input);
  if (!head) return { headers: [], rows: [] };
  const headers = head.map((h) => h.trim());
  return { headers, rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))) };
}

type Cell = string | number | boolean | null | undefined;

/**
 * Writes CSV. With `excel`, text that a spreadsheet would run as a formula
 * (=, +, -, @ …) is prefixed with an apostrophe (CSV injection).
 */
export function toCsv(rows: Cell[][], opts: { delimiter?: string; excel?: boolean; bom?: boolean } = {}) {
  const d = opts.delimiter ?? ",";
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
    if (opts.excel && typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
    return /["\r\n]/.test(s) || s.includes(d) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (opts.bom ? "﻿" : "") + rows.map((r) => r.map(esc).join(d)).join("\r\n") + "\r\n";
}
