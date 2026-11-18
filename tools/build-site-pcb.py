#!/usr/bin/env python3
"""Build a themeable SVG + JSON of the Omar mainboard for the product page.

Reads hardware/mainboard/omar-mainboard.kicad_pcb (KiCad 7) and writes
docs/assets/omar-mainboard.svg and docs/assets/omar-mainboard.json.
Standard library only; an optional --raster PATH draws a check image with Pillow.
"""
import heapq
import json
import math
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
# The page shows the build revision, Rev B.1.
PCB = os.path.join(ROOT, "hardware", "mainboard-rev-b", "omar-mainboard.kicad_pcb")
OUT_SVG = os.path.join(ROOT, "docs", "assets", "omar-mainboard.svg")
OUT_JSON = os.path.join(ROOT, "docs", "assets", "omar-mainboard.json")

PART_REFS = (["U1", "U2", "U3", "U4", "U5", "Y1", "J1", "J2", "ENC1", "ENC2", "SW93", "SW94"]
             + ["LED%d" % i for i in range(1, 91)] + ["TP%d" % i for i in range(1, 8)]
             + ["R1", "R2"])


# ----------------------------------------------------------------- parsing
TOK = re.compile(r'\(|\)|"(?:[^"\\]|\\.)*"|[^\s()"]+')


def parse(text):
    stack = [[]]
    for m in TOK.finditer(text):
        t = m.group(0)
        if t == "(":
            n = []
            stack[-1].append(n)
            stack.append(n)
        elif t == ")":
            stack.pop()
        elif t[0] == '"':
            stack[-1].append(t[1:-1])
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


def fl(s):
    return float(s)


def r2(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


# --------------------------------------------------------------- transform
def xform(fp, lx, ly):
    a = math.radians(fp["angle"])
    c, s = math.cos(a), math.sin(a)
    return (fp["x"] + lx * c + ly * s, fp["y"] - lx * s + ly * c)


def load_board():
    root = parse(open(PCB, encoding="utf-8").read())
    nets = {0: ""}
    for n in kids(root, "net"):
        nets[int(n[1])] = n[2]
    fps = []
    for f in kids(root, "footprint"):
        at = kid(f, "at")
        fp = {"node": f, "name": f[1], "layer": kid(f, "layer")[1],
              "x": fl(at[1]), "y": fl(at[2]), "angle": fl(at[3]) if len(at) > 3 else 0.0,
              "ref": "", "value": ""}
        for t in kids(f, "fp_text"):
            if t[1] == "reference":
                fp["ref"] = t[2]
            elif t[1] == "value":
                fp["value"] = t[2]
        for p in kids(f, "property"):
            if p[1] == "Reference":
                fp["ref"] = p[2]
            elif p[1] == "Value":
                fp["value"] = p[2]
        fp["pads"] = [read_pad(fp, p, nets) for p in kids(f, "pad")]
        fps.append(fp)
    return root, nets, fps


def read_pad(fp, p, nets):
    at = kid(p, "at")
    lx, ly = fl(at[1]), fl(at[2])
    ang = fl(at[3]) if len(at) > 3 else 0.0
    size = kid(p, "size")
    w, h = fl(size[1]), fl(size[2] if len(size) > 2 else size[1])
    x, y = xform(fp, lx, ly)
    d = kid(p, "drill")
    drill = None
    if d:
        v = [t for t in d[1:] if not isinstance(t, list)]
        if v and v[0] == "oval":
            drill = (fl(v[1]), fl(v[2]))
        elif v:
            drill = (fl(v[0]), fl(v[0]))
    layers = kid(p, "layers")[1:]
    net = kid(p, "net")
    rr = kid(p, "roundrect_rratio")
    return {"num": p[1], "type": p[2], "shape": p[3], "lx": lx, "ly": ly, "x": x, "y": y,
            "angle": ang, "w": w, "h": h, "drill": drill, "layers": layers,
            "net": nets.get(int(net[1]), "") if net else "",
            "rratio": fl(rr[1]) if rr else 0.25, "ref": fp["ref"], "fp": fp}


def pad_side(p):
    ls = p["layers"]
    if p["type"] == "np_thru_hole":
        return "np"
    if "*.Cu" in ls or ("F.Cu" in ls and "B.Cu" in ls):
        return "th"
    return "f" if "F.Cu" in ls else "b"


def inside_pad(p, x, y, tol=0.0):
    dx, dy = x - p["x"], y - p["y"]
    a = math.radians(p["angle"])
    c, s = math.cos(a), math.sin(a)
    lx = dx * c - dy * s
    ly = dx * s + dy * c
    if p["shape"] == "circle" and abs(p["w"] - p["h"]) < 1e-6:
        return math.hypot(lx, ly) <= p["w"] / 2 + tol
    return abs(lx) <= p["w"] / 2 + tol and abs(ly) <= p["h"] / 2 + tol


# -------------------------------------------------------------- board edge
def arc_geom(p0, pm, p1):
    ax, ay = p0
    bx, by = pm
    cx, cy = p1
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        return None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay)
          + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx)
          + (cx * cx + cy * cy) * (bx - ax)) / d
    r = math.hypot(ax - ux, ay - uy)
    cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx)
    sweep = 1 if cross > 0 else 0
    a0 = math.atan2(ay - uy, ax - ux)
    a1 = math.atan2(cy - uy, cx - ux)
    span = (a1 - a0) % (2 * math.pi) if sweep else (a0 - a1) % (2 * math.pi)
    return (ux, uy, r, 1 if span > math.pi else 0, sweep, a0, span)


