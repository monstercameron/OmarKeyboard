#!/usr/bin/env python3
"""Render the KiCad 7 mainboard schematic sheets into themeable SVGs.

Standard library only (Pillow is used only for the optional --png check).
Colours are never written to the SVG; the page styles the classes:
sch-wire sch-bus sch-junction sch-nc sch-body sch-fill sch-solid sch-pin
sch-pin-num sch-pin-name sch-ref sch-val sch-label sch-glabel
sch-glabel-box sch-hlabel sch-hlabel-box sch-note sch-frame.

Usage:
  python build-site-schematics.py                 build everything
  python build-site-schematics.py --png NAME OUT  also rasterise one sheet
                                                  (NAME e.g. controller)
"""
import json
import math
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SRC = os.path.join(ROOT, "hardware", "mainboard-rev-b")
OUT = os.path.join(ROOT, "docs", "assets", "schematic")

SHEETS = [
    ("controller.svg", "Controller.kicad_sch"),
    ("power.svg", "Power.kicad_sch"),
    ("indicators.svg", "Indicators.kicad_sch"),
    ("matrix-1.svg", "Matrix_1.kicad_sch"),
    ("matrix-2.svg", "Matrix_2.kicad_sch"),
    ("matrix-3.svg", "Matrix_3.kicad_sch"),
    ("matrix-4.svg", "Matrix_4.kicad_sch"),
    ("lights-1.svg", "Bank_1.kicad_sch"),
    ("lights-2.svg", "Bank_2.kicad_sch"),
    ("lights-3.svg", "Bank_3.kicad_sch"),
    ("lights-4.svg", "Bank_4.kicad_sch"),
    ("lights-5.svg", "Bank_5.kicad_sch"),
    ("lights-6.svg", "Bank_6.kicad_sch"),
]

MARGIN = 4.0
CHAR_W = 0.68         # average glyph advance as a fraction of font size
MIRROR_AFTER = True   # mirror is applied after rotation (KiCad file semantics)
ROT_SIGN = 1          # +1: positive angle is counter-clockwise on screen

# ---------------------------------------------------------------- s-expr

TOK = re.compile(r'\(|\)|"(?:[^"\\]|\\.)*"|[^\s()"]+')


def parse(text):
    stack = [[]]
    for t in TOK.findall(text):
        if t == "(":
            stack.append([])
        elif t == ")":
            n = stack.pop()
            stack[-1].append(n)
        elif t[0] == '"':
            stack[-1].append(t[1:-1].replace('\\"', '"').replace("\\\\", "\\"))
        else:
            stack[-1].append(t)
    return stack[0][0]


def kids(node, name):
    return [c for c in node if isinstance(c, list) and c and c[0] == name]


def kid(node, name):
    for c in node:
        if isinstance(c, list) and c and c[0] == name:
            return c
    return None


def num(s, default=0.0):
    try:
        return float(s)
    except (TypeError, ValueError):
        return default


def xy_of(node, name):
    k = kid(node, name)
    return (num(k[1]), num(k[2])) if k else (0.0, 0.0)


def effects_info(eff):
    """-> (size, justify set, hide)"""
    size, just, hide = 1.27, set(), False
    if eff:
        f = kid(eff, "font")
        if f:
            s = kid(f, "size")
            if s:
                size = num(s[1], 1.27)
        j = kid(eff, "justify")
        if j:
            just = set(j[1:])
        for c in eff[1:]:
            if c == "hide":
                hide = True
            elif isinstance(c, list) and c and c[0] == "hide" and (len(c) < 2 or c[1] != "no"):
                hide = True
    return size, just, hide


def stroke_w(node, default):
    s = kid(node, "stroke")
    if s:
        w = kid(s, "width")
        if w and num(w[1]) > 0:
            return num(w[1])
    return default


def fill_kind(node):
    f = kid(node, "fill")
    if f:
        t = kid(f, "type")
        if t:
            return t[1]
    return "none"


# ---------------------------------------------------------------- numbers / svg

def fmt(v):
    s = "%.3f" % v
    s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def key(p):
    return (round(p[0] * 100), round(p[1] * 100))


# ---------------------------------------------------------------- transforms

