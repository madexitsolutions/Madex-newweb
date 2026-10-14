#!/usr/bin/env python3
"""Create optimised web derivatives of every image the new site uses.

Originals in assets/ stay untouched. Output goes to public/media/:
  - raster images -> WebP (max width depends on usage), alpha preserved
  - SVG           -> copied
  - GIF           -> looping MP4 + WebP poster (via ffmpeg)
  - MP4           -> 720p H.264 re-encode + WebP poster (via ffmpeg)

Run after scripts/extract_content.py:
  python3 -I scripts/prepare_media.py
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "all"
OUT = ROOT / "public" / "media"

# Narrower targets for grid-only imagery keeps the payload small.
NARROW = ("2025/01/", "2025/02/", "2025/05/", "2026/10/Artboard", "2024/09/roth", "2024/09/sanad")


def max_width(rel: str) -> int:
    if "Artboard" in rel or rel.endswith(("logo-1.png", "matter1.png")):
        return 320
    if rel.startswith(NARROW):
        return 900
    return 1800


def out_path(rel: str, ext: str) -> Path:
    p = OUT / rel
    return p.with_suffix(ext)


def convert_image(rel: str) -> None:
    dst = out_path(rel, ".webp")
    if dst.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(SRC / rel) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("P", "LA", "L") and "transparency" in im.info:
            im = im.convert("RGBA")
        elif im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        if "Artboard" in rel and im.mode == "RGBA":
            # logos sit small inside a large transparent canvas – trim it
            box = im.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
            if box:
                pad = round(max(box[2] - box[0], box[3] - box[1]) * 0.06)
                im = im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
        w = max_width(rel)
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(dst, "WEBP", quality=80, method=5)


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def convert_video(rel: str) -> None:
    dst = out_path(rel, ".mp4")
    poster = out_path(rel, ".webp")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src = str(SRC / rel)
    if not dst.exists():
        ffmpeg("-i", src, "-vf", "scale='min(720,iw)':-2", "-c:v", "libx264", "-preset", "slow",
               "-crf", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(dst))
    if not poster.exists() and rel.endswith(".gif"):
        with Image.open(src) as im:
            im.seek(0)
            frame = im.convert("RGB")
            if frame.width > 1800:
                frame = frame.resize((1800, round(frame.height * 1800 / frame.width)), Image.LANCZOS)
            frame.save(poster, "WEBP", quality=80)
    if not poster.exists():
        tmp = poster.with_suffix(".png")
        ffmpeg("-ss", "1", "-i", src, "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", str(tmp))
        with Image.open(tmp) as im:
            im.convert("RGB").save(poster, "WEBP", quality=78)
        tmp.unlink()


def main() -> int:
    manifest = json.loads((ROOT / "scripts" / "media-manifest.json").read_text())
    # Curated brand assets from the kit root.
    OUT.mkdir(parents=True, exist_ok=True)
    brand = OUT / "brand"
    brand.mkdir(exist_ok=True)
    for name in ("business-logo.png", "business-favicon.png", "brand-mascot.png", "brand-lightbulb.png",
                 "business-cover.jpg", "brand-team-banner.jpg"):
        dst = brand / (Path(name).stem + ".webp")
        if not dst.exists():
            with Image.open(ROOT / "assets" / name) as im:
                im = im.convert("RGBA") if im.mode in ("P", "RGBA", "LA") else im.convert("RGB")
                if im.width > 2000:
                    im = im.resize((2000, round(im.height * 2000 / im.width)), Image.LANCZOS)
                im.save(dst, "WEBP", quality=82, method=5)
    for name in ("team-marco-bram.jpg", "team-adem-mehmeti.jpg", "team-gazmend-gjerqeku.jpg",
                 "team-sebastian-stein.png", "team-ariane-schmitz.jpg", "team-laura-stein.jpg",
                 "service-website-development.jpg", "service-digital-marketing.jpg", "service-seo-optimization.jpg",
                 "service-photo-advertising-video.jpg", "service-social-media-marketing.jpg",
                 "service-google-marketing.jpg", "service-graphic-design.jpg", "service-analysis-planning.jpg"):
        dst = brand / (Path(name).stem + ".webp")
        if not dst.exists():
            with Image.open(ROOT / "assets" / name) as im:
                im = im.convert("RGB")
                if im.width > 900:
                    im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
                im.save(dst, "WEBP", quality=82, method=5)
    shutil.copy(ROOT / "assets" / "business-favicon.png", ROOT / "src" / "app" / "icon.png")

    for i, rel in enumerate(manifest):
        ext = Path(rel).suffix.lower()
        try:
            if ext == ".svg":
                dst = OUT / rel
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(SRC / rel, dst)
            elif ext == ".gif":
                convert_image(rel)
            elif ext == ".mp4":
                convert_video(rel)
            else:
                convert_image(rel)
        except Exception as exc:  # keep going, report at the end
            print(f"FAILED {rel}: {exc}", file=sys.stderr)
        if i % 100 == 0:
            print(f"{i}/{len(manifest)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