def arc_points(p0, pm, p1, n=48):
    g = arc_geom(p0, pm, p1)
    if g is None:
        return [p0, p1]
    ux, uy, r, large, sweep, a0, span = g
    pts = []
    for i in range(n + 1):
        t = a0 + (span * i / n) * (1 if sweep else -1)
        pts.append((ux + r * math.cos(t), uy + r * math.sin(t)))
    return pts


def edge_loops(root, fps):
    """Return closed loops, each [(x, y, arcinfo_to_here)]; arcinfo=(r,large,sweep)|None."""
    pieces = []   # (p0, p1, arc|None, mid|None)
    loops = []

    def add_item(it, tf):
        k = it[0]
        if k in ("gr_line", "fp_line"):
            pieces.append((tf(*pt(it, "start")), tf(*pt(it, "end")), None, None))
        elif k in ("gr_arc", "fp_arc"):
            p0, pm, p1 = tf(*pt(it, "start")), tf(*pt(it, "mid")), tf(*pt(it, "end"))
            g = arc_geom(p0, pm, p1)
            pieces.append((p0, p1, (g[2], g[3], g[4]) if g else None, pm))
        elif k in ("gr_rect", "fp_rect"):
            (x0, y0), (x1, y1) = pt(it, "start"), pt(it, "end")
            cs = [tf(x0, y0), tf(x1, y0), tf(x1, y1), tf(x0, y1)]
            loops.append([(cs[0][0], cs[0][1], None)] + [(c[0], c[1], None) for c in cs[1:]])
        elif k in ("gr_circle", "fp_circle"):
            (cx, cy), (ex, ey) = pt(it, "center"), pt(it, "end")
            r = math.hypot(ex - cx, ey - cy)
            a, b = tf(cx + r, cy), tf(cx - r, cy)
            loops.append([("circle", a, b, r)])
        elif k in ("gr_poly", "fp_poly"):
            ps = [tf(fl(q[1]), fl(q[2])) for q in kid(it, "pts") if isinstance(q, list) and q[0] == "xy"]
            loops.append([(p[0], p[1], None) for p in ps])

    def pt(it, name):
        n = kid(it, name)
        return fl(n[1]), fl(n[2])

    def on_edge(it):
        l = kid(it, "layer")
        return l and l[1] == "Edge.Cuts"

    ident = lambda x, y: (x, y)
    for it in root:
        if isinstance(it, list) and it and it[0].startswith("gr_") and on_edge(it):
            add_item(it, ident)
    for fp in fps:
        tf = (lambda fp: (lambda x, y: xform(fp, x, y)))(fp)
        for it in fp["node"]:
            if isinstance(it, list) and it and it[0].startswith("fp_") and on_edge(it):
                add_item(it, tf)

    # chain pieces
    tol = 0.01
    close = lambda a, b: abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol
    left = list(pieces)
    while left:
        p0, p1, arc, mid = left.pop(0)
        loop = [(p0[0], p0[1], None), (p1[0], p1[1], arc)]
        cur = p1
        while not close(cur, p0):
            for i, (a, b, ar, m) in enumerate(left):
                if close(a, cur):
                    loop.append((b[0], b[1], ar))
                    cur = b
                    left.pop(i)
                    break
                if close(b, cur):
                    loop.append((a[0], a[1], (ar[0], ar[1], 1 - ar[2]) if ar else None))
                    cur = a
                    left.pop(i)
                    break
            else:
                break
        loops.append(loop)
    return loops


