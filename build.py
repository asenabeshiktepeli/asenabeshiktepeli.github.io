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
ROOT_FILES = ROOT / "root"  # copied as-is to the top of docs/ (e.g. search console verification)
N8N_FILES = ROOT / "automation" / "n8n"  # sample workflows, published to docs/static/n8n/ (source stays here)
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


def make_linker(contact):
    """Filter: turn phrases in already-escaped text into links (used by FAQ answers).

    href "booking" -> contact.booking_url, "email" -> mailto:contact.email,
    "#id" -> same page, https://... -> new tab. Links without a target stay plain text.
    """
    special = {
        "booking": contact.get("booking_url") or "",
        "email": f"mailto:{contact['email']}" if contact.get("email") else "",
    }

    def link_phrases(html, links):
        html = Markup(html)
        for link in links or []:
            text = str(escape(link.get("text") or ""))
            href = special.get(link.get("href"), link.get("href") or "")
            if not text or not href or text not in html:
                continue
            new_tab = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
            anchor = f'<a href="{escape(href)}"{new_tab}>{text}</a>'
            html = Markup(str(html).replace(text, anchor, 1))
        return html

    return link_phrases


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

    same_as = [url for url in (contact.get("github"), contact.get("linkedin"), contact.get("upwork")) if url]
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


def last_content_change():
    """Newest modification date of content.yaml, templates/ and static/.

    Used for the sitemap's lastmod, so rebuilding without edits gives the same file.
    """
    paths = [CONTENT, *TEMPLATES.rglob("*"), *STATIC.rglob("*")]
    newest = max(p.stat().st_mtime for p in paths if p.is_file())
    return date.fromtimestamp(newest).isoformat()


def write_seo_files(meta):
    """robots.txt (allow all) and a one-page sitemap.xml dated by the last content change."""
    url = (meta.get("url") or "").rstrip("/")
    robots = "User-agent: *\nAllow: /\n"
    if url:
        robots += f"\nSitemap: {url}/sitemap.xml\n"
        sitemap = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            "  <url>\n"
            f"    <loc>{escape(url)}/</loc>\n"
            f"    <lastmod>{last_content_change()}</lastmod>\n"
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
    env.filters["link_phrases"] = make_linker(content.get("contact") or {})

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

    # n8n sample workflows (JSON + README), served from the site itself.
    if N8N_FILES.is_dir():
        (out_static / "n8n").mkdir(exist_ok=True)
        for path in N8N_FILES.iterdir():
            if path.is_file():
                shutil.copy2(path, out_static / "n8n" / path.name)

    # Files that must live at the site root, copied unchanged on every build.
    if ROOT_FILES.is_dir():
        for path in ROOT_FILES.iterdir():
            if path.is_file():
                shutil.copy2(path, OUT / path.name)

    (OUT / ".nojekyll").touch(exist_ok=True)

    print(f"Built {OUT / 'index.html'}")


if __name__ == "__main__":
    main()
