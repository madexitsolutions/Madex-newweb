import { describe, expect, it } from "vitest";
import { contactSchema } from "@/lib/contact-schema";
import { rateLimit } from "@/lib/rate-limit";

const valid = { name: "Anna Muster", email: "anna@example.ch", message: "Wir brauchen eine neue Website.", consent: true as const };

describe("Kontaktformular-Schema", () => {
  it("akzeptiert eine gültige Anfrage", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });
  it("verlangt Einwilligung, Name, E-Mail und Beschreibung", () => {
    expect(contactSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, email: "keine-mail" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "kurz" }).success).toBe(false);
  });
  it("lehnt ungültige Telefonnummern ab", () => {
    expect(contactSchema.safeParse({ ...valid, phone: "+41 52 589 67 59" }).success).toBe(true);
    expect(contactSchema.safeParse({ ...valid, phone: "<script>" }).success).toBe(false);
  });
  it("erkennt ein ausgefülltes Honeypot-Feld", () => {
    expect(contactSchema.safeParse({ ...valid, fax: "spam" }).success).toBe(false);
  });
});

describe("Rate Limiting", () => {
  it("blockiert nach dem Limit", () => {
    const key = "test-" + Math.random();
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(false);
  });
});
