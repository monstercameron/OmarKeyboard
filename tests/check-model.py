import bpy
import csv
import json
import math
import struct
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parent.parent
out=root/"hardware/model"
raw=(root/"docs/assets/omar-keyboard.glb").read_bytes()
magic,version,total,n,kind=struct.unpack_from("<4sIIII",raw)
assert (magic,version,total,kind)==(b"glTF",2,len(raw),0x4e4f534a)
data=json.loads(raw[20:20+n]);assert data["scenes"] and not data.get("cameras")
assert all("uri" not in b for b in data["buffers"])
assert not any(o["name"].startswith(("Studio","Camera","Softbox")) for o in data["nodes"])
rows=list(csv.DictReader((root/"hardware/layout/omar-switches.csv").open(encoding="utf8",newline="")))
for fmt in ["blend","glb"]:
    if fmt=="blend":
        bpy.ops.wm.open_mainfile(filepath=str(out/"Omar-Keyboard.blend"))
        assert bpy.context.scene.camera is not None
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(root/"docs/assets/omar-keyboard.glb"))
    deck=next(o for o in bpy.data.objects if o.name.startswith("Plate datum"))
    frame=deck.matrix_world.inverted()
    def bounds_in_deck(o):
        coords=[frame @ o.matrix_world @ v.co for v in o.data.vertices]
        return [(min(p[i] for p in coords)*1000,max(p[i] for p in coords)*1000) for i in range(3)]
    def size(bounds,i):return bounds[i][1]-bounds[i][0]
    caps=[o for o in bpy.data.objects if o.name.startswith("Cap | ")]
    assert len(caps)==90
    for r in rows:
        if r["zone"]=="dial":continue
        cap=next(o for o in caps if o.name=="Cap | "+r["id"])
        center=frame @ cap.matrix_world.translation
        assert abs(center.x*1000+202.40625-float(r["center_x_mm"]))<.011
        assert abs(59.53125-center.y*1000-float(r["center_y_mm"]))<.011
    shell=next(o for o in bpy.data.objects if o.name.startswith("Tray |"))
    ext=bounds_in_deck(shell)
    assert abs(size(ext,0)-422.8)<.03 and abs(size(ext,1)-137.1)<.03,ext
    barrel=bounds_in_deck(next(o for o in bpy.data.objects if o.name.startswith("Roller | Ø16")))
    assert all(abs(size(barrel,i)-v)<.015 for i,v in enumerate([42,16,16])),barrel
    assert abs(barrel[2][1]-14)<.015
    knobs=[o for o in bpy.data.objects if o.name.startswith("Dial |")]
    assert len(knobs)==2
    for knob in knobs:
        bb=bounds_in_deck(knob)
        assert abs(size(bb,0)-18)<.015 and abs(size(bb,2)-12)<.015
    assert bpy.data.objects.get("Cap | Alt") and bpy.data.objects.get("Cap | Right Super")
    assert bpy.data.objects.get("USB-C | receptacle shield")
    assert len([o for o in bpy.data.objects if o.name.startswith("Homing bar |")])==5
    assert len([o for o in bpy.data.objects if o.name.startswith("Stabilizer wire |")])==6
    normal=deck.matrix_world.to_quaternion() @ Vector((0,0,1))
    assert abs(math.degrees(math.acos(normal.z))-6)<.002
    print(fmt.upper()+" verified: 90 independent cap positions, two knobs, roller, case, tilt, stabilizers and key landmarks.",flush=True)
