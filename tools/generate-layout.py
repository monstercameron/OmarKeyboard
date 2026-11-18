#!/usr/bin/env python3
"""Generate the switch CSV, KLE layout, plate drawing and matrix table, then verify the specification."""
import csv, json, math, re, sys
from collections import Counter
from pathlib import Path
from xml.sax.saxutils import escape

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "hardware/layout"
U = 19.05
YROWS = [0, 1.25, 2.25, 3.25, 4.25, 5.25]          # physical row tops (u)
ROW_NAMES = ["top", "number", "qwerty", "home", "shift", "bottom"]
KEYCAP_ROW = ["R1", "R1", "R2", "R3", "R4", "R4"]


def r2(v):
    return math.floor(v * 100 + 0.5 + 1e-9) / 100


def mm(v):
    return f"{r2(v):.2f}"


# ---------------------------------------------------------------- layout table
# Each entry: id, label (prototype data-key), zone, x, y, w, primary legend
keys = []


def add(kid, label, zone, x, y, w, primary=None, fn="", sup=""):
    keys.append(dict(id=kid, label=label, zone=zone, x=x, y=y, w=w,
                     primary=label if primary is None else primary, fn=fn, sup=sup))


O = 1.5
add("Volume dial press", "Mute", "dial", 0, 0, 1, "Mute")
add("Esc", "Esc", "top", O, 0, 1)
for n in range(1, 6):
    add(f"Desk {n}", f"Desk {n}", "top", O + n, 0, 1)
add("Last Desk", "Last Desk", "top", O + 6, 0, 1)
add("Send & Stay", "Send & Stay", "top", O + 7, 0, 1.5)
add("Move & Go", "Move & Go", "top", O + 8.5, 0, 1.5)
for i, (k, p) in enumerate([("Clipboard", "Clip History"), ("Paste", "Paste"), ("Alerts", "Alerts"),
                            ("Mic Mute", "Mic Mute"), ("Delete", "Delete")]):
    add(k, k, "top", O + 10 + i, 0, 1, p, fn="Insert" if k == "Delete" else "")
add("Screenshot", "Screenshot", "top", 16.75, 0, 1, "Screenshot")
add("Grab Text", "Grab Text", "top", 17.75, 0, 1)
add("Lock", "Lock", "top", 18.75, 0, 1)
add("Brightness dial press", "Layout", "dial", 20.25, 0, 1, "Layout")

for i, k in enumerate(["Guide", "Browser", "Menu", "Terminal", "Files"]):
    add(k, k, "left rail", 0, 1.25 + i, 1)
for i, (k, p) in enumerate([("Flip Split", "Flip Split"), ("Float", "Float"), ("Fullscreen", "Fullscreen"),
                            ("Swap", "Swap"), ("Focus", "Focus")]):
    add(k, k, "right rail", 20.25, 1.25 + i, 1, p)

FN = {"←": "Home", "→": "End", "↑": "PgUp", "↓": "PgDn", "Delete": "Insert", "Next Window": "Last Win"}
SUP = {"W": "Close", "C": "Copy", "V": "Paste"}


def row(entries, y, zone="main"):
    x = O
    seen = Counter()
    for e in entries:
        k, w = (e if isinstance(e, tuple) else (e, 1))
        kid = k
        if k == "Shift":
            kid = "Left Shift" if x == O else "Right Shift"
        fn = "Fn" if k == "Caps" else ("" if k == "Delete" else FN.get(k, ""))
        add(kid, k, zone, x, y, w, "Super" if k.endswith("Super") else k, fn, SUP.get(k, ""))
        x += w


row([("~", 1)] + [(c, 1) for c in "1234567890"] + [("-", 1), ("=", 1), ("Backspace", 2)], 1.25)
row([("Tab", 1.5)] + [(c, 1) for c in "QWERTYUIOP"] + [("[", 1), ("]", 1), ("\\", 1.5)], 2.25)
row([("Caps", 1.75)] + [(c, 1) for c in "ASDFGHJKL"] + [(";", 1), ("'", 1), ("Enter", 2.25)], 3.25)
row([("Shift", 2.25)] + [(c, 1) for c in "ZXCVBNM"] + [(",", 1), (".", 1), ("/", 1), ("Shift", 2.75)], 4.25)
row([("Ctrl", 1.5), ("Left Super", 1.75), ("Space", 6.25), ("Right Super", 1.5),
     ("Next Window", 2.25), ("Right Ctrl", 1.75)], 5.25, "main")
