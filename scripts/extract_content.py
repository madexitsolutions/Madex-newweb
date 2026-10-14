#!/usr/bin/env python3
"""Extract structured content from the archived madex-it.ch snapshot.

Reads archive/pages/** and writes typed JSON into src/content/generated/.
Also writes a media manifest (scripts/media-manifest.json) listing every
upload path the new site needs; scripts/prepare_media.py converts them.

Run:  python3 -I scripts/extract_content.py
"""
from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "archive" / "pages"
OUT = ROOT / "src" / "content" / "generated"
UPLOAD_RE = re.compile(r"https?://madex-it\.ch/wp-content/uploads/([^\"'\s)]+)")
SIZE_SUFFIX = re.compile(r"-(\d+)x(\d+)(\.\w+)$")

media: set[str] = set()


def original_upload(path: str) -> str:
    """Strip WordPress size suffix (-1024x768) if the original exists locally."""
    path = path.split("?")[0]
    m = SIZE_SUFFIX.search(path)
    if m:
        cand = path[: m.start()] + m.group(3)
        if (ROOT / "assets" / "all" / cand).exists():
            return cand
    return path


def use(path: str) -> str:
    p = original_upload(path)
    if (ROOT / "assets" / "all" / p).exists():
        media.add(p)
        return p
    return ""


def ss(text: str) -> str:
    """Swiss German orthography: no Eszett."""
    return text.replace("ß", "ss").replace("ẞ", "SS")


def clean(text: str) -> str:
    text = html.unescape(text)
    text = text.replace(" ", " ").replace("﻿", "")
    text = re.sub(r"\s+", " ", text).strip()
    return ss(text)


def slugify(text: str) -> str:
    text = text.replace("‑", "-")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text


