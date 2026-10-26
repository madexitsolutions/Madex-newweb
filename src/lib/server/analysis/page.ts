/**
 * Checks that can be read from the page itself (HTML, headers, robots.txt,
 * sitemap). Each check carries a status, the measured value and a short German
 * explanation; scoring happens in score.ts.
 */
import { parse, type HTMLElement } from "node-html-parser";
import type { Check, CheckStatus, PagePreview } from "@/lib/analysis";
import { probe, type Fetched } from "./safe-fetch";

const fmt = (n: number) => n.toLocaleString("de-CH");
const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

export type Parsed = {
  root: HTMLElement;
  html: string;
  text: string;
  url: URL;
  fetched: Fetched;
};

export function parsePage(fetched: Fetched): Parsed {
  const root = parse(fetched.body, { comment: false, blockTextElements: { script: true, style: true, noscript: true } });
  const body = root.querySelector("body") ?? root;
  const textRoot = parse(body.toString(), { blockTextElements: { script: false, style: false, noscript: false } });
  return { root, html: fetched.body, text: clean(textRoot.textContent), url: new URL(fetched.url), fetched };
}

const meta = (p: Parsed, name: string) => clean(p.root.querySelector(`meta[name="${name}" i]`)?.getAttribute("content") ?? p.root.querySelector(`meta[property="${name}" i]`)?.getAttribute("content"));
const abs = (p: Parsed, href: string | undefined) => {
  try {
    return href ? new URL(href, p.url).toString() : "";
  } catch {
    return "";
  }
};

export function preview(p: Parsed): PagePreview {
  const icon = p.root.querySelector('link[rel~="icon" i]')?.getAttribute("href") ?? "/favicon.ico";
  const nav = p.root
    .querySelectorAll("nav a, header a")
    .map((a) => clean(a.textContent))
    .filter((t) => t.length > 1 && t.length < 28);
  return {
    title: clean(p.root.querySelector("title")?.textContent).slice(0, 140),
    description: meta(p, "description").slice(0, 260),
    h1: clean(p.root.querySelector("h1")?.textContent).slice(0, 140),
    favicon: abs(p, icon),
    ogImage: abs(p, meta(p, "og:image")),
    themeColor: /^#[0-9a-f]{3,8}$/i.test(meta(p, "theme-color")) ? meta(p, "theme-color") : "",
    headings: p.root
      .querySelectorAll("h2, h3")
      .map((h) => clean(h.textContent))
      .filter(Boolean)
      .slice(0, 8)
      .map((h) => h.slice(0, 90)),
    nav: [...new Set(nav)].slice(0, 7),
    images: p.root.querySelectorAll("img").length,
    links: p.root.querySelectorAll("a[href]").length,
    words: p.text ? p.text.split(" ").length : 0,
  };
}

function check(category: Check["category"], id: string, label: string, status: CheckStatus, value: string | undefined, detail: string, weight = 1): Check {
  return { id, category, label, status, value, detail, weight };
}

/* ------------------------------------------------------------------ technik */