for k, x, y in [("↑", 17.75, 4.25), ("←", 16.75, 5.25), ("↓", 17.75, 5.25), ("→", 18.75, 5.25)]:
    add(k, k, "arrows", x, y, 1, fn=FN[k])
# Space has no legend
for k in keys:
    if k["id"] == "Right Ctrl":
        k["primary"] = "Ctrl"
    if k["id"] == "Space":
        k["primary"] = ""
    if k["id"] == "Left Super" or k["id"] == "Right Super":
        k["zone"] = "thumbs"
    if k["id"] in ("Ctrl", "Space", "Next Window", "Right Ctrl"):
        k["zone"] = "thumbs"

# --------------------------------------------------------------- derived fields
LED = {"Caps": 0, "Desk 1": 1, "Desk 2": 2, "Desk 3": 3, "Desk 4": 4, "Desk 5": 5, "Send & Stay": 6,
       "Move & Go": 7, "Mic Mute": 8, "Swap": 9, "Focus": 10, "→": 11, "↓": 12, "←": 13, "↑": 14}
PRIMARY_NAMES = {"Fullscreen": "Fullscreen"}
for k in keys:
    k["cx"] = (k["x"] + k["w"] / 2) * U
    k["cy"] = (k["y"] + 0.5) * U
    k["wmm"] = k["w"] * U
    k["stab"] = "6.25u" if k["w"] == 6.25 else ("2u" if k["w"] >= 2 else "none")
    k["led"] = LED.get(k["id"], "")
    if k["zone"] == "dial":
        k["capcls"], k["switch"] = "knob", "EC11E-push"
    else:
        k["capcls"] = "DSA" if k["id"] == "Lock" else KEYCAP_ROW[YROWS.index(k["y"])] if k["y"] in YROWS else None
        k["switch"] = "linear-80gf" if k["id"] == "Lock" else "tactile"
    k["prow"] = YROWS.index(k["y"])

# arrows: ↑ is in the shift row (y 4.25), others bottom row (5.25): handled by y.
# ----------------------------------------------------------------- assertions
assert len(keys) == 92, len(keys)
assert len({k["id"] for k in keys}) == 92
real = [k for k in keys if k["zone"] != "dial"]
inv = Counter(k["w"] for k in real)
EXPECT = {1: 75, 1.5: 6, 1.75: 3, 2: 1, 2.25: 3, 2.75: 1, 6.25: 1}
assert dict(inv) == EXPECT, dict(inv)
assert len(real) == 90

# ----------------------------------------------------------------------- matrix
matrix = {}  # (row, col) -> key
phys = [sorted([k for k in keys if k["prow"] == r], key=lambda k: k["x"]) for r in range(6)]
leftover = []
for r in range(6):
    for c, k in enumerate(phys[r][:12]):
        k["mrow"], k["mcol"] = r, c
    leftover.append(phys[r][12:])
nxt6 = 0
for k in leftover[0]:
    k["mrow"], k["mcol"] = 6, nxt6
    nxt6 += 1
for k in leftover[4]:
    k["mrow"], k["mcol"] = 6, nxt6
    nxt6 += 1
nxt7 = 0
for r in (1, 2, 3):
    for k in leftover[r]:
        k["mrow"], k["mcol"] = 7, nxt7
        nxt7 += 1
assert not leftover[5], "bottom row overflow"
for k in keys:
    pos = (k["mrow"], k["mcol"])
    assert pos not in matrix, f"matrix collision {pos}"
    assert k["mcol"] < 12 and k["mrow"] < 8
    matrix[pos] = k
assert len(matrix) == 92

# -------------------------------------------------------------------------- CSV
order = sorted(keys, key=lambda k: (k["prow"], k["x"]))
with open(OUT / "omar-switches.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["id", "label", "zone", "x_u", "y_u", "w_u", "center_x_mm", "center_y_mm", "width_mm", "stabilizer",
                "matrix_row", "matrix_col", "led_index", "keycap_row", "switch", "legend_primary", "legend_fn",
                "legend_super"])
    for k in order:
        w.writerow([k["id"], k["label"], k["zone"], f"{k['x']:g}", f"{k['y']:g}", f"{k['w']:g}", mm(k["cx"]),
                    mm(k["cy"]), mm(k["wmm"]), k["stab"], k["mrow"], k["mcol"], k["led"], k["capcls"], k["switch"],
                    k["primary"], k["fn"], k["sup"]])

