"""Build the site: content.yaml + templates/ -> docs/index.html, static/ -> docs/static/.

Run: .\\.venv\\Scripts\\python.exe build.py
"""

import re
import shutil
from pathlib import Path

import yaml
from jinja2 import ChainableUndefined, Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup, escape

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content.yaml"
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"
OUT = ROOT / "docs"

# Proper names inside sentences that browser translation should leave alone.
# The person's name and company names are added from content.yaml.
NO_TRANSLATE_TERMS = ["Logo Tiger 3", "Logo", "Kyrenia"]


def initials(name):
    """'Jane Doe' -> 'JD'. Ignores brackets and punctuation in placeholders."""
    words = re.findall(r"[^\W\d_]+", name or "")
    return "".join(word[0] for word in words).upper()[:2]


def display_url(url):
    """'https://github.com/name' -> 'github.com/name'."""
    return re.sub(r"^https?://(www\.)?", "", url or "").rstrip("/")


def make_no_translate(terms):
    """Filter: wrap each term in <span translate="no">, leave the rest translatable."""
    terms = sorted({t for t in terms if t}, key=len, reverse=True)
    if not terms:
        return lambda text: escape(text or "")
    pattern = re.compile(r"\b(?:" + "|".join(re.escape(str(escape(t))) for t in terms) + r")\b")

    def no_translate(text):
        escaped = str(escape(text or ""))
        return Markup(pattern.sub(lambda m: f'<span translate="no">{m.group(0)}</span>', escaped))

    return no_translate


def main():
    content = yaml.safe_load(CONTENT.read_text(encoding="utf-8"))

    # Show the monogram instead of a broken image when the photo file is missing.
    hero = content.get("hero") or {}
    if hero.get("photo") and not (ROOT / hero["photo"]).is_file():
        print(f"Note: {hero['photo']} not found – using monogram.")
        hero["photo"] = ""

    env = Environment(
        loader=FileSystemLoader(TEMPLATES),
        autoescape=select_autoescape(["html"]),
        # Missing fields render as empty and are skipped by {% if %} checks.
        undefined=ChainableUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["initials"] = initials
    env.filters["display_url"] = display_url
    names = [hero.get("name"), (content.get("nav") or {}).get("brand")]
    names += [job.get("company") for job in (content.get("experience") or {}).get("items") or []]
    env.filters["no_translate"] = make_no_translate(names + NO_TRANSLATE_TERMS)

    html = env.get_template("index.html").render(**content)

    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(html, encoding="utf-8")

    out_static = OUT / "static"
    if out_static.exists():
        shutil.rmtree(out_static)
    shutil.copytree(STATIC, out_static)

    (OUT / ".nojekyll").touch(exist_ok=True)

    print(f"Built {OUT / 'index.html'}")


if __name__ == "__main__":
    main()
