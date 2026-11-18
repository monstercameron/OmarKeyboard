"""Build the site's high-detail print model from the SolidCraft STL master.

The master STL in hardware/mechanical-rfq/rev-b2-t4 is the geometry prints come from. It is a
triangle soup of every body in the assembly, about 25 million triangles and 1.25 GB, with no
color. This script welds it into an indexed mesh, finds its separate bodies, and colors them the
way tools/build-model.py colors the main site model: keycaps by their group in
hardware/layout/omar-switches.csv, each legend in the ink of the cap it sits on, and the case,
plate and knobs in their own materials. gltfpack then simplifies the result to a fifth of its
triangles and compresses it with EXT_meshopt_compression for docs/assets/omar-print-model.glb.

Needs Python 3.11 with numpy and scipy, and Node.js for `npx gltfpack`.

    python tools/build-print-model.py
"""
import csv
import json
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "hardware/mechanical-rfq/rev-b2-t4/Omar-Keyboard-full-T4-SolidCraft.stl"
LAYOUT = ROOT / "hardware/layout/omar-switches.csv"
OUT = ROOT / "docs/assets/omar-print-model.glb"
RATIO = 0.2
GLTFPACK = "gltfpack@0.25.0"

# sRGB color, metallic, roughness. The palette follows tools/build-model.py.
MATERIALS = {
    "Case | graphite": ("3f4a45", .68, .35), "Plate | warm grey aluminium": ("aeb0a0", .48, .40),
    "Knob | dark aluminium": ("444b48", .74, .33), "Roller | rubber": ("333b38", 0, .62),
    "Internals | charcoal": ("23292a", 0, .55),
    "PBT | ivory": ("f6f2e7", 0, .43), "PBT | modifiers": ("e0e0d3", 0, .43),
    "PBT | desk and Super": ("f2cd8f", 0, .43), "PBT | launch rail": ("bdd4aa", 0, .43),
    "PBT | window rail": ("cad7e0", 0, .43), "PBT | utilities": ("dfd7c2", 0, .43),
    "PBT | capture": ("d4cbe4", 0, .43),
    "Print | charcoal": ("2a3326", 0, .58), "Print | desks": ("6a3c12", 0, .5),
    "Print | launch": ("2d4a26", 0, .5), "Print | window": ("243f5c", 0, .5),
    "Print | utility": ("4a4030", 0, .5), "Print | screenshot": ("4a3a5e", 0, .5),
    "Dial index | warm enamel": ("e8b06a", 0, .32),
}
INK = {"PBT | ivory": "Print | charcoal", "PBT | modifiers": "Print | charcoal",
       "PBT | desk and Super": "Print | desks", "PBT | launch rail": "Print | launch",
       "PBT | window rail": "Print | window", "PBT | utilities": "Print | utility",
       "PBT | capture": "Print | screenshot"}

started = time.time()


def log(*parts):
    print(f"[{time.time() - started:6.1f}s]", *parts, flush=True)


def cap_material(row):
    key, zone = row["id"], row["zone"]
    if key == "Screenshot":
        return "PBT | capture"
    if zone == "left rail":
        return "PBT | launch rail"
    if zone == "right rail" or key == "Next Window":
        return "PBT | window rail"
    if key.startswith("Desk ") or key in {"Last Desk", "Send & Stay", "Move & Go", "Left Super", "Right Super"}:
        return "PBT | desk and Super"
    if zone == "top" and key != "Esc":
        return "PBT | utilities"
    if zone == "arrows" or (float(row["w_u"]) > 1 and key != "Space") or key == "Esc":
        return "PBT | modifiers"
    return "PBT | ivory"


def linear(hex_color):
    srgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [round(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4, 5) for c in srgb]


