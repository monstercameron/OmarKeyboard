"""Embed the project model and vendored runtime in the portable offline viewer."""
import base64
import gzip
import io
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "hardware/model"
VENDOR = ROOT / "docs/vendor"


def encode(data):
    return base64.b64encode(data).decode("ascii")


def compressed(path):
    return encode(gzip.compress(path.read_bytes(), mtime=0))


def main():
    poster = io.BytesIO()
    with Image.open(MODEL / "Omar-Keyboard.png") as image:
        image.thumbnail((1680, 900))
        image.convert("RGB").save(poster, "JPEG", quality=88, optimize=True)

    tokens = {
        "__POSTER__": encode(poster.getvalue()),
        "__CODE__": compressed(VENDOR / "model-viewer.min.js"),
        "__MODEL__": compressed(ROOT / "docs/assets/omar-keyboard.glb"),
        "__LICENSE__": "@google/model-viewer 4.1.0 · Copyright Google LLC and contributors\n"
        + (VENDOR / "model-viewer-LICENSE.txt").read_text(encoding="utf-8"),
    }
    page = (ROOT / "tools/viewer-template.html").read_text(encoding="utf-8")
    for token, value in tokens.items():
        if page.count(token) != 1:
            raise ValueError(f"Expected one {token} in the viewer template")
        page = page.replace(token, value)
    (MODEL / "View-Omar-Keyboard.html").write_text(page, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
