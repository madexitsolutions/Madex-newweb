/** Public base URL of this dashboard installation (links in e-mails, absolute URLs in the API). */
export function appUrl(path = "") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + (path.startsWith("/") || path === "" ? path : `/${path}`);
}