def make_xf(at, angle, mirror):
    X, Y = at
    a = math.radians(angle * ROT_SIGN)
    c, s = math.cos(a), math.sin(a)

    def rot(x, y):
        return (x * c + y * s, -x * s + y * c)

    def mir(x, y):
        if mirror == "x":
            return (x, -y)
        if mirror == "y":
            return (-x, y)
        return (x, y)

    def pt(lx, ly):
        x, y = lx, -ly
        if MIRROR_AFTER:
            x, y = rot(x, y)
            x, y = mir(x, y)
        else:
            x, y = mir(x, y)
            x, y = rot(x, y)
        return (X + x, Y + y)

    def vec(dx, dy):
        o = pt(0, 0)
        p = pt(dx, dy)
        return (p[0] - o[0], p[1] - o[1])

    return pt, vec


# ---------------------------------------------------------------- display list

class Sheet:
    def __init__(self):
        self.items = []     # drawing order
        self.bb = [1e9, 1e9, -1e9, -1e9]
        self.wires = []
        self.pinpts = {}    # key -> info
        self.labelpts = {}  # key -> (text)
        self.junctions = []
        self.ncs = []
        self.nsym = 0
        self.nlabels = 0

    def grow(self, x, y):
        b = self.bb
        b[0] = min(b[0], x)
        b[1] = min(b[1], y)
        b[2] = max(b[2], x)
        b[3] = max(b[3], y)

    def path(self, pts, cls, width, closed=False, fill=False, group=None):
        for p in pts:
            self.grow(*p)
        self.items.append(dict(t="path", pts=pts, cls=cls, w=width, closed=closed, group=group))

    def circle(self, c, r, cls, width, group=None):
        self.grow(c[0] - r, c[1] - r)
        self.grow(c[0] + r, c[1] + r)
        self.items.append(dict(t="circle", c=c, r=r, cls=cls, w=width, group=group))

    def dot(self, c, r, cls):
        self.grow(c[0] - r, c[1] - r)
        self.grow(c[0] + r, c[1] + r)
        self.items.append(dict(t="dot", c=c, r=r, cls=cls, group=None))

    def text(self, s, p, size, ang, ha, va, cls, group=None, bbox=True):
        """ha in start/middle/end, va in top/center/bottom"""
        ang = ang % 360
        if ang in (180, 270):
            ang -= 180
            ha = {"start": "end", "end": "start", "middle": "middle"}[ha]
            va = {"top": "bottom", "bottom": "top", "center": "center"}[va]
        w = len(s) * size * CHAR_W
        x0 = {"start": 0, "middle": -w / 2, "end": -w}[ha]
        y0 = {"top": 0, "center": -size / 2, "bottom": -size}[va]
        if bbox:
            a = math.radians(ang)
            c, sn = math.cos(a), math.sin(a)
            for dx, dy in ((x0, y0), (x0 + w, y0), (x0, y0 + size), (x0 + w, y0 + size)):
                self.grow(p[0] + dx * c + dy * sn, p[1] - dx * sn + dy * c)
        self.items.append(dict(t="text", s=s, p=p, size=size, ang=ang, ha=ha, va=va,
                               cls=cls, group=group))


# ---------------------------------------------------------------- library

class LibSym:
    def __init__(self, node):
        self.name = node[1]
        self.hide_nums = False
        self.hide_names = False
        self.name_off = 0.508
        pn = kid(node, "pin_numbers")
        if pn and "hide" in pn[1:]:
            self.hide_nums = True
        pm = kid(node, "pin_names")
        if pm:
            if "hide" in pm[1:]:
                self.hide_names = True
            o = kid(pm, "offset")
            if o:
                self.name_off = num(o[1])
        self.graphics = []   # (unit, node)
        self.pins = []       # (unit, node)
        for sub in kids(node, "symbol"):
            m = re.search(r"_(\d+)_(\d+)$", sub[1])
            unit, style = (int(m.group(1)), int(m.group(2))) if m else (0, 1)
            if style not in (0, 1):
                continue
            for g in sub[2:]:
                if not isinstance(g, list) or not g:
                    continue
                if g[0] == "pin":
                    self.pins.append((unit, g))
                elif g[0] in ("rectangle", "polyline", "circle", "arc", "text"):
                    self.graphics.append((unit, g))


