/**
 * Honeypot: a hidden field that people never see, so a filled one means a bot.
 * Browser autofill and password managers sometimes fill it anyway – with the
 * visitor's own e-mail, name, phone number or website. Those are people; bots
 * leave links, markup or long text. The other checks (time to fill in, own
 * site only, limits) still apply to everything that passes here.
 */
export function isBotTrap(hp: string | undefined, own: (string | undefined)[] = []) {
  const v = (hp ?? "").trim();
  if (!v) return false;
  if (own.some((o) => o && o.trim().toLowerCase() === v.toLowerCase())) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return false;
  return v.length > 80 || /https?:|www\.|<|\[url|\[link/i.test(v);
}