def read_master():
    with MASTER.open("rb") as f:
        f.seek(80)
        count = struct.unpack("<I", f.read(4))[0]
    soup = np.memmap(MASTER, dtype=np.dtype([("n", "<3f4"), ("v", "<9f4"), ("a", "<u2")]),
                     mode="r", offset=84, shape=(count,))
    corners = np.empty((count * 3, 3), np.float32)
    for start in range(0, count, 2_000_000):
        corners[start * 3:(start + 2_000_000) * 3] = soup["v"][start:start + 2_000_000].reshape(-1, 3)
    log(f"read {count:,} triangles")
    # Weld corners that share a 1 µm grid cell.
    low = corners.min(0)
    grid = np.round((corners - low) / 1e-3).astype(np.int64)
    if grid.max() >= 1 << 21:
        raise ValueError("Model is larger than the 2 m welding grid")
    _, first, inverse = np.unique((grid[:, 0] << 42) | (grid[:, 1] << 21) | grid[:, 2],
                                  return_index=True, return_inverse=True)
    del grid
    points = corners[first]
    del corners
    tris = inverse.astype(np.uint32).reshape(-1, 3)
    tris = tris[(tris[:, 0] != tris[:, 1]) & (tris[:, 1] != tris[:, 2]) & (tris[:, 0] != tris[:, 2])]
    log(f"welded to {len(points):,} vertices and {len(tris):,} triangles")
    # Millimetres with Z up become metres with Y up, centered on the footprint, floor at zero.
    mid = (points.min(0) + points.max(0)) / 2
    out = np.empty_like(points)
    out[:, 0] = (points[:, 0] - mid[0]) / 1000
    out[:, 1] = (points[:, 2] - points[:, 2].min()) / 1000
    out[:, 2] = -(points[:, 1] - mid[1]) / 1000
    return out, tris


def classify(points, tris):
    edges = coo_matrix((np.ones(len(tris) * 2, np.bool_),
                        (np.concatenate([tris[:, 0], tris[:, 1]]), np.concatenate([tris[:, 1], tris[:, 2]]))),
                       shape=(len(points), len(points)))
    count, label = connected_components(edges, directed=False)
    size_by_body = np.bincount(label[tris[:, 0]], minlength=count)
    low = np.full((count, 3), np.inf, np.float32)
    high = np.full((count, 3), -np.inf, np.float32)
    for axis in range(3):
        np.minimum.at(low[:, axis], label, points[:, axis])
        np.maximum.at(high[:, axis], label, points[:, axis])
    low, high = low * 1000, high * 1000
    size, mid = high - low, (low + high) / 2
    log(f"{count:,} bodies")

    material = np.array(["Internals | charcoal"] * count, dtype=object)
    order = np.argsort(-(size[:, 0] * size[:, 2]))
    material[order[0]] = "Case | graphite"
    material[order[1]] = "Plate | warm grey aluminium"

    rows = [r for r in csv.DictReader(LAYOUT.open(encoding="utf-8")) if r["zone"] != "dial"]
    switch = np.array([[float(r["center_x_mm"]), float(r["center_y_mm"])] for r in rows])
    caps = np.where((size[:, 1] > 7) & (size[:, 1] < 12.5) & (size[:, 2] > 16) & (size[:, 2] < 20.5)
                    & (size[:, 0] > 15) & (size[:, 0] < 125))[0]
    if len(caps) != len(rows):
        raise ValueError(f"Found {len(caps)} keycaps for {len(rows)} keys")
    # The layout's Y runs toward the typist along the 6° plate.
    plan = np.c_[switch[:, 0], switch[:, 1] * np.cos(np.radians(6))]
    found = mid[caps][:, [0, 2]]
    offset = found.mean(0) - plan.mean(0)
    for _ in range(3):
        gap = np.linalg.norm(found[:, None, :] - (plan + offset)[None, :, :], axis=2)
        nearest = gap.argmin(1)
        offset = np.median(found - plan[nearest], 0)
    if len(set(nearest)) != len(rows) or gap.min(1).max() > 1:
        raise ValueError("Keycaps do not match the switch layout")
    cap_of = {}
    for body, key in zip(caps, nearest):
        material[body] = cap_of[body] = cap_material(rows[key])
    knobs = np.where((np.abs(size[:, 0] - 18) < 1) & (np.abs(size[:, 1] - 13.8) < 1)
                     & (np.abs(size[:, 2] - 19.2) < 1))[0]
    material[knobs] = "Knob | dark aluminium"
    # A thin body resting on a cap's top is its legend, and on a knob, the index mark.
    hosts = list(caps) + list(knobs)
    legends = 0
    for body in np.where((size[:, 1] < 1.2) & (np.maximum(size[:, 0], size[:, 2]) < 40))[0]:
        for host in hosts:
            if (low[host, 0] - .3 <= mid[body, 0] <= high[host, 0] + .3
                    and low[host, 2] - .3 <= mid[body, 2] <= high[host, 2] + .3
                    and high[host, 1] - 3 <= mid[body, 1] <= high[host, 1] + 1.5):
                material[body] = "Dial index | warm enamel" if host in knobs else INK[cap_of[host]]
                legends += host not in knobs
                break
    log(f"{len(caps)} keycaps, {len(knobs)} knobs, {legends} legend bodies")
    tri_material = material[label[tris[:, 0]]]

    # The roller is welded to the plate through its bearings. Find it inside the bezel, the
    # largest remaining body about 56 x 38 mm in plan, by fitting a circle across the bay.
    bezel = max((b for b in np.where((material == "Internals | charcoal") & (size[:, 0] > 40) & (size[:, 0] < 70)
                                     & (size[:, 2] > 30) & (size[:, 2] < 45))[0]), key=lambda b: size_by_body[b])
    plate = np.where(tri_material == "Plate | warm grey aluminium")[0]
    centre = points[tris[plate]].mean(1) * 1000
    bay = ((centre[:, 0] > low[bezel, 0] + 10) & (centre[:, 0] < high[bezel, 0] - 10)
           & (centre[:, 2] > low[bezel, 2]) & (centre[:, 2] < high[bezel, 2])
           & (centre[:, 1] > low[bezel, 1] - 2) & (centre[:, 1] < high[bezel, 1] + 4))
    y, z = centre[bay, 1], centre[bay, 2]
    fit = np.linalg.lstsq(np.c_[2 * y, 2 * z, np.ones_like(y)], y * y + z * z, rcond=None)[0]
    radius = np.sqrt(fit[2] + fit[0] ** 2 + fit[1] ** 2)
    roller = ((np.hypot(centre[:, 1] - fit[0], centre[:, 2] - fit[1]) < radius + 1.3)
              & (centre[:, 0] > low[bezel, 0] - 4) & (centre[:, 0] < high[bezel, 0] + 4))
    tri_material[plate[roller]] = "Roller | rubber"
    log(f"roller axis at y {fit[0]:.1f}, z {fit[1]:.1f} mm, radius {radius:.1f} mm, {roller.sum():,} triangles")
    return tri_material, count, legends


