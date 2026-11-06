import { describe, expect, it } from "vitest";
import { isBotTrap } from "@/lib/honeypot";

describe("honeypot", () => {
  it("lets browser autofill through", () => {
    expect(isBotTrap("")).toBe(false);
    expect(isBotTrap("info@madex-it.ch", ["info@madex-it.ch"])).toBe(false);
    expect(isBotTrap("anna@example.ch")).toBe(false);
    expect(isBotTrap("Madex IT Solutions")).toBe(false);
    expect(isBotTrap("+41 52 589 67 59")).toBe(false);
    expect(isBotTrap("https://glasklarsauber.ch", ["https://glasklarsauber.ch"])).toBe(false);
  });
  it("catches what bots put in", () => {
    expect(isBotTrap("http://cheap-pills.example")).toBe(true);
    expect(isBotTrap("visit www.spam.example")).toBe(true);
    expect(isBotTrap("<a href=x>x</a>")).toBe(true);
    expect(isBotTrap("x".repeat(120))).toBe(true);
  });
});
