"""Print cv/cv.html to static/cv/Asena_Beshiktepeli_CV.pdf with Chrome (or Edge) headless.

No extra install needed: the browser does the layout, Inter comes from cv/fonts/.
Run, then build.py to copy the PDF to docs/:

    .\\.venv\\Scripts\\python.exe tools\\make_cv.py
    .\\.venv\\Scripts\\python.exe build.py

Set CHROME_PATH if the browser is somewhere else. The script stops with an error when the
PDF is not exactly one page, or when the CV text looks like it holds a phone number.
"""

import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "cv" / "cv.html"
OUTPUT = ROOT / "static" / "cv" / "Asena_Beshiktepeli_CV.pdf"

BROWSERS = [
    os.environ.get("CHROME_PATH", ""),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
]


def find_browser():
    for candidate in BROWSERS:
        if not candidate:
            continue
        if Path(candidate).is_file():
            return candidate
        found = shutil.which(candidate)
        if found:
            return found
    sys.exit("Chrome or Edge not found. Set CHROME_PATH to the browser's exe.")


def check_private_details(source):
    """Stop if the CV text holds something that looks like a phone number or a tel: link."""
    text = re.sub(r"<svg.*?</svg>|<!--.*?-->|<style.*?</style>", " ", source, flags=re.S)
    if "tel:" in text.lower():
        sys.exit("cv.html has a tel: link. The CV must not show a phone number.")
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    phone = re.search(r"\+?\d[\d ()./-]{7,}\d", text)
    if phone:
        sys.exit(f"cv.html has something that looks like a phone number: {phone.group(0)!r}")


def page_count(pdf):
    """Chrome writes page objects as plain text, so they can be counted without a PDF library."""
    return len(re.findall(rb"/Type\s*/Page(?![s\w])", pdf))


def main():
    check_private_details(SOURCE.read_text(encoding="utf-8"))
    browser = find_browser()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as profile, tempfile.TemporaryDirectory() as out_dir:
        target = Path(out_dir) / "cv.pdf"
        subprocess.run(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                f"--user-data-dir={profile}",
                "--no-pdf-header-footer",
                "--virtual-time-budget=5000",  # wait for the fonts
                f"--print-to-pdf={target}",
                SOURCE.as_uri(),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        pdf = target.read_bytes()

    pages = page_count(pdf)
    if pages != 1:
        sys.exit(f"The CV printed to {pages} pages, it must fit on one A4 page. PDF not written.")
    OUTPUT.write_bytes(pdf)
    print(f"Wrote {OUTPUT.relative_to(ROOT)} (1 page, {len(pdf) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