# -------------------------------------------------------------------------- KLE
kle = []
for r in range(6):
    items = []
    cursor = 0.0
    for k in sorted([k for k in keys if k["prow"] == r], key=lambda k: k["x"]):
        props = {}
        if not items and r > 0 and abs(YROWS[r] - YROWS[r - 1] - 1) > 1e-9:
            props["y"] = round(YROWS[r] - YROWS[r - 1] - 1, 4)
        # KLE rows advance y by 1; the y offset is on the row's first key
        if abs(k["x"] - cursor) > 1e-9:
            props["x"] = round(k["x"] - cursor, 4)
        if k["w"] != 1:
            props["w"] = k["w"]
        # arrows sit in different physical rows already (↑ in the shift row)
        if props:
            items.append(props)
        legend = k["primary"]
        if k["fn"] and k["zone"] != "dial":
            legend += "\n" + k["fn"]
        items.append(legend)
        cursor = k["x"] + k["w"]
    kle.append(items)
(OUT / "omar-kle.json").write_text("[\n" + ",\n".join(" " + json.dumps(r, ensure_ascii=False) for r in kle) + "\n]\n", encoding="utf-8", newline="\n")

# ----------------------------------------------------------------------- matrix md
def cell(k):
    s = k["id"]
    return s.replace("|", "\\|")


lines = ["| Row | " + " | ".join(f"C{c}" for c in range(12)) + " |", "|---|" + "---|" * 12]
for r in range(8):
    lines.append(f"| R{r} | " + " | ".join(cell(matrix[(r, c)]) if (r, c) in matrix else "—" for c in range(12)) + " |")
table = "\n".join(lines)
print(table)
spec_path = ROOT / "hardware/specification.md"
spec = spec_path.read_text(encoding="utf-8")
block = "<!-- MATRIX:BEGIN -->\n" + table + "\n<!-- MATRIX:END -->"
if spec.count("<!-- MATRIX:BEGIN -->") == spec.count("<!-- MATRIX:END -->") == 1 and spec.index("<!-- MATRIX:BEGIN -->") < spec.index("<!-- MATRIX:END -->"):
    spec2 = re.sub(r"<!-- MATRIX:BEGIN -->.*?<!-- MATRIX:END -->", lambda m: block, spec, flags=re.S)
elif "<!-- MATRIX -->" in spec:
    spec2 = spec.replace("<!-- MATRIX -->", block)
else:
    sys.exit("Missing or ambiguous matrix markers in hardware/specification.md")
if spec2 != spec:
    spec_path.write_text(spec2, encoding="utf-8", newline="")
spec = spec2

# --------------------------------------------------------------------- geometry
FIELD_W, FIELD_H = 21.25 * U, 6.25 * U
PLATE_W, PLATE_H = FIELD_W + 1.0, FIELD_H + 1.0
WALL, CLEAR = 8.0, 0.5
CASE_W, CASE_H = PLATE_W + 2 * (WALL + CLEAR), PLATE_H + 2 * (WALL + CLEAR)
byid = {k["id"]: k for k in keys}

ARROWS = {n: (byid[n]["cx"], byid[n]["cy"]) for n in "↑←↓→"}
DIALS = {"Volume": (byid["Volume dial press"]["cx"], byid["Volume dial press"]["cy"]),
         "Brightness": (byid["Brightness dial press"]["cx"], byid["Brightness dial press"]["cy"])}
STABS = {n: (byid[n]["cx"], byid[n]["cy"], 100.0 if n == "Space" else 23.88)
         for n in ["Backspace", "Enter", "Left Shift", "Right Shift", "Space", "Next Window"]}
HOLES = ([(1.25 * U, y * U) for y in (1.75, 3.75, 5.75)] + [(20.0 * U, y * U) for y in (1.75, 3.75, 5.75)] +
         [(x * U, 1.125 * U) for x in (4.5, 9.0, 13.5)] + [(18.25 * U, 3.75 * U)] +
         [(17.25 * U, 4.75 * U), (19.25 * U, 4.75 * U)])
MOD_X0, MOD_X1 = 16.75 * U, 19.75 * U
MOD_Y0, MOD_Y1 = 1.25 * U, 3.25 * U
SUP_L0, SUP_L1 = MOD_X0 + 1.0, MOD_X0 + 5.0
BAR_X0 = 321.49  # T3 tread drive and journal datums, sheet 19
BAR_LEN, BAR_D = 42.0, 16.0
BAR_X1 = BAR_X0 + BAR_LEN
BAR_CX, BAR_CY = (BAR_X0 + BAR_X1) / 2, (MOD_Y0 + MOD_Y1) / 2
ENC_X0 = BAR_X1 + 0.5
ENC_X1 = ENC_X0 + 7.5
SLOT_W, SLOT_H = 44.40, 13.50