def loops_to_path(loops):
    d = []
    for lp in loops:
        if lp[0][0] == "circle":
            _, a, b, r = lp[0]
            d.append("M%s %sA%s %s 0 1 0 %s %sA%s %s 0 1 0 %s %sZ" % (
                r2(a[0]), r2(a[1]), r2(r), r2(r), r2(b[0]), r2(b[1]), r2(r), r2(r), r2(a[0]), r2(a[1])))
            continue
        s = "M%s %s" % (r2(lp[0][0]), r2(lp[0][1]))
        for x, y, arc in lp[1:]:
            if arc:
                s += "A%s %s 0 %d %d %s %s" % (r2(arc[0]), r2(arc[0]), arc[1], arc[2], r2(x), r2(y))
            else:
                s += "L%s %s" % (r2(x), r2(y))
        d.append(s + "Z")
    return "".join(d)


def loops_bbox(loops):
    xs, ys = [], []
    for lp in loops:
        if lp[0][0] == "circle":
            _, a, b, r = lp[0]
            cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            xs += [cx - r, cx + r]
            ys += [cy - r, cy + r]
            continue
        for i, (x, y, arc) in enumerate(lp):
            xs.append(x)
            ys.append(y)
            if arc and i > 0:
                px, py = lp[i - 1][0], lp[i - 1][1]
                # sample via circle centre
                r, large, sweep = arc
                mx, my = (px + x) / 2, (py + y) / 2
                dd = math.hypot(x - px, y - py)
                h = math.sqrt(max(r * r - dd * dd / 4, 0))
                nx, ny = -(y - py) / dd, (x - px) / dd
                for sg in (1, -1):
                    cx, cy = mx + sg * h * nx, my + sg * h * ny
                    # choose centre consistent with flags
                    a0 = math.atan2(py - cy, px - cx)
                    a1 = math.atan2(y - cy, x - cx)
                    span = (a1 - a0) % (2 * math.pi) if sweep else (a0 - a1) % (2 * math.pi)
                    if (1 if span > math.pi else 0) == large:
                        for k in range(49):
                            t = a0 + (span * k / 48) * (1 if sweep else -1)
                            xs.append(cx + r * math.cos(t))
                            ys.append(cy + r * math.sin(t))
                        break
    return min(xs), min(ys), max(xs), max(ys)


# ------------------------------------------------------------------ tracks
def read_tracks(root, nets):
    segs, vias, narcs = [], [], 0
    for s in kids(root, "segment"):
        a, b = kid(s, "start"), kid(s, "end")
        segs.append({"p0": (fl(a[1]), fl(a[2])), "p1": (fl(b[1]), fl(b[2])),
                     "w": fl(kid(s, "width")[1]), "layer": kid(s, "layer")[1],
                     "net": nets.get(int(kid(s, "net")[1]), "")})
    for s in kids(root, "arc"):
        narcs += 1
        a, m, b = kid(s, "start"), kid(s, "mid"), kid(s, "end")
        pa, pm, pb = (fl(a[1]), fl(a[2])), (fl(m[1]), fl(m[2])), (fl(b[1]), fl(b[2]))
        base = {"w": fl(kid(s, "width")[1]), "layer": kid(s, "layer")[1],
                "net": nets.get(int(kid(s, "net")[1]), "")}
        segs.append(dict(base, p0=pa, p1=pm))
        segs.append(dict(base, p0=pm, p1=pb))
    for v in kids(root, "via"):
        at = kid(v, "at")
        dr = kid(v, "drill")
        vias.append({"x": fl(at[1]), "y": fl(at[2]), "size": fl(kid(v, "size")[1]),
                     "drill": fl(dr[1]) if dr else 0.0,
                     "net": nets.get(int(kid(v, "net")[1]), "") if kid(v, "net") else ""})
    return segs, vias, narcs


def key(p):
    return (round(p[0], 3), round(p[1], 3))


