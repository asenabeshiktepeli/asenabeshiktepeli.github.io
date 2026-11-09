"""Make smaller copies of the portfolio card images for srcset.

static/img/portfolio/<name>.webp -> static/img/portfolio/<name>-800.webp and <name>-400.webp
Safe to run again: thumbnails are rebuilt from the full-size originals.
The template only lists a size in srcset when its file exists.

    .\\.venv\\Scripts\\python.exe tools\\make_thumbs.py hubspot-support               (800 and 400)
    .\\.venv\\Scripts\\python.exe tools\\make_thumbs.py --width 400 hubspot-support   (only 400)

Pass card image names: without names every .webp in the folder is used,
including the large "-full" lightbox screenshots, which do not need thumbnails.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "static" / "img" / "portfolio"
WIDTHS = (800, 400)
QUALITY = 82


def is_thumbnail(path):
    return any(path.stem.endswith(f"-{w}") for w in WIDTHS)


def main():
    args = sys.argv[1:]
    widths = WIDTHS
    if "--width" in args:
        i = args.index("--width")
        widths = (int(args[i + 1]),)
        del args[i:i + 2]
    # Optional: pass names (e.g. hubspot-support) to rebuild only those thumbnails.
    names = set(args)
    sources = sorted(
        p for p in FOLDER.glob("*.webp")
        if not is_thumbnail(p) and (not names or p.stem in names)
    )
    if not sources:
        print(f"No .webp files in {FOLDER.relative_to(ROOT)}")
        return
    for source in sources:
        with Image.open(source) as image:
            for width in widths:
                target = source.with_name(f"{source.stem}-{width}.webp")
                height = round(image.height * width / image.width)
                small = image.resize((width, height), Image.Resampling.LANCZOS)
                small.save(target, "WEBP", quality=QUALITY, method=6)
                print(f"Wrote {target.relative_to(ROOT)} ({width}x{height}, {target.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
