/** IPv4 CIDR matching for allowlists and blocks (IPv6 entries match exactly). */
function v4(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function ipMatches(ip: string, rule: string): boolean {
  const clean = ip.replace(/^::ffff:/, "");
  const [base, bitsRaw] = rule.trim().split("/");
  if (!bitsRaw) return clean === base.trim();
  const a = v4(clean);
  const b = v4(base);
  const bits = Number(bitsRaw);
  if (a === null || b === null || !(bits >= 0 && bits <= 32)) return false;
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

export function isValidIpRule(rule: string) {
  const [base, bits] = rule.trim().split("/");
  if (bits !== undefined) return v4(base) !== null && /^\d{1,2}$/.test(bits) && Number(bits) <= 32;
  return v4(base) !== null || /^[0-9a-f:]+$/i.test(base);
}
