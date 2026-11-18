"""Build the offline internal-assembly viewer from the Blender exports and vendored runtime."""
import base64
import gzip
import io
from pathlib import Path

from PIL import Image

root=Path(__file__).resolve().parents[1]
out=root/"hardware/model/internals"
vendor=root/"docs/vendor"
with Image.open(out/"Exploded.png") as img:
    img.thumbnail((1400,1000))
    buf=io.BytesIO()
    img.convert("RGB").save(buf,"JPEG",quality=86,optimize=True)

def encoded(data):
    return base64.b64encode(data).decode("ascii")

source=(root/"tools/internals-viewer.html").read_text("utf-8")
for token,value in {
    "__POSTER__":encoded(buf.getvalue()),
    "__MODEL__":encoded(gzip.compress((out/"Omar-Keyboard-Internals.glb").read_bytes(),mtime=0)),
    "__CODE__":encoded(gzip.compress((vendor/"model-viewer.min.js").read_bytes(),mtime=0)),
    "__LICENSE__":"@google/model-viewer 4.1.0 · Copyright Google LLC and contributors\n"+
        (vendor/"model-viewer-LICENSE.txt").read_text("utf-8"),
}.items():
    if source.count(token)!=1:
        raise ValueError(token)
    source=source.replace(token,value)
(out/"View-Internals.html").write_text(source,encoding="utf-8",newline="\n")