def merge_tracks(segs):
    groups = {}
    for s in segs:
        if key(s["p0"]) == key(s["p1"]):
            continue
        groups.setdefault((s["layer"], s["net"], s["w"]), []).append(s)
    out = []  # (layer, net, width, [points])
    for (layer, net, w), ss in groups.items():
        adj = {}
        for i, s in enumerate(ss):
            adj.setdefault(key(s["p0"]), []).append(i)
            adj.setdefault(key(s["p1"]), []).append(i)
        used = [False] * len(ss)

        def walk(start_node, first):
            pts = [start_node]
            node, e = start_node, first
            while True:
                used[e] = True
                s = ss[e]
                nxt = key(s["p1"]) if key(s["p0"]) == node else key(s["p0"])
                pts.append(nxt)
                node = nxt
                if len(adj[node]) != 2:
                    break
                cand = [x for x in adj[node] if not used[x]]
                if not cand:
                    break
                e = cand[0]
            return pts

        for node, es in adj.items():
            if len(es) != 2:
                for e in es:
                    if not used[e]:
                        out.append((layer, net, w, walk(node, e)))
        for e in range(len(ss)):
            if not used[e]:
                out.append((layer, net, w, walk(key(ss[e]["p0"]), e)))
    return out


# ------------------------------------------------------------------- flows
def simplify(pts):
    out = []
    for p in pts:
        if out and abs(out[-1][0] - p[0]) < 1e-6 and abs(out[-1][1] - p[1]) < 1e-6:
            continue
        out.append(p)
    res = [out[0]] if out else []
    for i in range(1, len(out) - 1):
        a, b, c = res[-1], out[i], out[i + 1]
        cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        dt = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])
        if abs(cr) < 1e-6 and dt > 0:
            continue
        res.append(b)
    if len(out) > 1:
        res.append(out[-1])
    return res


class Router:
    def __init__(self, segs, vias, pads):
        self.segs, self.vias, self.pads = segs, vias, pads

    def route(self, net, src, dst):
        """Shortest copper route on `net` from pad src to pad dst; returns points or None."""
        adj = {}

        def edge(a, b, w):
            adj.setdefault(a, []).append((b, w))
            adj.setdefault(b, []).append((a, w))

        ends = {}
        for s in self.segs:
            if s["net"] != net:
                continue
            a = (s["layer"],) + key(s["p0"])
            b = (s["layer"],) + key(s["p1"])
            edge(a, b, math.hypot(s["p0"][0] - s["p1"][0], s["p0"][1] - s["p1"][1]))
            ends[a] = s["p0"]
            ends[b] = s["p1"]
        for v in self.vias:
            if v["net"] != net:
                continue
            k = key((v["x"], v["y"]))
            edge(("F.Cu",) + k, ("B.Cu",) + k, 0.1)
        # tolerant via joins
        for v in self.vias:
            if v["net"] != net:
                continue
            for layer in ("F.Cu", "B.Cu"):
                if ((layer,) + key((v["x"], v["y"]))) not in adj:
                    best = None
                    for n in list(ends):
                        if n[0] == layer:
                            d = math.hypot(n[1] - v["x"], n[2] - v["y"])
                            if d < 0.05 and (best is None or d < best[0]):
                                best = (d, n)
                    if best:
                        edge(("F.Cu",) + key((v["x"], v["y"])) if layer == "B.Cu" else best[1], best[1] if layer == "B.Cu" else ("B.Cu",) + key((v["x"], v["y"])), 0.1)

        def attach(p, tag):
            node = ("pad", tag)
            side = pad_side(p)
            layers = {"f": ["F.Cu"], "b": ["B.Cu"], "th": ["F.Cu", "B.Cu"]}.get(side, [])
            hit = [n for n in ends if n[0] in layers and inside_pad(p, n[1], n[2], 0.02)]
            if not hit:
                cand = sorted((math.hypot(n[1] - p["x"], n[2] - p["y"]), n) for n in ends if n[0] in layers)
                hit = [n for d, n in cand if d < 1.5][:1]
            for n in hit:
                edge(node, n, 0.0)
            return node if hit else None

        a, b = attach(src, "src"), attach(dst, "dst")
        if not a or not b:
            return None
        dist = {a: 0.0}
        prev = {}
        pq = [(0.0, 0, a)]
        cnt = 1
        while pq:
            d, _, n = heapq.heappop(pq)
            if n == b:
                break
            if d > dist.get(n, 1e18):
                continue
            for m, w in adj.get(n, []):
                nd = d + w
                if nd < dist.get(m, 1e18):
                    dist[m] = nd
                    prev[m] = n
                    heapq.heappush(pq, (nd, cnt, m))
                    cnt += 1
        if b not in dist:
            return None
        path = [b]
        while path[-1] != a:
            path.append(prev[path[-1]])
        path.reverse()
        pts = [(src["x"], src["y"])]
        for n in path[1:-1]:
            pts.append((n[1], n[2]))
        pts.append((dst["x"], dst["y"]))
        return pts, dist[b]


