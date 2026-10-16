/**
 * Allow-list HTML sanitizer for rich text (product descriptions, posts).
 * Keeps basic formatting, links and images; drops scripts, styles, event
 * handlers and unknown tags. No dependencies, runs on the server.
 */
const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "a", "img", "hr", "table", "thead", "tbody", "tr", "th", "td", "figure", "figcaption", "code", "pre", "span"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math", "form", "input", "button", "select", "textarea", "head", "title", "meta", "link"]);
const ATTRS: Record<string, string[]> = { a: ["href", "title", "target", "rel"], img: ["src", "alt", "width", "height"], th: ["colspan", "rowspan"], td: ["colspan", "rowspan"] };

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function safeUrl(url: string, img = false) {
  const u = url.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (/^(https?:|mailto:|tel:)/i.test(u) || u.startsWith("/") || u.startsWith("#")) return u;
  if (img && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(u)) return u;
  return null;
}

function decodeEntities(s: string) {
  return s.replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);?/g, (_, d) => String.fromCharCode(Number(d)));
}

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let html = input.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of DROP_WITH_CONTENT) html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "").replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  return html
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      const closing = full.startsWith("</");
      const mapped = tag === "b" ? "strong" : tag === "i" ? "em" : tag === "h1" ? "h2" : tag === "div" ? "p" : tag;
      if (!ALLOWED_TAGS.has(mapped)) return "";
      if (closing) return mapped === "br" || mapped === "img" || mapped === "hr" ? "" : `</${mapped}>`;
      const allowed = ATTRS[mapped] ?? [];
      const out: string[] = [];
      const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(rawAttrs))) {
        const name = m[1].toLowerCase();
        if (!allowed.includes(name)) continue;
        let value = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
        if (name === "href" || name === "src") {
          const safe = safeUrl(value, name === "src");
          if (!safe) continue;
          value = safe;
        }
        if (name === "target") value = value === "_blank" ? "_blank" : "";
        if ((name === "width" || name === "height" || name === "colspan" || name === "rowspan") && !/^\d{1,4}$/.test(value)) continue;
        if (value !== "") out.push(`${name}="${escapeAttr(value)}"`);
      }
      if (mapped === "img" && !out.some((a) => a.startsWith("src="))) return "";
      if (mapped === "a" && out.some((a) => a.startsWith('target="_blank"'))) out.push('rel="noopener noreferrer"');
      return `<${mapped}${out.length ? " " + out.join(" ") : ""}${mapped === "br" || mapped === "img" || mapped === "hr" ? " /" : ""}>`;
    })
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .trim();
}

/** Plain text from HTML (excerpts, meta descriptions). */
export function htmlToText(html: string) {
  return decodeEntities(html.replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
