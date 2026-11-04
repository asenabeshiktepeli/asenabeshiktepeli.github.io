"""Make 800px-wide copies of the portfolio screenshots for srcset.

static/img/portfolio/<name>.webp -> static/img/portfolio/<name>-800.webp
Safe to run again: thumbnails are rebuilt from the full-size originals.

    .\\.venv\\Scripts\\python.exe tools\\make_thumbs.py
    .\\.venv\\Scripts\\python.exe tools\\make_thumbs.py hubspot-support   (only this one)
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "static" / "img" / "portfolio"
WIDTH = 800
SUFFIX = f"-{WIDTH}"
QUALITY = 82


def main():
    # Optional: pass names (e.g. hubspot-support) to rebuild only those thumbnails.
    names = set(sys.argv[1:])
    sources = sorted(
        p for p in FOLDER.glob("*.webp")
        if not p.stem.endswith(SUFFIX) and (not names or p.stem in names)
    )
    if not sources:
        print(f"No .webp files in {FOLDER.relative_to(ROOT)}")
        return
    for source in sources:
        target = source.with_name(f"{source.stem}{SUFFIX}.webp")
        with Image.open(source) as image:
            height = round(image.height * WIDTH / image.width)
            small = image.resize((WIDTH, height), Image.Resampling.LANCZOS)
            small.save(target, "WEBP", quality=QUALITY, method=6)
        print(f"Wrote {target.relative_to(ROOT)} ({WIDTH}x{height}, {target.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