def arc_points(start, mid, end, n=24):
    ax, ay = start
    bx, by = mid
    cx, cy = end
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        return [start, end]
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    r = math.hypot(ax - ux, ay - uy)
    a0 = math.atan2(ay - uy, ax - ux)
    am = math.atan2(by - uy, bx - ux)
    a1 = math.atan2(cy - uy, cx - ux)

    def norm(a):
        while a < 0:
            a += 2 * math.pi
        while a >= 2 * math.pi:
            a -= 2 * math.pi
        return a
    ccw = norm(am - a0) < norm(a1 - a0)
    span = norm(a1 - a0) if ccw else -norm(a0 - a1)
    return [(ux + r * math.cos(a0 + span * i / n), uy + r * math.sin(a0 + span * i / n)) for i in range(n + 1)]


# ---------------------------------------------------------------- rendering

def render_sheet(path):
    tree = parse(open(path, encoding="utf-8").read())
    tb = kid(tree, "title_block")
    title = kid(tb, "title")[1] if tb and kid(tb, "title") else os.path.basename(path)
    lib = {}
    ls = kid(tree, "lib_symbols")
    for s in kids(ls, "symbol"):
        lib[s[1]] = LibSym(s)

    sh = Sheet()
    sh.title = title
    mcu_info = None

    # frame graphics (none expected; any non-symbol polyline/rectangle)
    for n in kids(tree, "polyline"):
        pts = [(num(p[1]), num(p[2])) for p in kid(n, "pts")[1:] if isinstance(p, list)]
        sh.path(pts, "sch-frame", stroke_w(n, 0.15))
    for n in kids(tree, "rectangle"):
        a, b = xy_of(n, "start"), xy_of(n, "end")
        sh.path([a, (b[0], a[1]), b, (a[0], b[1])], "sch-frame", stroke_w(n, 0.15), closed=True)

    # symbols
    for inst in kids(tree, "symbol"):
        lid = kid(inst, "lib_id")[1]
        ls_ = lib.get(lid)
        if ls_ is None:
            continue
        at = kid(inst, "at")
        pos = (num(at[1]), num(at[2]))
        ang = num(at[3]) if len(at) > 3 else 0.0
        mk = kid(inst, "mirror")
        mirror = mk[1] if mk else None
        unit = int(num(kid(inst, "unit")[1], 1)) if kid(inst, "unit") else 1
        pt, vec = make_xf(pos, ang, mirror)
        props = {p[1]: p for p in kids(inst, "property")}
        ref = props["Reference"][2] if "Reference" in props else ""
        sh.nsym += 1
        grp = ref
        is_mcu = lid == "Omar:MCU"

        for u, g in ls_.graphics:
            if u not in (0, unit):
                continue
            kind = g[0]
            fk = fill_kind(g)
            cls = "sch-body" + (" sch-fill" if fk == "background" else " sch-solid" if fk == "outline" else "")
            w = stroke_w(g, 0.2)
            if kind == "rectangle":
                a, b = xy_of(g, "start"), xy_of(g, "end")
                pts = [pt(a[0], a[1]), pt(b[0], a[1]), pt(b[0], b[1]), pt(a[0], b[1])]
                sh.path(pts, cls, w, closed=True, group=grp)
            elif kind == "polyline":
                raw = [(num(p[1]), num(p[2])) for p in kid(g, "pts")[1:] if isinstance(p, list)]
                pts = [pt(*p) for p in raw]
                closed = fk != "none" and len(raw) > 2
                if closed and raw[0] == raw[-1]:
                    pts = pts[:-1]
                sh.path(pts, cls, w, closed=closed, group=grp)
            elif kind == "circle":
                c = xy_of(g, "center")
                r = num(kid(g, "radius")[1])
                sh.circle(pt(*c), r, cls, w, group=grp)
            elif kind == "arc":
                pts = [pt(*p) for p in arc_points(xy_of(g, "start"), xy_of(g, "mid"), xy_of(g, "end"))]
                sh.path(pts, cls, w, closed=False, group=grp)
            elif kind == "text":
                size, just, hide = effects_info(kid(g, "effects"))
                a = kid(g, "at")
                p = pt(num(a[1]), num(a[2]))
                sh.text(g[1], p, size, num(a[3]) if len(a) > 3 else 0, "middle", "center", "sch-note", group=grp)

        for u, pn in ls_.pins:
            if u not in (0, unit):
                continue
            a = kid(pn, "at")
            lx, ly, pa = num(a[1]), num(a[2]), num(a[3])
            length = num(kid(pn, "length")[1])
            conn = pt(lx, ly)
            dx, dy = vec(math.cos(math.radians(pa)), math.sin(math.radians(pa)))
            dx, dy = round(dx, 6), round(dy, 6)
            end = (conn[0] + dx * length, conn[1] + dy * length)
            sh.path([conn, end], "sch-pin", 0.15, group=grp)
            nm = kid(pn, "name")
            nb = kid(pn, "number")
            name = nm[1] if nm else ""
            number = nb[1] if nb else ""
            if abs(dx) > abs(dy):
                side = "left" if dx > 0 else "right"
            else:
                side = "top" if dy > 0 else "bottom"
            sh.pinpts[key(conn)] = dict(ref=ref, number=number, name=name, side=side, conn=conn)
            if is_mcu:
                mcu_info = mcu_info or []
                mcu_info.append(dict(number=number, name=name, side=side, conn=conn))
            horiz = abs(dx) > abs(dy)
            if name and name != "~" and not ls_.hide_names:
                nsz, _, _ = effects_info(kid(nm, "effects"))
                d = length + ls_.name_off
                p = (conn[0] + dx * d, conn[1] + dy * d)
                if horiz:
                    sh.text(name, p, nsz, 0, "start" if dx > 0 else "end", "center", "sch-pin-name", group=grp)
                else:
                    sh.text(name, p, nsz, 90, "start" if dy < 0 else "end", "center", "sch-pin-name", group=grp)
            if number and not ls_.hide_nums:
                nsz, _, _ = effects_info(kid(nb, "effects"))
                mid = ((conn[0] + end[0]) / 2, (conn[1] + end[1]) / 2)
                off = nsz * 0.5 + 0.25
                if horiz:
                    sh.text(number, (mid[0], mid[1] - off), nsz, 0, "middle", "center", "sch-pin-num", group=grp)
                else:
                    sh.text(number, (mid[0] - off, mid[1]), nsz, 90, "middle", "center", "sch-pin-num", group=grp)

        for pname, p in props.items():
            size, just, hide = effects_info(kid(p, "effects"))
            if hide:
                continue
            val = p[2]
            if not val or val == "~" or val.startswith("#"):
                continue
            a = kid(p, "at")
            cls = "sch-ref" if pname == "Reference" else "sch-val" if pname == "Value" else "sch-val"
            ha = "start" if "left" in just else "end" if "right" in just else "middle"
            va = "top" if "top" in just else "bottom" if "bottom" in just else "center"
            sh.text(val, (num(a[1]), num(a[2])), size, num(a[3]) if len(a) > 3 else 0, ha, va, cls, group=grp)

    # wires
    for w in kids(tree, "wire"):
        pts = [(num(p[1]), num(p[2])) for p in kid(w, "pts")[1:] if isinstance(p, list)]
        sh.wires.append(pts)
        sh.path(pts, "sch-wire", stroke_w(w, 0.15))
    for w in kids(tree, "bus"):
        pts = [(num(p[1]), num(p[2])) for p in kid(w, "pts")[1:] if isinstance(p, list)]
        sh.path(pts, "sch-bus", stroke_w(w, 0.3))

    for j in kids(tree, "junction"):
        p = xy_of(j, "at")
        sh.junctions.append(p)
        dia = num(kid(j, "diameter")[1]) if kid(j, "diameter") else 0
        sh.dot(p, (dia or 0.9) / 2, "sch-junction")

    for n in kids(tree, "no_connect"):
        p = xy_of(n, "at")
        sh.ncs.append(p)
        r = 0.6
        sh.path([(p[0] - r, p[1] - r), (p[0] + r, p[1] + r)], "sch-nc", 0.15)
        sh.path([(p[0] - r, p[1] + r), (p[0] + r, p[1] - r)], "sch-nc", 0.15)

    # labels
    for n in kids(tree, "label") + kids(tree, "global_label") + kids(tree, "hierarchical_label"):
        kind = n[0]
        a = kid(n, "at")
        p = (num(a[1]), num(a[2]))
        ang = num(a[3]) if len(a) > 3 else 0.0
        size, just, hide = effects_info(kid(n, "effects"))
        txt = n[1]
        shape = kid(n, "shape")[1] if kid(n, "shape") else "passive"
        sh.nlabels += 1
        sh.labelpts[key(p)] = txt
        a_r = math.radians(ang)
        ux, uy = math.cos(a_r), -math.sin(a_r)   # direction the label extends (screen)
        if kind == "label":
            # text sits just above the wire, starting at the anchor
            off = 0.4
            nx, ny = uy, -ux    # perpendicular, "up" relative to text
            q = (p[0] + nx * off if False else p[0], p[1])
            if ang % 180 == 0:
                sh.text(txt, (p[0] + (0.4 if ang % 360 == 0 else -0.4), p[1] - 0.35), size,
                        0, "start" if ang % 360 == 0 else "end", "bottom", "sch-label")
            else:
                sh.text(txt, (p[0] - 0.35, p[1] + (-0.4 if ang % 360 == 90 else 0.4)), size,
                        90, "start" if ang % 360 == 90 else "end", "bottom", "sch-label")
            continue
        hh = size * (0.75 if kind == "global_label" else 0.6)
        tw = len(txt) * size * CHAR_W
        W = tw + 2 * hh
        if shape == "input":
            poly = [(0, 0), (hh, -hh), (W, -hh), (W, hh), (hh, hh)]
        elif shape == "output":
            poly = [(0, -hh), (W - hh, -hh), (W, 0), (W - hh, hh), (0, hh)]
        elif shape in ("bidirectional", "tri_state"):
            poly = [(0, 0), (hh, -hh), (W - hh, -hh), (W, 0), (W - hh, hh), (hh, hh)]
        else:
            poly = [(0, -hh), (W, -hh), (W, hh), (0, hh)]
        # local frame: +x extends away from the anchor along (ux, uy)
        pts = [(p[0] + lx * ux - ly * uy, p[1] + lx * uy + ly * ux) for lx, ly in poly]
        cls_t, cls_b = ("sch-glabel", "sch-glabel-box") if kind == "global_label" else ("sch-hlabel", "sch-hlabel-box")
        sh.path(pts, cls_b, 0.15, closed=True)
        tp = (p[0] + ux * hh, p[1] + uy * hh)
        if ang % 180 == 0:
            sh.text(txt, tp, size, 0, "start" if ang % 360 == 0 else "end", "center", cls_t)
        else:
            sh.text(txt, tp, size, 90, "start" if ang % 360 == 90 else "end", "center", cls_t)

    # free text
    for n in kids(tree, "text"):
        a = kid(n, "at")
        size, just, hide = effects_info(kid(n, "effects"))
        ha = "start" if "left" in just else "end" if "right" in just else "middle"
        va = "top" if "top" in just else "bottom" if "bottom" in just else "center"
        cls = "sch-note" + (" sch-heading" if n[1] == title else "")
        for i, line in enumerate(n[1].split("\n")):
            sh.text(line, (num(a[1]), num(a[2]) + i * size * 1.4), size, num(a[3]) if len(a) > 3 else 0, ha, va, cls)

    sh.mcu = mcu_info
    return sh