export async function techChecks(p: Parsed): Promise<Check[]> {
  const h = p.fetched.headers;
  const out: Check[] = [];
  const https = p.url.protocol === "https:";
  out.push(check("tech", "https", "Verschlüsselung (HTTPS)", https ? "ok" : "bad", https ? "aktiv" : "fehlt", https ? "Die Website wird verschlüsselt übertragen – Browser zeigen das Schloss-Symbol." : "Ohne HTTPS warnen Browser vor Ihrer Website, und Google stuft sie schlechter ein.", 3));

  if (https) {
    const httpVariant = await probe(`http://${p.url.host}/`, 8000);
    const upgrades = httpVariant.status > 0 && httpVariant.url.startsWith("https://");
    out.push(check("tech", "redirect", "Weiterleitung auf HTTPS", upgrades ? "ok" : httpVariant.status === 0 ? "info" : "warn", upgrades ? "eingerichtet" : httpVariant.status === 0 ? "nicht prüfbar" : "fehlt", upgrades ? "Wer die Adresse ohne https eingibt, landet automatisch auf der sicheren Version." : "Die unverschlüsselte Adresse sollte automatisch auf https weiterleiten.", 1));
  }

  const ms = p.fetched.ms;
  out.push(check("tech", "ttfb", "Antwortzeit des Servers", ms < 800 ? "ok" : ms < 1800 ? "warn" : "bad", `${fmt(ms)} ms`, ms < 800 ? "Der Server antwortet schnell." : "Der Server braucht lange für die erste Antwort – Hosting oder Caching verbessern.", 2));

  const enc = h.get("content-encoding") ?? "";
  out.push(check("tech", "compression", "Komprimierung", /br|gzip|zstd|deflate/.test(enc) ? "ok" : "warn", enc || "keine", /br|gzip|zstd|deflate/.test(enc) ? "Seiten werden komprimiert übertragen." : "Ohne Komprimierung (gzip/Brotli) lädt die Seite unnötig viele Daten.", 1));

  const hsts = Boolean(h.get("strict-transport-security"));
  const nosniff = (h.get("x-content-type-options") ?? "").includes("nosniff");
  const frame = Boolean(h.get("x-frame-options") || /frame-ancestors/.test(h.get("content-security-policy") ?? ""));
  const secCount = [hsts, nosniff, frame].filter(Boolean).length;
  out.push(check("tech", "headers", "Sicherheits-Header", secCount === 3 ? "ok" : secCount >= 1 ? "warn" : "bad", `${secCount} von 3`, "HSTS, Schutz vor Einbettung (Clickjacking) und nosniff schützen Besucher zusätzlich.", 1));

  const mixed = https ? (p.html.match(/(?:src|href)=["']http:\/\/[^"']+\.(?:js|css|png|jpe?g|gif|webp|svg)/gi) ?? []).length : 0;
  if (https) out.push(check("tech", "mixed", "Unsichere Inhalte auf sicherer Seite", mixed === 0 ? "ok" : "warn", mixed === 0 ? "keine" : `${mixed} Dateien`, mixed === 0 ? "Alle Dateien werden verschlüsselt geladen." : "Einige Bilder oder Skripte werden noch über http geladen.", 1));

  const kb = Math.round(p.fetched.bytes / 1024);
  out.push(check("tech", "html-size", "Grösse des HTML-Dokuments", kb < 150 ? "ok" : kb < 400 ? "warn" : "bad", `${fmt(kb)} KB`, kb < 150 ? "Das Dokument ist schlank." : "Das HTML ist sehr gross – oft durch eingebettete Daten oder viele Erweiterungen.", 1));

  const cms = /wp-content|wp-includes/i.test(p.html) ? "WordPress" : /wix\.com|_wixCIDX/i.test(p.html) ? "Wix" : /jimdo/i.test(p.html) ? "Jimdo" : /cdn\.shopify|Shopify\.theme/i.test(p.html) ? "Shopify" : /squarespace/i.test(p.html) ? "Squarespace" : /webflow/i.test(p.html) ? "Webflow" : /__NEXT_DATA__|\/_next\//.test(p.html) ? "Next.js" : "";
  if (cms) out.push(check("tech", "cms", "System der Website", "info", cms, `Die Website läuft mit ${cms}.`, 0));
  const gen = meta(p, "generator");
  if (/wordpress\s*[0-9]/i.test(gen)) out.push(check("tech", "version", "Sichtbare Software-Version", "warn", gen.slice(0, 40), "Die WordPress-Version ist öffentlich sichtbar – das erleichtert gezielte Angriffe.", 1));

  return out;
}

/* ---------------------------------------------------------------------- seo */

export function seoChecks(p: Parsed): Check[] {
  const out: Check[] = [];
  const title = clean(p.root.querySelector("title")?.textContent);
  out.push(
    check(
      "seo",
      "title",
      "Seitentitel",
      !title ? "bad" : title.length < 25 || title.length > 65 ? "warn" : "ok",
      title ? `${title.length} Zeichen` : "fehlt",
      !title ? "Ohne Titel weiss Google nicht, worum es geht – er erscheint als Überschrift im Suchergebnis." : title.length > 65 ? "Der Titel wird in Google abgeschnitten (ideal 30–60 Zeichen)." : title.length < 25 ? "Der Titel ist sehr kurz – nennen Sie Leistung und Ort." : "Der Titel hat eine gute Länge für Google.",
      3,
    ),
  );
  const desc = meta(p, "description");
  out.push(
    check(
      "seo",
      "description",
      "Meta-Beschreibung",
      !desc ? "bad" : desc.length < 70 || desc.length > 165 ? "warn" : "ok",
      desc ? `${desc.length} Zeichen` : "fehlt",
      !desc ? "Ohne Beschreibung wählt Google einen zufälligen Textausschnitt – eine gute Beschreibung bringt mehr Klicks." : desc.length > 165 ? "Die Beschreibung wird abgeschnitten (ideal 70–160 Zeichen)." : desc.length < 70 ? "Die Beschreibung ist kurz – nutzen Sie den Platz für Nutzen und Aufruf." : "Die Beschreibung hat eine gute Länge.",
      2,
    ),
  );
  const h1s = p.root.querySelectorAll("h1").map((h) => clean(h.textContent)).filter(Boolean);
  out.push(check("seo", "h1", "Hauptüberschrift (H1)", h1s.length === 1 ? "ok" : h1s.length === 0 ? "bad" : "warn", h1s.length === 1 ? "1 vorhanden" : `${h1s.length} gefunden`, h1s.length === 1 ? "Die Seite hat genau eine Hauptüberschrift." : h1s.length === 0 ? "Es fehlt eine H1 – sie sagt Google, worum es auf der Seite geht." : "Mehrere H1 verwässern das Hauptthema der Seite.", 2));
  const h2 = p.root.querySelectorAll("h2").length;
  out.push(check("seo", "structure", "Gliederung mit Zwischentiteln", h2 >= 2 ? "ok" : h2 === 1 ? "warn" : "bad", `${h2} × H2`, h2 >= 2 ? "Der Inhalt ist mit Zwischentiteln gegliedert." : "Zwischentitel (H2) helfen Lesern und Google, die Inhalte zu verstehen.", 1));

  const imgs = p.root.querySelectorAll("img").filter((i) => !/^data:|\.svg/i.test(i.getAttribute("src") ?? "") || i.getAttribute("src") === undefined);
  // alt="" marks a decorative image on purpose – only a missing attribute is a gap
  const missing = imgs.filter((i) => i.getAttribute("alt") === undefined).length;
  const pct = imgs.length ? Math.round(((imgs.length - missing) / imgs.length) * 100) : 100;
  out.push(check("seo", "alt", "Bildbeschreibungen (Alt-Texte)", pct >= 90 ? "ok" : pct >= 60 ? "warn" : "bad", !imgs.length ? "keine Bilder" : missing ? `${missing} von ${imgs.length} ohne Alt-Text` : `alle ${imgs.length} beschrieben`, pct >= 90 ? "Bilder sind beschrieben – gut für Google-Bildersuche und Barrierefreiheit." : "Bilder ohne Alt-Text verschenken Sichtbarkeit in der Google-Bildersuche.", 1));

  const canonical = p.root.querySelector('link[rel="canonical" i]')?.getAttribute("href");
  out.push(check("seo", "canonical", "Kanonische Adresse", canonical ? "ok" : "warn", canonical ? "gesetzt" : "fehlt", canonical ? "Google weiss, welche Adresse die Hauptversion der Seite ist." : "Ohne Canonical kann Google Varianten der Seite als doppelte Inhalte werten.", 1));

  const lang = p.root.querySelector("html")?.getAttribute("lang");
  out.push(check("seo", "lang", "Sprache der Seite", lang ? "ok" : "warn", lang || "nicht angegeben", lang ? "Die Sprache ist für Suchmaschinen und Screenreader angegeben." : "Die Sprachangabe (lang) fehlt.", 0.5));

  const words = p.text ? p.text.split(" ").length : 0;
  out.push(check("seo", "words", "Textumfang der Startseite", words >= 400 ? "ok" : words >= 200 ? "warn" : "bad", `${fmt(words)} Wörter`, words >= 400 ? "Genug Text, damit Google die Leistungen versteht." : "Wenig Text – Google hat kaum Anhaltspunkte, wofür die Seite gefunden werden soll.", 1.5));

  const og = Boolean(meta(p, "og:title") || meta(p, "og:image"));
  out.push(check("seo", "og", "Vorschau für soziale Medien", og ? "ok" : "warn", og ? "vorhanden" : "fehlt", og ? "Geteilte Links zeigen Titel und Bild." : "Ohne Open-Graph-Tags sehen geteilte Links in WhatsApp, LinkedIn oder Facebook unattraktiv aus.", 0.5));

  const internal = p.root.querySelectorAll("a[href]").filter((a) => {
    try {
      return new URL(a.getAttribute("href")!, p.url).host === p.url.host;
    } catch {
      return false;
    }
  }).length;
  out.push(check("seo", "links", "Interne Verlinkung", internal >= 8 ? "ok" : internal >= 3 ? "warn" : "bad", `${internal} Links`, internal >= 8 ? "Unterseiten sind gut verlinkt." : "Wenige interne Links – Google findet Unterseiten schlechter.", 1));
  return out;
}

/* ---------------------------------------------------------- google visibility */

export async function googleChecks(p: Parsed): Promise<{ checks: Check[]; sitemapUrls: number }> {
  const out: Check[] = [];
  const robotsMeta = `${meta(p, "robots")} ${meta(p, "googlebot")} ${p.fetched.headers.get("x-robots-tag") ?? ""}`.toLowerCase();
  const noindex = robotsMeta.includes("noindex");
  const robots = await probe(`${p.url.origin}/robots.txt`, 8000);
  const robotsTxt = robots.status === 200 && !/<html/i.test(robots.body) ? robots.body : "";
  const blocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*(\n|$)/i.test(robotsTxt) && !/allow:\s*\/\s*(\n|$)/i.test(robotsTxt);
  out.push(check("google", "indexable", "Für Google freigegeben", noindex || blocksAll ? "bad" : "ok", noindex ? "noindex gesetzt" : blocksAll ? "robots.txt sperrt alles" : "ja", noindex || blocksAll ? "Die Seite ist für Google gesperrt und erscheint nicht in den Suchergebnissen." : "Google darf die Seite aufnehmen.", 4));
  out.push(check("google", "robots", "robots.txt", robotsTxt ? "ok" : "warn", robotsTxt ? "vorhanden" : "fehlt", robotsTxt ? "Suchmaschinen finden Hinweise zum Durchsuchen der Website." : "Eine robots.txt mit Verweis auf die Sitemap hilft Google beim Erfassen.", 0.5));

  let sitemapUrls = 0;
  const candidates = [...(robotsTxt.match(/^sitemap:\s*(\S+)/gim) ?? []).map((l) => l.replace(/^sitemap:\s*/i, "")), `${p.url.origin}/sitemap.xml`, `${p.url.origin}/sitemap_index.xml`, `${p.url.origin}/wp-sitemap.xml`];
  let found = "";
  for (const c of [...new Set(candidates)].slice(0, 4)) {
    const s = await probe(c, 8000);
    if (s.status === 200 && /<(urlset|sitemapindex)/i.test(s.body)) {
      found = c;
      sitemapUrls = (s.body.match(/<loc>/gi) ?? []).length;
      break;
    }
  }
  out.push(check("google", "sitemap", "XML-Sitemap", found ? "ok" : "bad", found ? (sitemapUrls ? `${fmt(sitemapUrls)} Einträge` : "vorhanden") : "nicht gefunden", found ? "Google bekommt eine Liste aller Seiten." : "Ohne Sitemap entdeckt Google neue Seiten langsamer – sie gehört in die Google Search Console.", 2));

  const ld = p.root
    .querySelectorAll('script[type="application/ld+json"]')
    .map((s) => s.textContent)
    .join(" ");
  const types = [...new Set((ld.match(/"@type"\s*:\s*"([^"]+)"/g) ?? []).map((t) => t.replace(/.*"([^"]+)"$/, "$1")))];
  const business = types.some((t) => /LocalBusiness|Organization|Store|Restaurant|Dentist|Attorney|Hotel|Service|Corporation|ProfessionalService|AutoRepair|HomeAndConstructionBusiness/i.test(t));
  out.push(check("google", "schema", "Firmendaten für Google (Schema.org)", business ? "ok" : types.length ? "warn" : "bad", types.length ? types.slice(0, 3).join(", ") : "keine", business ? "Google erhält Firmenname, Adresse und Kontakt in maschinenlesbarer Form." : "Strukturierte Firmendaten (LocalBusiness) verbessern die Darstellung in Google und Google Maps.", 2));

  const text = p.text;
  const phone = /(\+41|0041|\b0)\s?\(?\d{2}\)?[\s.]?\d{3}[\s.]?\d{2}[\s.]?\d{2}\b/.test(text) || p.root.querySelector('a[href^="tel:"]') !== null;
  const address = /\b[1-9]\d{3}\s+[A-ZÄÖÜ][a-zäöüé]+/.test(text);
  out.push(check("google", "nap", "Adresse und Telefon auf der Seite", phone && address ? "ok" : phone || address ? "warn" : "bad", [phone && "Telefon", address && "Adresse"].filter(Boolean).join(" + ") || "nicht gefunden", phone && address ? "Einheitliche Kontaktdaten stärken die lokale Sichtbarkeit in Google." : "Adresse und Telefonnummer sollten gut lesbar auf der Seite stehen – wichtig für lokale Suchen.", 1.5));

  const maps = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page\//i.test(p.html);
  out.push(check("google", "maps", "Verbindung zu Google Maps", maps ? "ok" : "warn", maps ? "verlinkt" : "nicht gefunden", maps ? "Die Website verweist auf Ihren Google-Eintrag." : "Ein Link oder eine Karte zum Google-Unternehmensprofil hilft Kunden und der lokalen Suche.", 1));

  const ga = /gtag\(|googletagmanager\.com|google-analytics\.com|G-[A-Z0-9]{6,}/.test(p.html);
  out.push(check("google", "analytics", "Besucher-Messung", ga ? "ok" : "warn", ga ? "Google Analytics / Tag Manager" : "nicht gefunden", ga ? "Sie können messen, woher Besucher kommen." : "Ohne Messung wissen Sie nicht, welche Massnahmen Kunden bringen.", 1));
  const verify = Boolean(meta(p, "google-site-verification"));
  if (verify) out.push(check("google", "gsc", "Google Search Console", "ok", "bestätigt", "Die Website ist mit der Search Console verbunden.", 0.5));
  return { checks: out, sitemapUrls };
}

/* ------------------------------------------------------------------- mobile */

export function mobileChecks(p: Parsed): Check[] {
  const out: Check[] = [];
  const vp = p.root.querySelector('meta[name="viewport" i]')?.getAttribute("content") ?? "";
  const good = /width\s*=\s*device-width/i.test(vp);
  out.push(check("mobile", "viewport", "Für Smartphones eingerichtet", good ? "ok" : "bad", good ? "Viewport gesetzt" : "Viewport fehlt", good ? "Die Seite passt sich der Bildschirmbreite an." : "Ohne Viewport-Angabe zeigen Handys eine verkleinerte Desktop-Seite – Google wertet das stark ab.", 4));
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp)) out.push(check("mobile", "zoom", "Zoomen erlaubt", "warn", "gesperrt", "Besucher können nicht zoomen – das erschwert das Lesen.", 0.5));
  const srcset = p.root.querySelectorAll("img[srcset], picture source").length;
  const imgs = p.root.querySelectorAll("img").length;
  out.push(check("mobile", "images", "Bilder in passender Grösse", imgs === 0 || srcset >= Math.min(3, imgs) ? "ok" : srcset > 0 ? "warn" : "warn", imgs ? `${srcset} von ${imgs} responsiv` : "keine Bilder", "Responsive Bilder (srcset) laden auf dem Handy kleinere Dateien.", 1));
  const media = (p.html.match(/@media[^{]*\((max|min)-width/gi) ?? []).length;
  const linkedCss = p.root.querySelectorAll('link[rel="stylesheet" i]').length;
  out.push(check("mobile", "responsive", "Anpassung an Bildschirmgrössen", media > 0 || linkedCss > 0 ? (media > 0 || good ? "ok" : "warn") : "warn", media ? `${media} Breakpoints im HTML` : linkedCss ? "über Stylesheets" : "unklar", "Layouts sollten sich an Handy, Tablet und Desktop anpassen.", 1));
  const tel = p.root.querySelector('a[href^="tel:"]') !== null;
  out.push(check("mobile", "tap-call", "Anrufen per Fingertipp", tel ? "ok" : "warn", tel ? "Telefon-Link vorhanden" : "fehlt", tel ? "Handy-Nutzer können direkt anrufen." : "Ein tel:-Link macht die Telefonnummer auf dem Handy antippbar.", 1));
  return out;
}

/* -------------------------------------------------------------- speed (local) */

export function speedChecks(p: Parsed): Check[] {
  const out: Check[] = [];
  const head = p.root.querySelector("head");
  const blocking = (head?.querySelectorAll("script[src]") ?? []).filter((s) => !s.hasAttribute("async") && !s.hasAttribute("defer") && s.getAttribute("type") !== "module").length;
  out.push(check("speed", "blocking", "Blockierende Skripte im Kopfbereich", blocking === 0 ? "ok" : blocking <= 3 ? "warn" : "bad", `${blocking}`, blocking === 0 ? "Skripte bremsen den Seitenaufbau nicht." : "Skripte ohne async/defer verzögern, bis Besucher etwas sehen.", 1.5));
  const scripts = p.root.querySelectorAll("script[src]").length;
  const css = p.root.querySelectorAll('link[rel="stylesheet" i]').length;
  const files = scripts + css;
  out.push(check("speed", "requests", "Anzahl Skript- und CSS-Dateien", files <= 15 ? "ok" : files <= 35 ? "warn" : "bad", `${files} Dateien`, files <= 15 ? "Die Seite lädt wenige Zusatzdateien." : "Viele einzelne Dateien verlangsamen den Seitenaufbau – sie lassen sich meist zusammenfassen.", 1));
  const imgs = p.root.querySelectorAll("img");
  const lazy = imgs.filter((i) => i.getAttribute("loading") === "lazy" || i.hasAttribute("data-src") || i.hasAttribute("data-lazy-src")).length;
  out.push(check("speed", "lazy", "Bilder werden bei Bedarf geladen", imgs.length <= 3 || lazy >= imgs.length / 2 ? "ok" : lazy > 0 ? "warn" : "bad", imgs.length ? `${lazy} von ${imgs.length}` : "keine Bilder", "Lazy Loading lädt Bilder erst, wenn sie ins Bild kommen.", 1));
  const modern = (p.html.match(/\.(webp|avif)\b/gi) ?? []).length;
  const old = (p.html.match(/\.(jpe?g|png)\b/gi) ?? []).length;
  out.push(check("speed", "formats", "Moderne Bildformate", old === 0 || modern >= old ? "ok" : modern > 0 ? "warn" : "bad", modern || old ? `${modern} WebP/AVIF, ${old} JPG/PNG` : "keine Bilder", "WebP und AVIF sind bei gleicher Qualität bis zu 70 % kleiner als JPG/PNG.", 1));
  return out;
}

/* ------------------------------------------------------------------ content */

export function contentChecks(p: Parsed): Check[] {
  const out: Check[] = [];
  const t = p.text.toLowerCase();
  const form = p.root.querySelector("form") !== null && !/search|suche/i.test(p.root.querySelector("form")?.getAttribute("role") ?? "");
  const mail = p.root.querySelector('a[href^="mailto:"]') !== null;
  const tel = p.root.querySelector('a[href^="tel:"]') !== null;
  const ways = [form && "Formular", tel && "Telefon", mail && "E-Mail"].filter(Boolean) as string[];
  out.push(check("content", "contact", "Kontaktmöglichkeiten", ways.length >= 2 ? "ok" : ways.length === 1 ? "warn" : "bad", ways.join(", ") || "keine gefunden", ways.length >= 2 ? "Interessenten können Sie auf mehreren Wegen erreichen." : "Mehr Kontaktwege (Formular, Telefon, E-Mail) bringen mehr Anfragen.", 2));
  const ctaWords = /(kontakt|offerte|anfrage|anfragen|termin|buchen|beratung|jetzt|bestellen|kaufen|reservieren|angebot)/i;
  const ctas = p.root.querySelectorAll("a, button").filter((a) => ctaWords.test(clean(a.textContent)) && clean(a.textContent).length < 40).length;
  out.push(check("content", "cta", "Klare Handlungsaufrufe", ctas >= 3 ? "ok" : ctas >= 1 ? "warn" : "bad", `${ctas} gefunden`, ctas >= 3 ? "Besucher werden zum nächsten Schritt geführt." : "Deutliche Knöpfe wie «Offerte anfragen» oder «Termin buchen» erhöhen die Anfragen.", 1.5));
  const impressum = /impressum/.test(t) || p.root.querySelector('a[href*="impressum" i]') !== null;
  const privacy = /datenschutz|privacy/.test(t) || p.root.querySelector('a[href*="datenschutz" i], a[href*="privacy" i]') !== null;
  out.push(check("content", "legal", "Impressum und Datenschutzerklärung", impressum && privacy ? "ok" : "bad", impressum && privacy ? "beide verlinkt" : !impressum && !privacy ? "beide fehlen" : !impressum ? "Impressum fehlt" : "Datenschutzerklärung fehlt", impressum && privacy ? "Die rechtlich nötigen Angaben sind verlinkt." : "In der Schweiz (revDSG) und für EU-Besucher sind Impressum und Datenschutzerklärung Pflicht.", 2));
  const social = ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "youtube.com", "x.com/", "twitter.com"].filter((s) => p.html.includes(s));
  out.push(check("content", "social", "Verbindung zu sozialen Medien", social.length >= 1 ? "ok" : "warn", social.length ? social.map((s) => s.replace(/\.com\/?|\//g, "")).join(", ") : "keine", social.length ? "Besucher finden Ihre Kanäle." : "Links zu Ihren Social-Media-Profilen schaffen Vertrauen.", 0.5));
  const years = [...p.text.matchAll(/(?:©|copyright|\(c\))\s*(?:\d{4}\s*[–-]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const now = new Date().getFullYear();
  if (years.length) {
    const y = Math.max(...years);
    out.push(check("content", "fresh", "Aktualität", y >= now - 1 ? "ok" : "warn", `© ${y}`, y >= now - 1 ? "Die Website wirkt gepflegt." : "Ein veraltetes Jahr in der Fusszeile lässt die Website ungepflegt wirken.", 0.5));
  }
  const reviews = /bewertung|rezension|kundenstimme|testimonial|google-bewertung|sterne|★/i.test(p.text);
  out.push(check("content", "trust", "Vertrauenselemente (Bewertungen, Referenzen)", reviews ? "ok" : "warn", reviews ? "vorhanden" : "nicht gefunden", reviews ? "Bewertungen und Referenzen überzeugen Neukunden." : "Kundenstimmen oder Google-Bewertungen auf der Website erhöhen das Vertrauen deutlich.", 1));
  return out;
}

/* ------------------------------------------------------------------ design */

/**
 * What the code reveals about the design. The visual judgement (modern or
 * dated, hierarchy, images) comes from the AI review of the screenshots.
 */
export async function designChecks(p: Parsed): Promise<Check[]> {
  const out: Check[] = [];
  const h = p.html;
  const fontRe = /fonts\.googleapis|fonts\.bunny|use\.typekit|@font-face|\.woff2?["')?]/i;
  let fonts = fontRe.test(h);
  if (!fonts) {
    // fonts are often declared in the stylesheet, not in the HTML
    const sheets = p.root
      .querySelectorAll('link[rel~="stylesheet" i]')
      .map((l) => abs(p, l.getAttribute("href")))
      .filter(Boolean)
      .slice(0, 3);
    for (const css of await Promise.all(sheets.map((u) => probe(u, 6000)))) if (fontRe.test(css.body)) fonts = true;
  }
  out.push(
    check("design", "fonts", "Eigene Schriften", fonts ? "ok" : "warn", fonts ? "Webschriften geladen" : "nur Standardschriften", fonts ? "Die Website nutzt eigene Schriften für einen eigenständigen Auftritt." : "Mit Standardschriften wie Arial wirkt die Website austauschbar.", 1.5),
  );
  // only DIY site builders count – WordPress page builders (Elementor & Co.) are a professional tool we use too
  const builder = /static\.wixstatic|_wixCIDX|wix-image/i.test(h) ? "Wix" : /jimdo(?:cdn|content|static)|\.jimdo\.com/i.test(h) ? "Jimdo" : /static1\.squarespace|squarespace-cdn/i.test(h) ? "Squarespace" : /webnode\.(?:page|com)\/|wnd-/i.test(h) ? "Webnode" : /editmysite|weebly\.com/i.test(h) ? "Weebly" : /img1\.wsimg/i.test(h) ? "GoDaddy" : "";
  out.push(
    check(
      "design",
      "template",
      "Individuelles Design",
      builder ? "warn" : "ok",
      builder ? `Baukasten: ${builder}` : "kein Baukasten erkannt",
      builder ? `Mit ${builder} gebaute Seiten ähneln sich oft und laden viel überflüssigen Code.` : "Es wurde kein typischer Seitenbaukasten erkannt.",
      1.5,
    ),
  );
  const legacy = [
    /<font[\s>]/i.test(h) && "<font>",
    /<center>/i.test(h) && "<center>",
    /<marquee/i.test(h) && "Lauftext",
    /<frameset|<frame\s/i.test(h) && "Frames",
    (h.match(/<table[^>]+(?:width|bgcolor|cellpadding)=/gi) ?? []).length >= 2 && "Tabellen-Layout",
    /jquery[-.]1\.\d|jquery\/1\.\d/i.test(h) && "jQuery 1",
    /bootstrap(?:\.min)?\.css\?ver=3|bootstrap\/3\.\d/i.test(h) && "Bootstrap 3",
  ].filter(Boolean) as string[];
  out.push(
    check(
      "design",
      "legacy",
      "Zeitgemässe Technik im Layout",
      legacy.length >= 2 ? "bad" : legacy.length ? "warn" : "ok",
      legacy.length ? legacy.join(", ") : "nichts Veraltetes gefunden",
      legacy.length ? "Veraltete Bausteine deuten auf ein älteres Layout hin – das sehen Besucher oft auf den ersten Blick." : "Im Code stecken keine veralteten Layout-Bausteine.",
      2,
    ),
  );
  const touch = p.root.querySelector('link[rel~="apple-touch-icon" i]') !== null;
  out.push(check("design", "touch-icon", "App-Symbol für Smartphones", touch ? "ok" : "warn", touch ? "vorhanden" : "fehlt", touch ? "Auf dem Startbildschirm erscheint Ihr Logo." : "Speichert jemand Ihre Seite auf dem Handy, erscheint kein Logo, sondern ein Platzhalter.", 0.5));
  const motion = /@keyframes|transition\s*:|data-aos|gsap|framer-motion|lottie/i.test(h);
  out.push(check("design", "motion", "Bewegung und Interaktion", motion ? "ok" : "warn", motion ? "vorhanden" : "keine gefunden", motion ? "Dezente Animationen machen die Seite lebendig." : "Ohne dezente Bewegung (Übergänge, Hover-Effekte) wirkt eine Seite schnell statisch.", 0.5));
  return out;
}