# ------------------------------------------------------------------------- SVG
OX, OY = 46.0, 52.0
W_SVG, H_SVG = 500.0, 282.0
INK, MUTE, LIGHT = "#2b2f33", "#6b7178", "#b5bac0"
svg = []
A = svg.append
A(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W_SVG}mm" height="{H_SVG}mm" viewBox="0 0 {W_SVG} {H_SVG}" '
  f'font-family="Arial, Helvetica, sans-serif">')
A("<title>Omar keyboard dimensioned top view, revision 3, millimetres</title>")
A('<defs><marker id="ar" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="2.6" markerHeight="1.6" markerUnits="userSpaceOnUse" orient="auto-start-reverse">'
  f'<path d="M0,0 L10,3 L0,6 z" fill="{INK}"/></marker></defs>')
A(f'<rect x="0" y="0" width="{W_SVG}" height="{H_SVG}" fill="#ffffff"/>')
A(f'<g transform="translate({OX} {OY})" fill="none" stroke="{INK}" stroke-width="0.25">')

# case and plate
cx0 = -(CASE_W - FIELD_W) / 2
cy0 = -(CASE_H - FIELD_H) / 2
A(f'<rect id="case" x="{cx0:.3f}" y="{cy0:.3f}" width="{CASE_W:.3f}" height="{CASE_H:.3f}" rx="4" stroke-width="0.5"/>')
A(f'<rect id="plate" x="-0.5" y="-0.5" width="{PLATE_W:.3f}" height="{PLATE_H:.3f}" rx="1" stroke-width="0.5"/>')
A(f'<rect id="field" x="0" y="0" width="{FIELD_W:.4f}" height="{FIELD_H:.4f}" stroke="{MUTE}" stroke-dasharray="2 1.5" stroke-width="0.2"/>')

# keys
ns = lambda s: escape(s)
for k in keys:
    if k["zone"] == "dial":
        cxm, cym = k["cx"], k["cy"]
        A(f'<rect x="{cxm-7:.2f}" y="{cym-7:.2f}" width="14" height="14" stroke="{LIGHT}" stroke-width="0.2"/>')
        A(f'<circle cx="{cxm:.2f}" cy="{cym:.2f}" r="9" stroke="{INK}" stroke-width="0.4"/>')
        A(f'<circle cx="{cxm:.2f}" cy="{cym:.2f}" r="1.2" stroke="{MUTE}" stroke-width="0.2"/>')
        A(f'<text x="{cxm:.2f}" y="{cym+14.2:.2f}" font-size="2.4" fill="{MUTE}" stroke="none" text-anchor="middle">{ns(k["primary"])} press</text>')
        continue
    x0 = k["x"] * U + 0.525
    y0 = k["y"] * U + 0.525
    wm, hm = k["wmm"] - 1.05, U - 1.05
    A(f'<rect x="{x0:.3f}" y="{y0:.3f}" width="{wm:.3f}" height="{hm:.3f}" rx="1.2" fill="#fafaf6"/>')
    A(f'<rect x="{k["cx"]-7:.2f}" y="{k["cy"]-7:.2f}" width="14" height="14" stroke="{LIGHT}" stroke-width="0.15" stroke-dasharray="1 0.8"/>')
    lab = k["primary"]
    words = {"Last Desk": ["Last", "Desk"], "Send & Stay": ["Send", "& Stay"], "Move & Go": ["Move", "& Go"],
             "Clip History": ["Clip", "History"], "Mic Mute": ["Mic", "Mute"], "Screenshot": ["Screen", "shot"],
             "Grab Text": ["Grab", "Text"], "Flip Split": ["Flip", "Split"], "Fullscreen": ["Full", "screen"],
             "Next Window": ["Next", "Window"]}
    if k["id"].startswith("Desk "):
        parts = ["Desk", lab[-1]]
    else:
        parts = words.get(lab, [lab])
    sub = [s for s in (k["fn"], k["sup"]) if s]
    size = 4.0 if len(parts) == 1 and len(lab) == 1 else 3.0
    lines_all = [(p, size, INK) for p in parts] + [(s, 2.2, "#7a1346" if s == k["fn"] else "#6b3d00") for s in sub]
    lh = 3.4
    total = lh * (len(lines_all) - 1)
    ty = k["cy"] - total / 2 + 1.0
    for i, (t, fs, col) in enumerate(lines_all):
        A(f'<text x="{k["cx"]:.2f}" y="{ty + i*lh:.2f}" font-size="{fs}" fill="{col}" stroke="none" text-anchor="middle">{ns(t)}</text>')

