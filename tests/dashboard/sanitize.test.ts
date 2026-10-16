import { describe, expect, it } from "vitest";
import { htmlToText, sanitizeHtml } from "@/server/lib/sanitize";
import { taxFromGross, taxOnNet } from "@/server/shop/tax";

describe("HTML-Bereinigung", () => {
  it("entfernt Skripte, Events und gefährliche Links", () => {
    const out = sanitizeHtml(`<p onclick="x()">Hallo <b>Welt</b><script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src="x" onerror="y()"><iframe src="//evil"></iframe>`);
    expect(out).toBe("<p>Hallo <strong>Welt</strong></p><a>x</a>");
  });

  it("behält erlaubte Formatierung und sichere Links", () => {
    expect(sanitizeHtml('<h2>Titel</h2><ul><li><a href="https://a.ch" target="_blank">A</a></li></ul>')).toBe('<h2>Titel</h2><ul><li><a href="https://a.ch" target="_blank" rel="noopener noreferrer">A</a></li></ul>');
  });

  it("liefert Klartext", () => {
    expect(htmlToText("<p>Eins</p><p>Zwei &amp; drei</p>")).toBe("Eins\nZwei & drei");
  });
});

describe("Mehrwertsteuer", () => {
  it("rechnet die MWST aus Bruttopreisen heraus", () => {
    expect(taxFromGross(10810, 810)).toBe(810);
    expect(taxFromGross(10000, 0)).toBe(0);
    expect(taxOnNet(10000, 810)).toBe(810);
  });
});
