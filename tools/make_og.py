"""Make the link preview image and the PNG icons from content.yaml.

Writes static/og/og-image.png (1200x630), static/favicon.png (32x32)
and static/apple-touch-icon.png (180x180). Run before build.py:

    .\\.venv\\Scripts\\python.exe tools\\make_og.py
    .\\.venv\\Scripts\\python.exe tools\\make_og.py --monogram   (AB monogram instead of the photo)

The preview image uses hero.photo from content.yaml as a round portrait;
if that file is missing (or --monogram is given) it falls back to the monogram.
The icons always use the monogram.
"""

import re
import sys
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content.yaml"
STATIC = ROOT / "static"

ACCENT = (47, 58, 143)  # #2f3a8f
TEXT = (11, 18, 32)
MUTED = (79, 88, 105)
BORDER = (228, 231, 238)
WHITE = (255, 255, 255)

FONT_DIR = Path("C:/Windows/Fonts")
FONTS = {
    "regular": ["segoeui.ttf", "arial.ttf"],
    "semibold": ["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"],
    "bold": ["segoeuib.ttf", "arialbd.ttf"],
}

SCALE = 2  # draw at 2x, then downsample for smooth edges


def font(weight, size):
    for name in FONTS[weight]:
        path = FONT_DIR / name
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size)


def initials(name):
    words = re.findall(r"[^\W\d_]+", name or "")
    return "".join(word[0] for word in words).upper()[:2]


def display_url(url):
    return re.sub(r"^https?://(www\.)?", "", url or "").rstrip("/")


def wrap(draw, text, face, width):
    """Split text into lines that fit within width."""
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=face) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def monogram(draw, box, letters, radius, size):
    draw.rounded_rectangle(box, radius=radius, fill=ACCENT)
    face = font("semibold", size)
    cx = (box[0] + box[2]) / 2
    cy = (box[1] + box[3]) / 2
    draw.text((cx, cy), letters, font=face, fill=WHITE, anchor="mm")


def portrait(image, draw, center, diameter, photo_path):
    """Paste the photo as a circle inside a white ring with a thin border."""
    s = SCALE
    cx, cy = center
    ring = 10 * s
    outer = diameter // 2 + ring
    draw.ellipse([cx - outer - 2 * s, cy - outer - 2 * s, cx + outer + 2 * s, cy + outer + 2 * s], fill=BORDER)
    draw.ellipse([cx - outer, cy - outer, cx + outer, cy + outer], fill=WHITE)

    with Image.open(photo_path) as source:
        photo = source.convert("RGB")
    side = min(photo.size)
    left = (photo.width - side) // 2
    top = (photo.height - side) // 2
    photo = photo.crop((left, top, left + side, top + side)).resize((diameter, diameter), Image.Resampling.LANCZOS)

    mask = Image.new("L", (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, diameter - 1, diameter - 1], fill=255)
    image.paste(photo, (cx - diameter // 2, cy - diameter // 2), mask)


def og_image(name, title, url, path, photo_path=None):
    s = SCALE
    width, height = 1200 * s, 630 * s
    image = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(image)

    # Faint grid on the right, thin accent bar on the left edge
    for x in range(640 * s, width, 48 * s):
        draw.line([(x, 0), (x, height)], fill=(244, 245, 249), width=s)
    for y in range(0, height, 48 * s):
        draw.line([(640 * s, y), (width, y)], fill=(244, 245, 249), width=s)
    draw.rectangle([0, 0, 12 * s, height], fill=ACCENT)

    left = 96 * s
    text_width = 640 * s

    name_face = font("bold", 76 * s)
    title_face = font("regular", 36 * s)
    url_face = font("semibold", 28 * s)

    y = 150 * s
    for line in wrap(draw, name, name_face, text_width):
        draw.text((left, y), line, font=name_face, fill=TEXT)
        y += 88 * s

    y += 20 * s
    draw.rectangle([left, y, left + 64 * s, y + 4 * s], fill=ACCENT)
    y += 36 * s
    for line in wrap(draw, title, title_face, text_width):
        draw.text((left, y), line, font=title_face, fill=MUTED)
        y += 50 * s

    if url:
        uy = height - 96 * s
        draw.ellipse([left, uy + 12 * s, left + 12 * s, uy + 24 * s], fill=ACCENT)
        draw.text((left + 26 * s, uy), url, font=url_face, fill=ACCENT)

    # Round photo (or monogram card) on the right
    size = 300 * s
    x0 = width - 96 * s - size
    y0 = (height - size) // 2
    if photo_path:
        portrait(image, draw, (x0 + size // 2, y0 + size // 2), 320 * s, photo_path)
    else:
        draw.rounded_rectangle([x0 - 2 * s, y0 - 2 * s, x0 + size + 2 * s, y0 + size + 2 * s],
                               radius=64 * s, fill=BORDER)
        monogram(draw, [x0, y0, x0 + size, y0 + size], initials(name), 62 * s, 132 * s)

    image = image.resize((1200, 630), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def icon(name, size, path, rounded=True):
    big = 512
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = 112 if rounded else 0
    monogram(draw, [0, 0, big - 1, big - 1], initials(name), radius, 236)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    if not rounded:
        image = image.convert("RGB")
    image.save(path, optimize=True)


def main():
    content = yaml.safe_load(CONTENT.read_text(encoding="utf-8"))
    meta = content.get("meta") or {}
    hero = content.get("hero") or {}
    name = hero.get("name") or (content.get("nav") or {}).get("brand") or ""
    title = hero.get("title") or ""
    url = display_url(meta.get("url"))

    og_path = ROOT / (meta.get("og_image") or "static/og/og-image.png")
    photo_path = None
    if "--monogram" not in sys.argv[1:] and hero.get("photo"):
        candidate = ROOT / hero["photo"]
        if candidate.is_file():
            photo_path = candidate
        else:
            print(f"Photo not found ({hero['photo']}), using the monogram")
    og_image(name, title, url, og_path, photo_path)
    icon(name, 32, STATIC / "favicon.png")
    # iOS rounds the corners itself, so the touch icon stays square.
    icon(name, 180, STATIC / "apple-touch-icon.png", rounded=False)

    for path in (og_path, STATIC / "favicon.png", STATIC / "apple-touch-icon.png"):
        print(f"Wrote {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