# stabilizers
for name, (sx, sy, span) in STABS.items():
    for dx in (-span / 2, span / 2):
        A(f'<circle cx="{sx+dx:.2f}" cy="{sy:.2f}" r="1.1" stroke="#b34a00" stroke-width="0.3"/>')
    A(f'<line x1="{sx-span/2:.2f}" y1="{sy+6.6:.2f}" x2="{sx+span/2:.2f}" y2="{sy+6.6:.2f}" stroke="#b34a00" stroke-width="0.25" stroke-dasharray="1.2 0.8"/>')

# roller module
A(f'<rect id="roller-module" x="{MOD_X0:.2f}" y="{MOD_Y0:.2f}" width="{MOD_X1-MOD_X0:.2f}" height="{MOD_Y1-MOD_Y0:.2f}" rx="2" stroke="{INK}" stroke-width="0.4" fill="#f1f4f7"/>')
A(f'<rect id="barrel-slot" x="{BAR_CX-SLOT_W/2:.2f}" y="{BAR_CY-SLOT_H/2:.2f}" width="{SLOT_W}" height="{SLOT_H}" rx="0.55" stroke="{INK}" stroke-width="0.4" fill="#ffffff"/>')
A(f'<rect x="{BAR_X0:.2f}" y="{BAR_CY-BAR_D/2:.2f}" width="{BAR_LEN}" height="{BAR_D}" rx="1" stroke="{MUTE}" stroke-width="0.25" stroke-dasharray="2 1"/>')
A(f'<text x="{(MOD_X0+MOD_X1)/2:.2f}" y="{MOD_Y0+5:.2f}" font-size="3" fill="{INK}" stroke="none" text-anchor="middle">Roller module</text>')
A(f'<text x="{BAR_CX:.2f}" y="{BAR_CY+0.9:.2f}" font-size="2.4" fill="{MUTE}" stroke="none" text-anchor="middle">barrel O16 x 42</text>')

# mounting holes
for i, (hx, hy) in enumerate(HOLES, 1):
    A(f'<circle cx="{hx:.2f}" cy="{hy:.2f}" r="1.1" stroke="{INK}" stroke-width="0.3"/>')
    A(f'<path d="M{hx-2.2:.2f},{hy:.2f}H{hx+2.2:.2f}M{hx:.2f},{hy-2.2:.2f}V{hy+2.2:.2f}" stroke="{MUTE}" stroke-width="0.15"/>')
    A(f'<text x="{hx+1.8:.2f}" y="{hy-1.4:.2f}" font-size="2" fill="{MUTE}" stroke="none">{i}</text>')