# ---------------------------------------------------------------- analysis

def seg_has(seg, p, tol=0.02):
    (x1, y1), (x2, y2) = seg
    if abs(x1 - x2) < 1e-6 and abs(p[0] - x1) < tol:
        return min(y1, y2) - tol <= p[1] <= max(y1, y2) + tol
    if abs(y1 - y2) < 1e-6 and abs(p[1] - y1) < tol:
        return min(x1, x2) - tol <= p[0] <= max(x1, x2) + tol
    return False


def dangling(sh):
    pts = set(sh.pinpts) | set(sh.labelpts) | {key(p) for p in sh.junctions} | {key(p) for p in sh.ncs}
    count = 0
    for i, w in enumerate(sh.wires):
        for end in (w[0], w[-1]):
            k = key(end)
            if k in pts:
                continue
            hit = False
            for j, o in enumerate(sh.wires):
                if j == i:
                    continue
                for a, b in zip(o, o[1:]):
                    if seg_has((a, b), end):
                        hit = True
                        break
                if hit:
                    break
            if not hit:
                count += 1
    return count


def mcu_pins(sh):
    # wire graph connectivity
    res = []
    for pin in sorted(sh.mcu or [], key=lambda d: int(d["number"]) if d["number"].isdigit() else 0):
        k0 = key(pin["conn"])
        net = None
        if any(key(p) == k0 for p in sh.ncs):
            net = "NC"
        else:
            seen = {k0}
            frontier = [k0]
            while frontier and net is None:
                k = frontier.pop()
                if k in sh.labelpts:
                    net = sh.labelpts[k]
                    break
                for w in sh.wires:
                    ks = [key(q) for q in w]
                    if k in ks:
                        for q in ks:
                            if q not in seen:
                                seen.add(q)
                                frontier.append(q)
        res.append(dict(number=pin["number"], name=pin["name"], net=net, side=pin["side"]))
    return res