def best_route(router, net, srcs, dsts):
    best = None
    for s in srcs:
        for d in dsts:
            r = router.route(net, s, d)
            if r and (best is None or r[1] < best[1][1]):
                best = ((s, d), r)
    return best


# --------------------------------------------------------------------- main
def main():
    raster = None
    if "--raster" in sys.argv:
        raster = sys.argv[sys.argv.index("--raster") + 1]
    root, nets, fps = load_board()
    byref = {f["ref"]: f for f in fps if f["ref"]}
    allpads = [p for f in fps for p in f["pads"]]
    padsby_net = {}
    for p in allpads:
        if p["net"]:
            padsby_net.setdefault(p["net"], []).append(p)

    loops = edge_loops(root, fps)
    bx0, by0, bx1, by1 = loops_bbox(loops)
    vx0, vy0, vx1, vy1 = bx0 - 2, by0 - 2, bx1 + 2, by1 + 2
    W, H = vx1 - vx0, vy1 - vy0

    segs, vias, narcs = read_tracks(root, nets)
    merged = merge_tracks(segs)

    # zones
    zone_paths = {"B.Cu": [], "F.Cu": []}
    for z in kids(root, "zone"):
        for fpoly in kids(z, "filled_polygon"):
            layer = kid(fpoly, "layer")[1]
            pts = [(fl(q[1]), fl(q[2])) for q in kid(fpoly, "pts") if isinstance(q, list) and q[0] == "xy"]
            if len(pts) < 3 or layer not in zone_paths:
                continue
            zone_paths[layer].append("M" + " ".join("%s %s" % (r2(x), r2(y)) for x, y in pts) + "z")

    # ---- svg
    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" class="pcb" role="img" viewBox="%s %s %s %s" width="%s" height="%s">'
             % (r2(vx0), r2(vy0), r2(W), r2(H), r2(W), r2(H)))
    o.append("<title>Omar keyboard mainboard, Rev B.1</title>")
    o.append('<g class="pcb-board"><path class="board" fill-rule="evenodd" d="%s"/></g>' % loops_to_path(loops))
    for cls, layer in (("pcb-zone-b", "B.Cu"), ("pcb-zone-f", "F.Cu")):
        if zone_paths[layer]:
            o.append('<g class="%s"><path class="zone" fill-rule="evenodd" d="%s"/></g>' % (cls, "".join(zone_paths[layer])))
        else:
            o.append('<g class="%s"></g>' % cls)
    for cls, layer in (("pcb-cu-b", "B.Cu"), ("pcb-cu-f", "F.Cu")):
        o.append('<g class="%s">' % cls)
        for lay, net, w, pts in sorted(merged, key=lambda t: (t[1], t[2])):
            if lay != layer:
                continue
            d = "M" + " ".join("%s %s" % (r2(x), r2(y)) for x, y in pts)
            o.append('<path class="trk" data-net="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" fill="none" d="%s"/>'
                     % (esc(net), r2(w), d))
        o.append("</g>")

    def pad_el(p):
        w, h = p["w"], p["h"]
        a = p["angle"] % 360
        attrs = ""
        if abs(a - 90) < 1e-3 or abs(a - 270) < 1e-3:
            w, h = h, w
        elif abs(a) > 1e-3 and abs(a - 180) > 1e-3:
            attrs = ' transform="rotate(%s %s %s)"' % (r2(-p["angle"]), r2(p["x"]), r2(p["y"]))
        net = ' data-net="%s"' % esc(p["net"]) if p["net"] else ""
        meta = ' data-ref="%s" data-pad="%s"' % (esc(p["ref"]), esc(p["num"]))
        if p["shape"] == "circle" and abs(w - h) < 1e-6:
            return '<circle class="pad"%s%s cx="%s" cy="%s" r="%s"/>' % (net, meta, r2(p["x"]), r2(p["y"]), r2(w / 2))
        rx = 0.0
        if p["shape"] == "roundrect":
            rx = p["rratio"] * min(w, h)
        elif p["shape"] in ("oval", "circle"):
            rx = min(w, h) / 2
        rxa = ' rx="%s"' % r2(rx) if rx > 0 else ""
        return '<rect class="pad"%s%s x="%s" y="%s" width="%s" height="%s"%s%s/>' % (
            net, meta, r2(p["x"] - w / 2), r2(p["y"] - h / 2), r2(w), r2(h), rxa, attrs)

    for cls, side in (("pcb-pads-b", "b"), ("pcb-pads-f", "f"), ("pcb-pads-th", "th")):
        o.append('<g class="%s">' % cls)
        for p in allpads:
            if pad_side(p) == side:
                o.append(pad_el(p))
        o.append("</g>")

    o.append('<g class="pcb-vias">')
    for v in vias:
        net = ' data-net="%s"' % esc(v["net"]) if v["net"] else ""
        o.append('<circle class="via"%s cx="%s" cy="%s" r="%s"/>' % (net, r2(v["x"]), r2(v["y"]), r2(v["size"] / 2)))
    o.append("</g>")

    o.append('<g class="pcb-holes">')
    for p in allpads:
        if not p["drill"]:
            continue
        dw, dh = p["drill"]
        if abs(dw - dh) < 1e-6:
            o.append('<circle class="hole" cx="%s" cy="%s" r="%s"/>' % (r2(p["x"]), r2(p["y"]), r2(dw / 2)))
        else:
            a = p["angle"] % 360
            attrs = ""
            if abs(a - 90) < 1e-3 or abs(a - 270) < 1e-3:
                dw, dh = dh, dw
            elif abs(a) > 1e-3 and abs(a - 180) > 1e-3:
                attrs = ' transform="rotate(%s %s %s)"' % (r2(-p["angle"]), r2(p["x"]), r2(p["y"]))
            o.append('<rect class="hole" x="%s" y="%s" width="%s" height="%s" rx="%s"%s/>' % (
                r2(p["x"] - dw / 2), r2(p["y"] - dh / 2), r2(dw), r2(dh), r2(min(dw, dh) / 2), attrs))
    for v in vias:
        if v["drill"]:
            o.append('<circle class="hole" cx="%s" cy="%s" r="%s"/>' % (r2(v["x"]), r2(v["y"]), r2(v["drill"] / 2)))
    o.append("</g>")

    # parts
    parts, missing = [], []
    o.append('<g class="pcb-parts">')
    for ref in PART_REFS:
        fp = byref.get(ref)
        if not fp:
            missing.append(ref)
            continue
        cps = [p for p in fp["pads"] if p["type"] != "np_thru_hole"] or fp["pads"]
        x0 = y0 = 1e9
        x1 = y1 = -1e9
        for p in cps:
            la = math.radians(p["angle"] - fp["angle"])
            hw = (abs(p["w"] * math.cos(la)) + abs(p["h"] * math.sin(la))) / 2
            hh = (abs(p["w"] * math.sin(la)) + abs(p["h"] * math.cos(la))) / 2
            x0, x1 = min(x0, p["lx"] - hw), max(x1, p["lx"] + hw)
            y0, y1 = min(y0, p["ly"] - hh), max(y1, p["ly"] + hh)
        x0 -= 0.6
        y0 -= 0.6
        x1 += 0.6
        y1 += 0.6
        cx, cy = xform(fp, (x0 + x1) / 2, (y0 + y1) / 2)
        w, h = x1 - x0, y1 - y0
        attrs = ""
        if abs(fp["angle"] % 360) > 1e-3:
            attrs = ' transform="rotate(%s %s %s)"' % (r2(-fp["angle"]), r2(cx), r2(cy))
        o.append('<rect class="part" data-ref="%s" x="%s" y="%s" width="%s" height="%s"%s/>' % (
            esc(ref), r2(cx - w / 2), r2(cy - h / 2), r2(w), r2(h), attrs))
        corners = [xform(fp, a, b) for a in (x0, x1) for b in (y0, y1)]
        parts.append({"ref": ref, "value": fp["value"], "footprint": fp["name"],
                      "side": "F" if fp["layer"] == "F.Cu" else "B",
                      "x": round(fp["x"], 2), "y": round(fp["y"], 2), "angle": round(fp["angle"], 2),
                      "bbox": [round(min(c[0] for c in corners), 2), round(min(c[1] for c in corners), 2),
                               round(max(c[0] for c in corners), 2), round(max(c[1] for c in corners), 2)]})
    o.append("</g>")

    # flows
    router = Router(segs, vias, allpads)
    flows = []   # (name, order|None, points)
    report = {}
    unresolved = []

    def pads_of(ref, net):
        return [p for p in padsby_net.get(net, []) if p["ref"] == ref]

    def route_between(net, src_pads, dst_pads):
        b = best_route(router, net, src_pads, dst_pads)
        if not b:
            unresolved.append("%s (%s -> %s)" % (net, [p["ref"] + ":" + p["num"] for p in src_pads],
                                                 [p["ref"] + ":" + p["num"] for p in dst_pads]))
            return None
        (s, d), (pts, _) = b
        return s, d, pts

    for name, net_a, net_b in (("usb-dp", "USB_DP", "USB_DP_MCU"), ("usb-dm", "USB_DM", "USB_DM_MCU")):
        res_pads = [p for p in padsby_net.get(net_a, []) if p["ref"] in ("R1", "R2")]
        r_a = route_between(net_a, pads_of("J1", net_a), res_pads)
        if not r_a:
            continue
        rres = r_a[1]["ref"]
        other = [p for p in byref[rres]["pads"] if p["net"] == net_b]
        r_b = route_between(net_b, other, pads_of("U1", net_b))
        if not r_b:
            flows.append((name, None, r_a[2]))
            continue
        flows.append((name, None, r_a[2] + r_b[2]))

    # roller
    for net in ("ROLL_A", "ROLL_B"):
        r = route_between(net, pads_of("J2", net), pads_of("U1", net))
        if r:
            flows.append(("roller", None, r[2]))
            report.setdefault("roller_nets", []).append(net)

    # led chain
    order = 0
    r = route_between("RGB_3V3", pads_of("U1", "RGB_3V3"), pads_of("U4", "RGB_3V3"))
    if r:
        flows.append(("led", order, r[2]))
        order += 1
    sinks5 = [p for p in padsby_net.get("RGB_5V", []) if p["ref"] != "U4"]
    r = route_between("RGB_5V", pads_of("U4", "RGB_5V"), sinks5)
    chain = []
    if r:
        flows.append(("led", order, r[2]))
        order += 1
        mid = r[1]
        if mid["ref"].startswith("LED"):
            din = mid
        else:
            # series resistor: its PIX0 pad feeds the first LED
            src0 = [p for p in byref[mid["ref"]]["pads"] if p["net"] == "PIX0"]
            leds0 = [p for p in padsby_net.get("PIX0", []) if p["ref"].startswith("LED")]
            r0 = route_between("PIX0", src0, leds0)
            din = None
            if r0:
                flows.append(("led", order, r0[2]))
                order += 1
                din = r0[1]
    if r and din:
        led = din["fp"]
        chain.append(led["ref"])
        din_num = din["num"]
        npix = sum(1 for n in padsby_net if re.fullmatch(r"PIX\d+", n))
        for i in range(1, npix):
            net = "PIX%d" % i
            ps = padsby_net.get(net, [])
            src = [p for p in ps if p["ref"] == led["ref"]]
            dst = [p for p in ps if p["ref"] != led["ref"]]
            if not src or not dst:
                unresolved.append("%s (chain break at %s)" % (net, led["ref"]))
                break
            rr = route_between(net, src, dst)
            if not rr:
                break
            flows.append(("led", order, rr[2]))
            order += 1
            led = rr[1]["fp"]
            chain.append(led["ref"])
        else:
            outs = [p for p in padsby_net.get("LED_OUT", []) if p["ref"] == led["ref"]]
            rr = route_between("LED_OUT", outs, pads_of("TP7", "LED_OUT"))
            if rr:
                flows.append(("led", order, rr[2]))
                order += 1
    report["led_chain"] = chain

    o.append('<g class="pcb-flow">')
    flow_report = []
    for name, ordn, pts in flows:
        pts = simplify(pts)
        d = "M" + " ".join("%s %s" % (r2(x), r2(y)) for x, y in pts)
        oa = ' data-order="%d"' % ordn if ordn is not None else ""
        o.append('<path class="flow" data-flow="%s"%s fill="none" stroke-linecap="round" stroke-linejoin="round" d="%s"/>' % (name, oa, d))
        flow_report.append((name, ordn, len(pts), pts[0], pts[-1]))
    o.append("</g>")
    o.append("</svg>")

    os.makedirs(os.path.dirname(OUT_SVG), exist_ok=True)
    with open(OUT_SVG, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(o) + "\n")
    meta = {"board": {"width_mm": round(bx1 - bx0, 2), "height_mm": round(by1 - by0, 2),
                      "origin": [round(bx0, 2), round(by0, 2)]},
            "counts": {"segments": sum(1 for _ in kids(root, "segment")), "arcs": narcs,
                       "vias": len(vias), "footprints": len(fps)},
            "parts": parts}
    with open(OUT_JSON, "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1)
        f.write("\n")

    # ---- reports
    print("svg bytes:", os.path.getsize(OUT_SVG), " json bytes:", os.path.getsize(OUT_JSON))
    print("board bbox: %.2f %.2f %.2f %.2f  (loops: %d)" % (bx0, by0, bx1, by1, len(loops)))
    print("segments", meta["counts"]["segments"], "arcs", narcs, "vias", len(vias), "footprints", len(fps),
          "merged track paths", len(merged), "zone polys", {k: len(v) for k, v in zone_paths.items()})
    print("missing part refs:", missing)
    # coincidence
    ends = []
    for s in segs:
        ends.append((s["net"], s["layer"], s["p0"]))
        ends.append((s["net"], s["layer"], s["p1"]))
    near = inside = nopad = 0
    for net, layer, p in ends:
        cands = padsby_net.get(net, [])
        hit_c = any(math.hypot(q["x"] - p[0], q["y"] - p[1]) <= 0.05 for q in cands)
        hit_i = hit_c or any(inside_pad(q, p[0], p[1], 0.01) for q in cands)
        near += hit_c
        inside += hit_i
    print("track endpoints: %d total, %d within 0.05mm of a same-net pad centre, %d inside a same-net pad"
          % (len(ends), near, inside))
    print("pads with net:", sum(len(v) for v in padsby_net.values()), " total pads:", len(allpads))
    for name, ordn, n, a, b in flow_report:
        print("flow %-8s order=%s pts=%d start=(%.2f,%.2f) end=(%.2f,%.2f)" % (name, ordn, n, a[0], a[1], b[0], b[1]))
    print("led chain:", report.get("led_chain"))
    print("unresolved:", unresolved)

    if raster:
        draw_raster(raster, loops, (vx0, vy0, vx1, vy1), zone_paths, merged, allpads, vias, parts, flows)


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def draw_raster(path, loops, vb, zone_paths, merged, pads, vias, parts, flows):
    from PIL import Image, ImageDraw
    S = 4.0
    vx0, vy0, vx1, vy1 = vb
    img = Image.new("RGB", (int((vx1 - vx0) * S), int((vy1 - vy0) * S)), (20, 20, 20))
    dr = ImageDraw.Draw(img)
    T = lambda p: ((p[0] - vx0) * S, (p[1] - vy0) * S)
    for lp in loops:
        if lp[0][0] == "circle":
            continue
        pts = []
        for i, (x, y, arc) in enumerate(lp):
            pts.append((x, y))
        dr.polygon([T(p) for p in pts], fill=(30, 90, 50), outline=(220, 220, 100))
    # (approximate: arcs drawn as chords; holes painted dark)
    for lp in loops[1:]:
        pass
    cols = {"F.Cu": (200, 60, 60), "B.Cu": (60, 90, 220)}
    for layer in ("B.Cu", "F.Cu"):
        for lay, net, w, pts in merged:
            if lay == layer:
                dr.line([T(p) for p in pts], fill=cols[layer], width=max(1, int(w * S)))
    for p in pads:
        c = (230, 200, 90) if pad_side(p) == "f" else (90, 200, 230) if pad_side(p) == "b" else (240, 240, 240)
        if pad_side(p) == "np":
            continue
        w, h = p["w"], p["h"]
        a = p["angle"] % 180
        if abs(a - 90) < 1e-3:
            w, h = h, w
        x, y = T((p["x"], p["y"]))
        dr.rectangle([x - w * S / 2, y - h * S / 2, x + w * S / 2, y + h * S / 2], fill=c)
    for v in vias:
        x, y = T((v["x"], v["y"]))
        dr.ellipse([x - v["size"] * S / 2, y - v["size"] * S / 2, x + v["size"] * S / 2, y + v["size"] * S / 2], fill=(0, 200, 0))
    for name, ordn, pts in flows:
        dr.line([T(p) for p in pts], fill=(255, 0, 255), width=2)
    img.save(path)


if __name__ == "__main__":
    main()