def write_glb(path, points, tris, tri_material):
    chunks, views, accessors, primitives, materials, offset = [], [], [], [], [], 0
    for name, (color, metallic, roughness) in MATERIALS.items():
        part = tris[tri_material == name]
        if not len(part):
            continue
        used, local = np.unique(part, return_inverse=True)
        pos, idx = points[used].astype("<f4"), local.reshape(-1).astype("<u4")
        for data, target in ((pos, 34962), (idx, 34963)):
            raw = data.tobytes()
            chunks.append(raw)
            views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw), "target": target})
            offset += len(raw)
        accessors += [{"bufferView": len(views) - 2, "componentType": 5126, "count": len(pos), "type": "VEC3",
                       "min": pos.min(0).tolist(), "max": pos.max(0).tolist()},
                      {"bufferView": len(views) - 1, "componentType": 5125, "count": len(idx), "type": "SCALAR"}]
        primitives.append({"attributes": {"POSITION": len(accessors) - 2}, "indices": len(accessors) - 1,
                           "material": len(materials)})
        materials.append({"name": name, "pbrMetallicRoughness": {
            "baseColorFactor": linear(color) + [1], "metallicFactor": metallic, "roughnessFactor": roughness}})
    gltf = {"asset": {"version": "2.0", "generator": "Omar-Keyboard build-print-model.py"},
            "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "Omar-Keyboard T4 print model"}],
            "meshes": [{"primitives": primitives}], "materials": materials,
            "buffers": [{"byteLength": offset}], "bufferViews": views, "accessors": accessors}
    header = json.dumps(gltf).encode()
    header += b" " * (-len(header) % 4)
    with path.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 28 + len(header) + offset))
        f.write(struct.pack("<II", len(header), 0x4E4F534A))
        f.write(header)
        f.write(struct.pack("<II", offset, 0x004E4942))
        for raw in chunks:
            f.write(raw)


def main():
    if not MASTER.exists():
        sys.exit(f"Missing {MASTER.relative_to(ROOT)}. Export the T4 assembly from SolidCraft as binary STL first.")
    points, tris = read_master()
    tri_material, bodies, legends = classify(points, tris)
    with tempfile.TemporaryDirectory() as tmp:
        colored = Path(tmp) / "colored.glb"
        write_glb(colored, points, tris, tri_material)
        log("wrote the colored, full-detail GLB; simplifying")
        npx = shutil.which("npx") or "npx"
        subprocess.run([npx, "--yes", GLTFPACK, "-i", str(colored), "-o", str(OUT),
                        "-si", str(RATIO), "-cc"], check=True)
    log(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size / 1e6:.1f} MB from {len(tris):,} triangles "
        f"in {bodies:,} bodies, {legends} of them legends")


if __name__ == "__main__":
    main()