# ---------------------------------------------------------------- svg out

def to_svg(sh):
    x0, y0, x1, y1 = sh.bb
    x0 -= MARGIN
    y0 -= MARGIN
    x1 += MARGIN
    y1 += MARGIN
    W, H = x1 - x0, y1 - y0
    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" class="sch" role="img" viewBox="%s %s %s %s">'
             % (fmt(x0), fmt(y0), fmt(W), fmt(H)))
    o.append("<title>%s</title>" % esc(sh.title))
    cur = None
    for it in sh.items:
        g = it.get("group")
        if g != cur:
            if cur is not None:
                o.append("</g>")
            if g:
                o.append('<g class="sch-symbol" data-ref="%s">' % esc(g))
            cur = g if g else None
        if it["t"] == "path":
            d = "M" + " L".join("%s %s" % (fmt(x), fmt(y)) for x, y in it["pts"])
            if it["closed"]:
                d += " Z"
            fillnone = ' fill="none"' if ("sch-fill" not in it["cls"] and "sch-solid" not in it["cls"]
                                          and "box" not in it["cls"]) else ""
            o.append('<path class="%s" d="%s" stroke-width="%s"%s/>' % (it["cls"], d, fmt(it["w"]), fillnone))
        elif it["t"] == "circle":
            fillnone = ' fill="none"' if ("sch-fill" not in it["cls"] and "sch-solid" not in it["cls"]) else ""
            o.append('<circle class="%s" cx="%s" cy="%s" r="%s" stroke-width="%s"%s/>'
                     % (it["cls"], fmt(it["c"][0]), fmt(it["c"][1]), fmt(it["r"]), fmt(it["w"]), fillnone))
        elif it["t"] == "dot":
            o.append('<circle class="%s" cx="%s" cy="%s" r="%s"/>'
                     % (it["cls"], fmt(it["c"][0]), fmt(it["c"][1]), fmt(it["r"])))
        elif it["t"] == "text":
            base = {"top": "hanging", "center": "central", "bottom": "text-after-edge"}[it["va"]]
            tr = ' transform="rotate(%s %s %s)"' % (fmt(-it["ang"]), fmt(it["p"][0]), fmt(it["p"][1])) if it["ang"] else ""
            o.append('<text class="%s" x="%s" y="%s" font-size="%s" text-anchor="%s" dominant-baseline="%s"%s>%s</text>'
                     % (it["cls"], fmt(it["p"][0]), fmt(it["p"][1]), fmt(it["size"]), it["ha"], base, tr, esc(it["s"])))
    if cur is not None:
        o.append("</g>")
    o.append("</svg>")
    return "\n".join(o) + "\n", (x0, y0, W, H)


