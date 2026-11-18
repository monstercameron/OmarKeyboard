"""Check local documentation links, matrix identity and the portable viewer payload."""
import base64
import csv
import gzip
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]


class AssetLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {"href", "src", "poster"} and value:
                self.links.append(value)


def check_link(source, link):
    parsed = urlsplit(link)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return
    dest = (source.parent / unquote(parsed.path)).resolve()
    if not dest.is_relative_to(ROOT) or not dest.exists():
        raise ValueError(f"{source.relative_to(ROOT)} links to missing or external path {link}")
    # Exact spelling matters on the case-sensitive filesystem used by Pages.
    while dest != ROOT:
        if dest.name not in {child.name for child in dest.parent.iterdir()}:
            raise ValueError(f"Incorrect path case in {source.relative_to(ROOT)}: {link}")
        dest = dest.parent


def main():
    docs = [ROOT / "README.md", ROOT / "CONTRIBUTING.md", ROOT / "THIRD_PARTY_NOTICES.md"]
    for folder in ("docs", "hardware", "archive"):
        docs.extend((ROOT / folder).rglob("*.md"))
    for source in docs:
        content = re.sub(r"^```.*?^```[^\n]*", "", source.read_text("utf-8"), flags=re.M | re.S)
        for link in re.findall(r"\]\(([^\s)]+)\)", content):
            check_link(source, link)
    for source in (ROOT / "docs").rglob("*.html"):
        parser = AssetLinks()
        parser.feed(source.read_text("utf-8"))
        for link in parser.links:
            check_link(source, link)

    with (ROOT / "hardware/layout/omar-switches.csv").open(encoding="utf-8", newline="") as source:
        switches = list(csv.DictReader(source))
    positions = {(int(s["matrix_row"]), int(s["matrix_col"])) for s in switches}
    if (len(switches), len(positions), sum(s["zone"] == "dial" for s in switches)) != (92, 92, 2):
        raise ValueError("Expected 90 keys and two dial presses on 92 distinct matrix contacts")
    if any(not (0 <= row < 8 and 0 <= col < 12) for row, col in positions):
        raise ValueError("Contact outside the 8 × 12 matrix")

    viewer = (ROOT / "hardware/model/View-Omar-Keyboard.html").read_text(encoding="utf-8")
    for payload, rel in (("model-data", "docs/assets/omar-keyboard.glb"),
                         ("viewer-code", "docs/vendor/model-viewer.min.js")):
        match = re.search(rf'id="{payload}">([^<]+)</script>', viewer)
        if not match or gzip.decompress(base64.b64decode(match[1], validate=True)) != (ROOT / rel).read_bytes():
            raise ValueError(f"Offline {payload} differs from {rel}. Run tools/package-viewer.py")
    license_text = (ROOT / "docs/vendor/model-viewer-LICENSE.txt").read_text(encoding="utf-8").strip()
    if license_text not in viewer:
        raise ValueError("Offline viewer is missing the bundled license")
    print(f"Verified local links in {len(docs)} Markdown files and the site HTML, "
          "92 distinct matrix positions, embedded GLB, runtime and license.")


if __name__ == "__main__":
    main()