class Blocks(HTMLParser):
    """Collect headings, paragraphs, list items and images in order."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[dict] = []
        self.cur: dict | None = None
        self.depth_skip = 0
        self.links: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("script", "style", "svg", "noscript"):
            self.depth_skip += 1
            return
        if self.depth_skip:
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.flush()
            self.cur = {"type": "h", "level": int(tag[1]), "text": ""}
        elif tag == "p":
            self.flush()
            self.cur = {"type": "p", "text": ""}
        elif tag == "li":
            self.flush()
            self.cur = {"type": "li", "text": ""}
        elif tag == "br" and self.cur is not None:
            self.cur["text"] += "\n"
        elif tag == "img":
            src = a.get("src") or ""
            m = UPLOAD_RE.search(src)
            if m:
                p = use(m.group(1))
                if p:
                    self.flush()
                    self.blocks.append({"type": "img", "src": p, "alt": clean(a.get("alt") or "")})
        elif tag == "a":
            href = a.get("href") or ""
            if href.startswith("http") and "madex-it.ch" not in href:
                self.links.append(href)
                if self.cur is not None:
                    self.cur.setdefault("links", []).append(href)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg", "noscript"):
            self.depth_skip = max(0, self.depth_skip - 1)
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6", "p", "li"):
            self.flush()

    def handle_data(self, data):
        if self.depth_skip or self.cur is None:
            return
        self.cur["text"] += data

    def flush(self):
        if self.cur is not None:
            t = "\n".join(clean(x) for x in self.cur["text"].split("\n"))
            t = t.strip()
            if t:
                self.cur["text"] = t
                self.blocks.append(self.cur)
        self.cur = None


def meta(s: str, prop: str) -> str:
    m = re.search(r'<meta (?:property|name)="%s" content="([^"]*)"' % re.escape(prop), s)
    return clean(m.group(1)) if m else ""


# Post slugs that were copy/paste errors on the old site get a clean slug.
SLUG_FIX = {
    "neues-branding-und-moderne-website-fur-klimas-innenausbau-copy-copy": "garage-t-schneider-neuer-digitaler-auftritt",
    "neues-branding-und-moderne-website-fur-klimas-innenausbau-copy": "natura-balance-schweiz-moderne-webpraesenz-fur-naturliche-kosmetik",
}


def fix_title(t: str) -> str:
    t = t.replace("Webpraesenz", "Webpräsenz").replace("Praesenz", "Präsenz").replace("\u2011", "-")
    t = t.replace("FahrzeugreparaturenCarrosserie Stocker AG", "Fahrzeugreparaturen")
    t = t.replace("Kundenorientierter", "kundenorientierter")
    return t


CLIENT_PATTERNS = [
    r"^(.+?) jetzt online.*$",
    r"^Die neue (?:Online-Plattform|Website) (?:für|von) (?:den Verein |den |die |das )?(.+?)(?:\s+[–-]\s+.*)?$",
    r"^Die neue Website unseres Kunden (.+?) ist veröffentlicht$",
    r"^Wir haben die neue Website für (.+?) (?:gestaltet|entwickelt|realisiert|erstellt).*$",
    r"^Wir präsentieren Ihnen die neue Website für unseren Kunden (.+)$",
    r"^Madex IT Solutions hat die neue Website für (.+?) gestaltet.*$",
    r"^Neues Branding und moderne Website für (.+)$",
    r"^Neue Website für (.+)$",
    r"^Starke Webplattform für (.+?)(?:\s+[–-]\s+.*)?$",
    r"^Ein neuer digitaler Auftritt für (.+)$",
    r"^.*die neue Website für (.+)$",
]


def client_name(t: str) -> str:
    for pat in CLIENT_PATTERNS:
        m = re.match(pat, t)
        if m:
            return m.group(1).strip()
    return re.split(r"\s+[–:-]\s+", t)[0].strip()


def extract_post(path: Path) -> dict | None:
    s = path.read_text(encoding="utf-8")
    canon = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    url = canon.group(1) if canon else ""
    old_slug = url.rstrip("/").rsplit("/", 1)[-1]
    from urllib.parse import unquote

    old_slug = unquote(old_slug)
    title = re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S)
    title_txt = clean(re.sub("<[^>]+>", "", title.group(1))) if title else meta(s, "og:title")
    start = s.find("theme-post-content")
    end_markers = [s.find(m, start) for m in ("Sind Sie bereit, Ihr Unternehmen", "elementor-widget-post-info", "Was als nächstes zu lesen ist")]
    end_markers = [e for e in end_markers if e > start]
    end = min(end_markers) if end_markers else start + 60000
    body = s[start:end]
    p = Blocks()
    p.feed(body)
    p.flush()
    blocks = [b for b in p.blocks if not (b["type"] == "p" and b["text"].startswith("Sind Sie bereit"))]
    # featured image: first image inside the post body (the theme widget
    # on the old site showed the latest post, not this one)
    fi = ""
    for b in blocks:
        if b["type"] == "img":
            fi = b["src"]
            break
    cats = re.findall(r'href="https://madex-it\.ch/category/([^/"]+)/"', s[start - 20000 : start])
    category = "blog" if "blog" in cats else "website-portfolio"
    tags = sorted(set(re.findall(r'href="https://madex-it\.ch/tag/([^/"]+)/"', s)))
    date = meta(s, "article:published_time")[:10]
    desc = meta(s, "description")
    external = ""
    for l in p.links:
        if "facebook" in l or "instagram" in l or "google" in l:
            continue
        external = l
        break
    slug = SLUG_FIX.get(old_slug, slugify(old_slug))
    title_txt = fix_title(title_txt)
    return {
        "client": client_name(title_txt),
        "slug": slug,
        "legacySlug": old_slug,
        "title": title_txt,
        "date": date,
        "category": category,
        "tags": tags,
        "description": desc,
        "image": fi,
        "external": external,
        "blocks": blocks,
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    posts: dict[str, dict] = {}
    for f in sorted((ARCHIVE / "post").glob("*.html")):
        post = extract_post(f)
        if not post:
            continue
        if post["slug"] in posts:
            continue
        posts[post["slug"]] = post
    # Curated portfolio mockups (see research/sources.md) become card covers.
    covers = {
        "auto-pozzo": "2026/04/autopozzo.png",
        "tkc-ag-starke": "2026/04/tkc.png",
        "mehoma": "2026/04/mehoma.png",
        "serrano-reinigung": "2026/04/serrano-2.png",
        "mila-dopiz": "2026/04/miladopiz.png",
        "carrosserie-stocker-ag-digitale": "2026/04/csh.png",
        "baur-ag": "2026/04/baurag.png",
        "garage-t-schneider": "2026/04/garage-mockup.png",
        "natura-balance": "2025/10/natura-balance-web-mockup.png",
        "klimas-innenausbau": "2025/08/g1.png",
        "polyprojekt": "2025/07/polyprojekt.gif",
        "sun-foiltec": "2025/07/3e2.png",
        "warum-webdesign": "2024/08/138060.jpg",
        "grafikdesign-und-die-wirkung": "2024/09/2149119231.jpg",
    }
    for post in posts.values():
        for key, cover in covers.items():
            if key in post["slug"] and use(cover):
                post["cover"] = cover
                break
        else:
            post["cover"] = post["image"]
    plist = sorted(posts.values(), key=lambda p: p["date"], reverse=True)
    (OUT / "posts.json").write_text(json.dumps(plist, ensure_ascii=False, indent=1), encoding="utf-8")

    # Graphic design portfolio sections
    s = (ARCHIVE / "page" / "008-graphic-design-portfolio.html").read_text(encoding="utf-8")
    parts = re.split(r"<h1[^>]*>", s)
    gd = {}
    for part in parts[1:]:
        title = clean(re.sub("<[^>]+>", "", part[: part.find("</h1>")]))
        links = re.findall(r'href="https://madex-it\.ch/wp-content/uploads/([^"]+)"', part)
        seen = []
        for l in links:
            p = use(l)
            if p and p not in seen:
                seen.append(p)
        if seen:
            key = {"Brandings": "branding", "Print": "print", "Social Media": "social"}.get(title, slugify(title))
            gd[key] = seen
    (OUT / "graphic-portfolio.json").write_text(json.dumps(gd, ensure_ascii=False, indent=1), encoding="utf-8")

    # Advertising videos (YouTube IDs)
    s = (ARCHIVE / "page" / "026-werbevideos-portfolio.html").read_text(encoding="utf-8")
    ids = []
    for m in re.finditer(r"(?:watch\?v=|youtu\.be\\?/)([A-Za-z0-9_-]{11})", s):
        if m.group(1) not in ids:
            ids.append(m.group(1))
    (OUT / "videos.json").write_text(json.dumps(ids, indent=1), encoding="utf-8")

    # Partner logos (home carousel) + partner page links/logos
    s = (ARCHIVE / "page" / "003-home.html").read_text(encoding="utf-8")
    car = s[s.find("elementor-image-carousel") :]
    car = car[: car.find("</div></div></div>") + 20] if "</div></div></div>" in car else car[:40000]
    logos = []
    for m in re.finditer(r'class="swiper-slide-image" src="https://madex-it\.ch/wp-content/uploads/([^"]+)" alt="([^"]*)"', s):
        p = use(m.group(1))
        if p and p not in logos:
            logos.append(p)
    s2 = (ARCHIVE / "page" / "022-partners.html").read_text(encoding="utf-8")
    links = []
    for m in re.finditer(r'<a [^>]*href="(https?://(?!madex-it\.ch)[^"]+)"', s2):
        h = html.unescape(m.group(1))
        if any(x in h for x in ("madexitsolutions", "madex.it", "madex-it-solutions", "UCn77TYdj9", "g.page")):
            continue
        if h not in links:
            links.append(h)
    (OUT / "partners.json").write_text(json.dumps({"logos": logos, "links": links}, ensure_ascii=False, indent=1), encoding="utf-8")

    # Legal pages (rendered as-is from the current site)
    legal = {}
    for key, fname in (("agb", "004-agb.html"), ("datenschutz", "007-datenschutz.html")):
        s = (ARCHIVE / "page" / fname).read_text(encoding="utf-8")
        start = s.find('data-elementor-type="wp-page"')
        end = s.find('elementor-location-footer', start)
        bp = Blocks()
        bp.feed(s[start:end])
        bp.flush()
        legal[key] = [b for b in bp.blocks if b["type"] != "img"]
    (OUT / "legal.json").write_text(json.dumps(legal, ensure_ascii=False, indent=1), encoding="utf-8")

    # Static images used by page templates
    static = [
        "2024/04/box-3.png", "2025/10/box-1.1.png", "2024/04/box-2.png",
        "2026/10/edited-9403.png", "2026/10/edited-94742.jpg", "2026/10/edited-9489.png", "2026/10/edited-9518.png",
        "2024/08/3.jpg", "2023/05/te.png", "2024/07/2d.jpg",
        "2024/08/sc-detheme2.jpg", "2024/08/sc-detheme1.jpg", "2024/08/sc-detheme3.jpg",
        "2024/08/7.jpg", "2024/08/b21.png", "2024/08/133664.jpg", "2024/08/138060.jpg", "2024/08/ch.jpg",
        "2025/02/1060723_OLS73W0.jpg", "2024/09/8488.jpg", "2024/09/90387.jpg", "2024/09/121464.jpg",
        "2024/09/2150040193.jpg", "2024/09/71201.jpg", "2024/09/348.jpg",
        "2024/09/32.jpg", "2024/09/49854.jpg", "2024/09/41072.jpg", "2024/09/934.jpg",
        "2024/09/Types-of-Google-Ads-3.jpg", "2024/09/keywords-google-my-business.jpg", "2024/09/322.jpg",
        "2024/09/f32.jpg", "2024/09/2149119231.jpg", "2024/09/132214.jpg",
        "2024/07/Bram-Marco-0458-1024x683-1.jpg", "2024/07/madex_staf-7-scaled-1.jpg",
        "2024/07/graphicdesign-madex.jpg", "2024/07/Bram-Marco-0486.jpg",
        "2024/07/madex-0010.jpg", "2024/07/madex-0013.jpg", "2024/07/madex-0014.jpg", "2026/01/designer.jpg",
        "2025/05/staff-eegt_1133.jpg", "2024/07/dev2.jpg", "2024/07/dev3.jpg", "2026/01/web-2.jpg",
        "2024/07/soc-1.jpg", "2024/09/staff-smm-1.jpg", "2026/01/video-s.jpg", "2024/07/1d.jpg", "2024/07/3d.jpg",
        "2023/05/google-cloud.svg", "2023/05/google-partner.svg", "2023/05/meta-partner.svg",
        "2024/04/wordpress.png", "2024/04/elementor.png", "2023/06/g3-1.png",
        "2026/10/Madex-It-Solutions-011026.mp4", "2026/10/Madex-VIDEO-1.mp4",
        "2023/05/happy-carefree-dark-skinned-rebellious-young-woman-enjoys-awesome-music-makes-rock-n-roll-gesture-has-fun-on-music-festival-or-cool-event-wears-casual-jumper-poses-against-pink-wall.jpg",
        "2023/05/pexels-andrea-piacquadio-3799837.jpg", "2023/05/pexels-mikhail-nilov-9301512.jpg",
    ]
    missing = []
    for p in static:
        if not use(p):
            missing.append(p)
    (ROOT / "scripts" / "media-manifest.json").write_text(json.dumps(sorted(media), indent=1), encoding="utf-8")
    print(f"posts={len(plist)} media={len(media)} missing_static={missing}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