def raster(sh, vb, out, scale=14):
    from PIL import Image, ImageDraw, ImageFont
    x0, y0, W, H = vb
    img = Image.new("RGB", (int(W * scale), int(H * scale)), "white")
    d = ImageDraw.Draw(img)
    T = lambda p: ((p[0] - x0) * scale, (p[1] - y0) * scale)
    colors = {"sch-wire": (0, 130, 0), "sch-body": (130, 0, 0), "sch-pin": (130, 0, 0), "sch-nc": (0, 0, 200),
              "sch-glabel-box": (140, 60, 0), "sch-hlabel-box": (140, 60, 0), "sch-frame": (90, 90, 90)}
    tcol = {"sch-ref": (0, 90, 120), "sch-val": (0, 90, 120), "sch-pin-num": (150, 0, 0), "sch-pin-name": (0, 80, 80),
            "sch-glabel": (140, 60, 0), "sch-label": (0, 0, 0), "sch-note": (0, 0, 0)}
    for it in sh.items:
        cls = it["cls"].split()
        if it["t"] == "path":
            col = next((colors[c] for c in cls if c in colors), (0, 0, 0))
            pts = [T(p) for p in it["pts"]]
            if it["closed"]:
                pts.append(pts[0])
            d.line(pts, fill=col, width=max(1, int(it["w"] * scale)))
        elif it["t"] == "circle":
            cx, cy = T(it["c"])
            r = it["r"] * scale
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(130, 0, 0))
        elif it["t"] == "dot":
            cx, cy = T(it["c"])
            r = it["r"] * scale
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 130, 0))
        else:
            col = next((tcol[c] for c in cls if c in tcol), (0, 0, 0))
            px = max(6, int(it["size"] * scale * 1.1))
            try:
                font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", px)
            except Exception:
                font = ImageFont.load_default()
            tw = int(d.textlength(it["s"], font=font)) + 4
            th = px + 4
            tile = Image.new("RGBA", (tw, th), (255, 255, 255, 0))
            ImageDraw.Draw(tile).text((2, 0), it["s"], font=font, fill=col + (255,))
            ax = {"start": 2, "middle": tw / 2, "end": tw - 2}[it["ha"]]
            ay = {"top": 0, "center": th / 2, "bottom": th - 2}[it["va"]]
            tile = tile.rotate(it["ang"], expand=True, resample=Image.BICUBIC, center=(ax, ay))
            # after rotating about the anchor with expand, find anchor position
            ang = math.radians(it["ang"])
            cw, ch = tw, th
            # corner-based placement: rotate anchor offset from tile centre
            ox, oy = ax - cw / 2, ay - ch / 2
            rx = ox * math.cos(ang) + oy * math.sin(ang)
            ry = -ox * math.sin(ang) + oy * math.cos(ang)
            px0, py0 = T(it["p"])
            img.paste(tile, (int(px0 - rx - tile.width / 2), int(py0 - ry - tile.height / 2)), tile)
    img.save(out)


