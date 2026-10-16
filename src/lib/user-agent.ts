/** "Mozilla/5.0 (Macintosh; …) Chrome/141…" → "Chrome auf macOS" (for session and login lists). */
export function describeUserAgent(ua: string): { label: string; mobile: boolean } {
  if (!ua) return { label: "Unbekanntes Gerät", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|python|axios|Headless/i.test(ua)
              ? "Programm"
              : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} auf ${os}` : browser, mobile: /Mobile|iPhone|Android/.test(ua) };
}
