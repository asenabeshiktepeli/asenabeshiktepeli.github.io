"""Build the site: content.yaml + templates/ -> docs/index.html and docs/404.html,
static/ -> docs/static/, plus docs/robots.txt and docs/sitemap.xml.

Run: .\\.venv\\Scripts\\python.exe build.py
"""

import json
import re
import shutil
from datetime import date
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


def person_jsonld(content):
    """schema.org Person for search engines, built only from content.yaml."""
    meta = content.get("meta") or {}
    hero = content.get("hero") or {}
    contact = content.get("contact") or {}
    certifications = (content.get("certifications") or {}).get("items") or []

    person = {"@context": "https://schema.org", "@type": "Person", "name": hero.get("name")}
    if hero.get("title"):
        person["jobTitle"] = hero["title"]
    if meta.get("url"):
        person["url"] = meta["url"].rstrip("/") + "/"
    if contact.get("email"):
        person["email"] = "mailto:" + contact["email"]

    # "Kyrenia, Cyprus · EET (UTC+2)" -> locality "Kyrenia", country "Cyprus"
    place = [part.strip() for part in (contact.get("location") or "").split("·")[0].split(",")]
    if len(place) >= 2 and all(place):
        person["address"] = {"@type": "PostalAddress", "addressLocality": place[0], "addressCountry": place[-1]}

    same_as = [url for url in (contact.get("github"), contact.get("upwork")) if url]
    if same_as:
        person["sameAs"] = same_as

    schools = [c["issuer"] for c in certifications if c.get("issuer") and "degree" in (c.get("name") or "").lower()]
    if schools:
        person["alumniOf"] = [{"@type": "CollegeOrUniversity", "name": name} for name in schools]

    # "Turkish – Native" -> "Turkish"
    languages = [re.split(r"\s[–-]\s", lang)[0].strip() for lang in contact.get("languages") or []]
    if languages:
        person["knowsLanguage"] = languages

    data = json.dumps(person, ensure_ascii=False, indent=2)
    # "</" inside a <script> block would end it early
    return Markup(data.replace("</", "<\\/"))


def write_seo_files(meta):
    """robots.txt (allow all) and a one-page sitemap.xml dated today."""
    url = (meta.get("url") or "").rstrip("/")
    robots = "User-agent: *\nAllow: /\n"
    if url:
        robots += f"\nSitemap: {url}/sitemap.xml\n"
        sitemap = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "  <url>\n"
            f"    <loc>{escape(url)}/</loc>\n"
            f"    <lastmod>{date.today().isoformat()}</lastmod>\n"
            "  </url>\n"
            "</urlset>\n"
        )
        (OUT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    (OUT / "robots.txt").write_text(robots, encoding="utf-8")


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

    OUT.mkdir(exist_ok=True)
    home = env.get_template("index.html").render(**content, page="home", person_jsonld=person_jsonld(content))
    (OUT / "index.html").write_text(home, encoding="utf-8")
    not_found = env.get_template("404.html").render(**content, page="404")
    (OUT / "404.html").write_text(not_found, encoding="utf-8")
    write_seo_files(content.get("meta") or {})

    out_static = OUT / "static"
    if out_static.exists():
        shutil.rmtree(out_static)
    shutil.copytree(STATIC, out_static)

    (OUT / ".nojekyll").touch(exist_ok=True)

    print(f"Built {OUT / 'index.html'}")


if __name__ == "__main__":
    main()