# ---------------------------------------------------------------- main

def main(argv):
    os.makedirs(OUT, exist_ok=True)
    png = None
    if "--png" in argv:
        i = argv.index("--png")
        png = (argv[i + 1], argv[i + 2])
    index = []
    stats = []
    for svg, src in SHEETS:
        sh = render_sheet(os.path.join(SRC, src))
        text, vb = to_svg(sh)
        with open(os.path.join(OUT, svg), "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        index.append(dict(file=svg, title=sh.title, symbols=sh.nsym, wires=len(sh.wires), labels=sh.nlabels))
        dg = dangling(sh)
        stats.append((svg, sh.nsym, len(sh.wires), sh.nlabels, dg, len(text.encode("utf-8"))))
        if svg == "controller.svg":
            pins = mcu_pins(sh)
            with open(os.path.join(OUT, "mcu-pins.json"), "w", encoding="utf-8", newline="\n") as f:
                json.dump(pins, f, indent=1)
                f.write("\n")
            ctrl_pins = pins
        if png and png[0] + ".svg" == svg:
            raster(sh, vb, png[1])
    with open(os.path.join(OUT, "sheets.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, indent=1)
        f.write("\n")
    print("%-14s %5s %5s %6s %9s %8s" % ("sheet", "syms", "wires", "labels", "dangling", "bytes"))
    for s in stats:
        print("%-14s %5d %5d %6d %9d %8d" % s)
    print("mcu pins:", len(ctrl_pins))
    gp = {}
    for p in ctrl_pins:
        m = re.match(r"GPIO(\d+)", p["name"])
        if m:
            gp["GPIO" + m.group(1)] = p["net"]
    print(" ".join("%s=%s" % (k[4:], gp.get("GPIO" + k[4:])) for k in sorted(gp, key=lambda s: int(s[4:]))))


if __name__ == "__main__":
    main(sys.argv[1:])