# dimension helpers
def txt(x, y, s, size=3.2, anchor="middle", rot=None, fill=INK, weight="normal"):
    tr = f' transform="rotate({rot} {x:.2f} {y:.2f})"' if rot is not None else ""
    A(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" fill="{fill}" stroke="none" text-anchor="{anchor}" font-weight="{weight}"{tr}>{ns(s)}</text>')


def hdim(x1, x2, y, label, ref_y, small=False, label_dx=0, label_side=-1):
    """horizontal dimension; extension lines from ref_y to y"""
    s = 1 if y > ref_y else -1
    for xx in (x1, x2):
        A(f'<line x1="{xx:.2f}" y1="{ref_y:.2f}" x2="{xx:.2f}" y2="{y+s*1.5:.2f}" stroke="{MUTE}" stroke-width="0.15"/>')
    if small:
        A(f'<line x1="{x1-6:.2f}" y1="{y:.2f}" x2="{x1:.2f}" y2="{y:.2f}" stroke="{INK}" stroke-width="0.25" marker-end="url(#ar)"/>')
        A(f'<line x1="{x2+6:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" stroke="{INK}" stroke-width="0.25" marker-end="url(#ar)"/>')
    else:
        A(f'<line x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" stroke="{INK}" stroke-width="0.25" marker-start="url(#ar)" marker-end="url(#ar)"/>')
    txt((x1 + x2) / 2 + label_dx, y + label_side * 1.3 if label_side < 0 else y + 4.2, label)


def vdim(y1, y2, x, label, ref_x, small=False, label_dy=0, anchor="middle", side=-1):
    s = 1 if x > ref_x else -1
    for yy in (y1, y2):
        A(f'<line x1="{ref_x:.2f}" y1="{yy:.2f}" x2="{x+s*1.5:.2f}" y2="{yy:.2f}" stroke="{MUTE}" stroke-width="0.15"/>')
    if small:
        A(f'<line x1="{x:.2f}" y1="{y1-6:.2f}" x2="{x:.2f}" y2="{y1:.2f}" stroke="{INK}" stroke-width="0.25" marker-end="url(#ar)"/>')
        A(f'<line x1="{x:.2f}" y1="{y2+6:.2f}" x2="{x:.2f}" y2="{y2:.2f}" stroke="{INK}" stroke-width="0.25" marker-end="url(#ar)"/>')
    else:
        A(f'<line x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" stroke="{INK}" stroke-width="0.25" marker-start="url(#ar)" marker-end="url(#ar)"/>')
    txt(x + side * 1.4, (y1 + y2) / 2 + label_dy, label, rot=-90 if side < 0 else 90)


# overall widths along the top
hdim(0, FIELD_W, -14, f"Switch field {FIELD_W:.2f}  (21.25u)", -1)
hdim(-0.5, PLATE_W - 0.5, -24, f"Plate outline {PLATE_W:.2f}", -1)
hdim(cx0, cx0 + CASE_W, -34, f"Case outline {CASE_W:.1f}", cy0)
# and heights along the left
vdim(0, FIELD_H, -14, f"Switch field {FIELD_H:.2f}  (6.25u)", -1)
vdim(-0.5, PLATE_H - 0.5, -24, f"Plate outline {PLATE_H:.2f}", -1)
vdim(cy0, cy0 + CASE_H, -34, f"Case outline {CASE_H:.1f}", cx0)

# bottom: 1u pitch, rail gaps, main-to-arrow gap
yb = FIELD_H + 18
hdim(0, U, yb, "1u pitch = 19.05", FIELD_H, label_dx=22)
hdim(1.0 * U, 1.5 * U, yb + 11, "0.5u = 9.53", FIELD_H, small=True, label_dx=-16)
hdim(19.75 * U, 20.25 * U, yb + 11, "0.5u = 9.53", FIELD_H, small=True, label_dx=16)
hdim(16.5 * U, 16.75 * U, yb + 22, "0.25u = 4.76 (main to arrows)", FIELD_H, small=True, label_dx=-32)
# right side: top-row gap and roller module
xr = FIELD_W + 14
vdim(1.0 * U, 1.25 * U, xr, "0.25u = 4.76 (top row gap)", FIELD_W, small=True, label_dy=-22, side=1)
vdim(MOD_Y0, MOD_Y1, xr + 14, f"Roller module {MOD_Y1-MOD_Y0:.2f}", FIELD_W, side=1)
# roller module width and slot, inside the empty cell under the module
hdim(MOD_X0, MOD_X1, MOD_Y1 + 4.5, f"Module {MOD_X1-MOD_X0:.2f}", MOD_Y1)
hdim(BAR_CX - SLOT_W / 2, BAR_CX + SLOT_W / 2, BAR_CY + 13, f"Slot {SLOT_W:g}", BAR_CY + 6)
txt(BAR_CX + SLOT_W / 2 + 2.6, BAR_CY + 1.0, f"{SLOT_H:g}", 2.4, fill=INK)
txt(BAR_CX, MOD_Y0 + 9.5, f"axis y = {BAR_CY:.2f}   centre x = {BAR_CX:.2f}", 2.2, fill=MUTE)
A("</g>")

# title block
tx, ty = OX, OY + FIELD_H + 62
A(f'<g stroke="{INK}" stroke-width="0.3" fill="none"><rect x="{tx}" y="{ty}" width="170" height="42"/>'
  f'<line x1="{tx}" y1="{ty+12}" x2="{tx+170}" y2="{ty+12}"/></g>')
A(f'<text x="{tx+4}" y="{ty+8.5}" font-size="6" font-weight="bold" fill="{INK}">Omar keyboard: dimensioned top view</text>')
for i, s in enumerate(["Revision 3   Units: millimetres   1u = 19.05 mm   Drawn 1:1 (check bar below)",
                       "Origin: top-left corner of the top-left key unit (volume dial); x right, y toward the user.",
                       "Key caps drawn 1.05 mm under pitch; dashed squares are 14 x 14 mm plate cutouts;",
                       "orange circles and dashed lines are stabilizer wire positions and spans; numbered circles are 12 x O2.2 M2 holes."]):
    A(f'<text x="{tx+4}" y="{ty+18.5+i*5.4}" font-size="3.1" fill="{INK}">{ns(s)}</text>')
bx = tx + 190
A(f'<g stroke="{INK}" stroke-width="0.4"><line x1="{bx}" y1="{ty+30}" x2="{bx+100}" y2="{ty+30}"/>'
  f'<line x1="{bx}" y1="{ty+27}" x2="{bx}" y2="{ty+33}"/><line x1="{bx+100}" y1="{ty+27}" x2="{bx+100}" y2="{ty+33}"/></g>')
A(f'<text x="{bx+50}" y="{ty+26}" font-size="3.2" text-anchor="middle" fill="{INK}">100 mm</text>')
A("</svg>")
(ROOT / "docs/assets/omar-dimensions.svg").write_text("\n".join(svg) + "\n", encoding="utf-8", newline="\n")

# ------------------------------------------------------------ verify against spec
mism = []


def chk(name, got, want, tol=0.006):
    if abs(got - want) > tol:
        mism.append(f"{name}: computed {got:.3f}, spec {want}")


def pair(m):
    return float(m.group(1)), float(m.group(2))


# stabilizer table
for m in re.finditer(r"\| (Backspace|Enter|Left Shift|Right Shift|Space|Next Window) [\d.]+u \| \(([\d.]+), ([\d.]+)\) \| ([\d.]+) mm \|", spec):
    n = m.group(1)
    sx, sy, span = STABS[n]
    chk(f"stab {n} x", sx, float(m.group(2)))
    chk(f"stab {n} y", sy, float(m.group(3)))
    chk(f"stab {n} spacing", span, float(m.group(4)))
if len(re.findall(r"\| (?:Backspace|Enter|Left Shift|Right Shift|Space|Next Window) [\d.]+u \| \(", spec)) != 6:
    mism.append("stabilizer table: expected 6 rows")
# mounting holes
sec = spec.split("| Mounting hole | Position (mm) | Location |")[1].split("\n\n")[0]
spec_holes = [pair(m) for m in re.finditer(r"\(([\d.]+), ([\d.]+)\)", sec)]
if len(spec_holes) != 12:
    mism.append(f"mounting holes: spec lists {len(spec_holes)}, expected 12")
for i, ((hx, hy), (sx, sy)) in enumerate(zip(HOLES, spec_holes), 1):
    chk(f"hole {i} x", hx, sx)
    chk(f"hole {i} y", hy, sy)
# arrows
am = re.search(r"↑ centre \(([\d.]+), ([\d.]+)\), ← \(([\d.]+), ([\d.]+)\), ↓ \(([\d.]+), ([\d.]+)\), → \(([\d.]+), ([\d.]+)\)", spec)
if am:
    v = list(map(float, am.groups()))
    for n, (a, b) in zip("↑←↓→", [(v[0], v[1]), (v[2], v[3]), (v[4], v[5]), (v[6], v[7])]):
        chk(f"arrow {n} x", ARROWS[n][0], a)
        chk(f"arrow {n} y", ARROWS[n][1], b)
else:
    mism.append("arrow centres not found in spec")
# dials
dm = re.search(r"Volume \(([\d.]+), ([\d.]+)\)\. Brightness \(([\d.]+), ([\d.]+)\)", spec)
if dm:
    v = list(map(float, dm.groups()))
    chk("volume dial x", DIALS["Volume"][0], v[0]); chk("volume dial y", DIALS["Volume"][1], v[1])
    chk("brightness dial x", DIALS["Brightness"][0], v[2]); chk("brightness dial y", DIALS["Brightness"][1], v[3])
else:
    mism.append("dial centres not found in spec")
# overall sizes
fm = re.search(r"Switch field \| 21\.25u × 6\.25u = \*\*([\d.]+) × ([\d.]+) mm", spec)
if fm:
    chk("field width", FIELD_W, float(fm.group(1))); chk("field height", FIELD_H, float(fm.group(2)))
pm = re.search(r"Plate outline \| .*?\*\*([\d.]+) × ([\d.]+) mm", spec)
if pm:
    chk("plate width", PLATE_W, float(pm.group(1))); chk("plate height", PLATE_H, float(pm.group(2)))
cm = re.search(r"Case outside \| \*\*([\d.]+) × ([\d.]+) mm", spec)
if cm:
    chk("case width", CASE_W, float(cm.group(1)), 0.05); chk("case height", CASE_H, float(cm.group(2)), 0.05)
rm = re.search(r"Left rail centre line \| x = ([\d.]+) mm\. Right rail centre line x = ([\d.]+) mm", spec)
if rm:
    chk("left rail centre line", 0.5 * U, float(rm.group(1))); chk("right rail centre line", 20.75 * U, float(rm.group(2)))
mb = re.search(r"Main block \| x ([\d.]+)–([\d.]+) mm", spec)
if mb:
    chk("main block x0", 1.5 * U, float(mb.group(1))); chk("main block x1", 16.5 * U, float(mb.group(2)))
ac = re.search(r"Arrow cluster \| x ([\d.]+)–([\d.]+) mm", spec)
if ac:
    chk("arrow cluster x0", 16.75 * U, float(ac.group(1))); chk("arrow cluster x1", 19.75 * U, float(ac.group(2)))
if "0.5u = 9.53 mm" not in spec: mism.append("rail gap text 0.5u = 9.53 mm missing")
if "0.25u = 4.76 mm" not in spec: mism.append("0.25u = 4.76 mm text missing")
chk("0.5u in mm", 0.5 * U, 9.53); chk("0.25u in mm", 0.25 * U, 4.76)
# roller
rm1 = re.search(r"Module envelope \| x ([\d.]+)–([\d.]+) mm, y ([\d.]+)–([\d.]+) mm", spec)
if rm1:
    v = list(map(float, rm1.groups()))
    chk("module x0", MOD_X0, v[0]); chk("module x1", MOD_X1, v[1]); chk("module y0", MOD_Y0, v[2]); chk("module y1", MOD_Y1, v[3])
bm = re.search(r"x ([\d.]+)–([\d.]+) mm, axis at y = ([\d.]+) mm", spec)
if bm:
    v = list(map(float, bm.groups()))
    chk("barrel x0", BAR_X0, v[0]); chk("barrel x1", BAR_X1, v[1]); chk("barrel axis y", BAR_CY, v[2])
sm = re.search(r"centred on the barrel at \(([\d.]+), ([\d.]+)\)", spec)
if sm:
    chk("slot centre x", BAR_CX, float(sm.group(1))); chk("slot centre y", BAR_CY, float(sm.group(2)))
lm = re.search(r"x ([\d.]+)–([\d.]+) mm, holding an MR63ZZ", spec)
if lm:
    chk("left support x0", SUP_L0, float(lm.group(1))); chk("left support x1", SUP_L1, float(lm.group(2)))
em = re.search(r"Bracket and body x ([\d.]+)–([\d.]+) mm", spec)
if em:
    chk("encoder x0", ENC_X0, float(em.group(1))); chk("encoder x1", ENC_X1, float(em.group(2)))
# inventory table counts
for m in re.finditer(r"^\| ([\d.]+)u \| (\d+) \|", spec, re.M):
    wv, n = float(m.group(1)), int(m.group(2))
    if inv.get(wv, 0) != n:
        mism.append(f"inventory {wv}u: computed {inv.get(wv,0)}, spec {n}")
if "92 switch contacts" not in spec: mism.append("'92 switch contacts' missing in spec")
mm_ = re.search(r"Matrix \| (\d+) rows × (\d+) columns", spec)
if mm_ and (int(mm_.group(1)), int(mm_.group(2))) != (8, 12): mism.append("matrix size differs")

print()
print(f"keys {len(real)} + dial presses 2 = {len(keys)} contacts; width inventory {dict(sorted(inv.items()))}")
print(f"matrix: row 6 uses {sum(1 for p in matrix if p[0]==6)} cols, row 7 uses {sum(1 for p in matrix if p[0]==7)} cols")
print(f"case {CASE_W:.3f} x {CASE_H:.3f}, plate {PLATE_W:.3f} x {PLATE_H:.3f}, field {FIELD_W:.4f} x {FIELD_H:.4f}")
print(f"roller: module x {MOD_X0:.2f}-{MOD_X1:.2f} y {MOD_Y0:.2f}-{MOD_Y1:.2f}, barrel x {BAR_X0:.2f}-{BAR_X1:.2f} axis y {BAR_CY:.2f}, "
      f"slot centre ({BAR_CX:.2f}, {BAR_CY:.2f}), left support {SUP_L0:.2f}-{SUP_L1:.2f}, encoder {ENC_X0:.2f}-{ENC_X1:.2f}")
if mism:
    print(f"\nSPEC MISMATCHES ({len(mism)}):")
    for m in mism:
        print("  - " + m)
    sys.exit(1)
else:
    print("\nNo spec mismatches: stabilizers, holes, arrows, dials, sizes, roller and inventory all match hardware/specification.md.")
