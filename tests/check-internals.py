"""Verify the service model in Blender, including the physical datum and both poses."""
import csv
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root = Path(__file__).resolve().parents[1]
out = root / "hardware/model/internals"
bpy.ops.wm.open_mainfile(filepath=str(out/"Omar-Keyboard-Internals.blend"))
scene = bpy.context.scene
rows = list(csv.DictReader((root/"hardware/layout/omar-switches.csv").open(encoding="utf-8")))
scene.frame_set(1)
deck = next(o for o in scene.objects if o.name.startswith("Plate datum"))
to_local = deck.matrix_world.inverted()
cx,cy = 202.40625,59.53125


def obj(prefix):
    return next(o for o in scene.objects if o.name.startswith(prefix))


def corners(o):
    return [to_local @ o.matrix_world @ Vector(p) * 1000 for p in o.bound_box]


def extents(o):
    pts = corners(o)
    return [(min(p[i] for p in pts),max(p[i] for p in pts)) for i in range(3)]


def near(actual,want,tolerance=.025):
    assert abs(actual-want)<tolerance,(actual,want)


def tree(o):
    verts=[to_local @ o.matrix_world @ v.co * 1000 for v in o.data.vertices]
    return BVHTree.FromPolygons(verts,[tuple(p.vertices) for p in o.data.polygons])


pcb=obj("PCB · 405")
bounds=extents(pcb)
for length,(lo,hi) in zip((405.81,120.06,1.60),bounds):
    near(hi-lo,length)
near(bounds[2][0],-6.6)
near(bounds[2][1],-5.0)
drills=tree(pcb)
def hits_pcb(x,y):
    return drills.ray_cast(Vector((x-cx,cy-y,-4)),Vector((0,0,-1)),4)[0] is not None

assert hits_pcb(344,41), "Solid FR4 is missing in the roller bay"
for r in rows:
    x,y=float(r["center_x_mm"]),float(r["center_y_mm"])
    if r["zone"]!="dial":
        s=bpy.data.objects["Switch · "+r["id"]]
        center=to_local @ s.matrix_world.translation * 1000
        near(center.x+cx,x)
        near(cy-center.y,y)
        assert s["matrix_row"]==int(r["matrix_row"]) and s["matrix_col"]==int(r["matrix_col"])
        for dx,dy in [(0,0),(-5.08,0),(5.08,0),(-3.81,2.54),(2.54,5.08)]:
            assert not hits_pcb(x+dx,y+dy),(r["id"],dx,dy)
        sock=bpy.data.objects["Socket · "+r["id"]]
        near(extents(sock)[2][0],-8.43)
    if r["led_index"]:
        assert not hits_pcb(x,y-5.08)
assert [(p,sum(o.name.startswith(p) for o in scene.objects)) for p in
        ("Switch · ","Socket · ","LED","Mount ","Tray boss")] == [
        ("Switch · ",90),("Socket · ",90),("LED",15),("Mount ",14),("Tray boss",14)]
assert len([o for o in scene.objects if o.name[:1]=="D" and o.name[1:3].isdigit()])==92
assert sum(o.name.startswith("Keycap receiver ·") for o in scene.objects)==102
assert sum(o.name.startswith("Encoder terminations") for o in scene.objects)==2
assert sum(o.name.startswith("USB link ·") for o in scene.objects)==4

port=obj("J1 · USB-C shell")
near((to_local @ port.matrix_world.translation).x*1000+cx,95.25)
shell=tree(obj("Tray |"))
for dx,dz in [(0,0),(-4.2,0),(4.2,0),(0,1.35),(0,-1.35)]:
    assert shell.ray_cast(Vector((95.25-cx+dx,cy+11,-3.9+dz)),Vector((0,-1,0)),13)[0] is None, "USB mouth blocked"
carrier=extents(obj("J1a · USB-C carrier PCB"))
near(carrier[0][1]-carrier[0][0],20)
near(carrier[1][1]-carrier[1][0],7)
assert carrier[1][0]-bounds[1][1]>.34
for name in ["U1 · RP2040","U2 · W25Q16","U3 · AP2112","U4 · AHCT","U5 · USBLC6","F1 · 500","Y1 · 12","BOOT ·","RUN ·"]:
    obj(name)


cad=json.loads((out/"board-geometry.json").read_text())
assert pcb["board_sha256"]==cad["source_sha256"]
plate=tree(obj("5052 aluminium"))
for n in range(1,15):
    x,y=cad["parts"][f"H{n}"]["xy"]
    assert not hits_pcb(x,y)
    for prefix in ("Tray boss ","Mount "):
        mount=bpy.data.objects.get(prefix+f"{n:02d} · M2"+(" insert support" if prefix.startswith("Tray") else ""))
        center=to_local @ mount.matrix_world.translation*1000
        near(center.x+cx,x)
        near(cy-center.y,y)
    ray=plate.ray_cast(Vector((x-cx,cy-y,2)),Vector((0,0,-1)),5)[0]
    assert (ray is None)==(n<=12),(n,ray)
assert hits_pcb(278.60,80.96) and not hits_pcb(280.95,79.695)
for ref in ("U1","U2","U3","U4","Y1","J1","J2","SW93","SW94"):
    part=next(o for o in scene.objects if o.get("reference")==ref)
    xy=to_local @ part.matrix_world.translation*1000
    expected=cad["parts"][ref]["xy"]
    near(xy.x+cx,expected[0])
    near(cy-xy.y,expected[1])
u1=obj("U1 · RP2040")
near(extents(u1)[2][1],-4.00)
roller=tree(obj("Roller | Ø16"))
chip=tree(u1)
# The lowest rib in the chip's X span crosses its upper surface at the axle's Y.
clearances=[]
for i in range(121):
    x=339+i*.05
    p=Vector((x-cx,cy-42.86,-3))
    above=roller.ray_cast(p,Vector((0,0,1)),4)[0]
    below=chip.ray_cast(p,Vector((0,0,-1)),4)[0]
    assert above is not None and below is not None
    clearances.append(above.z-below.z)
near(min(clearances),2.00,.015)
near(extents(obj("U2 · W25Q16"))[2][1],-2.85)
satin=tree(obj("Roller | satin bezel"))
bezel_open=satin.ray_cast(Vector((342-cx,cy-42.86,6.801)),Vector((0,1,0)),15)[0]
near(bezel_open.y-(cy-42.86),8.50)
length=obj("USB harness")["jacket_centerline_mm"]
print("Verified controller fit: U1 gap",round(min(clearances),3),"mm; jacket centerline",round(length,2),"mm",flush=True)


# Check the actual fabricated-shell export against the model's support plane.
tray_mesh=root/"hardware/model/Omar-Keyboard-Tray.stl"
if tray_mesh.exists():
    bpy.ops.wm.stl_import(filepath=str(tray_mesh),global_scale=.001,use_scene_unit=False)
    stl=bpy.context.selected_objects[0]
    stl.location.z+=.002
    bpy.context.view_layer.update()
    fused=tree(stl)
    for n in range(1,15):
        x,y=cad["parts"][f"H{n}"]["xy"]
        point=fused.ray_cast(Vector((x-cx+1.8,cy-y,-8)),Vector((0,0,-1)),12)[0]
        assert point is not None
        near(point.z,-9.82,.03)
    p=fused.ray_cast(Vector((278.6-cx,cy-80.96,-8)),Vector((0,0,-1)),25)[0]
    assert p is not None and p.z < -11
    bpy.data.objects.remove(stl,do_unlink=True)

for x in (322.565,372.765):
    for y in (27.26,58.46):
        assert plate.ray_cast(Vector((x-cx,cy-y,2)),Vector((0,0,-1)),5)[0] is None
solids=[(o,tree(o)) for o in scene.objects if o.name.startswith("Socket ·") or
        (o.get("reference","")[:1] in ("D","C") and o.get("side")=="B")]
for o in scene.objects:
    if o.name.startswith(("Tray boss ","Tray saddle ","USB harness")):
        mesh=tree(o)
        for other,bvh in solids:
            assert not mesh.overlap(bvh),(o.name,other.name)
floor_gaps=[]
for o,bvh in solids:
    if not o.name.startswith("Socket ·"):continue
    for v in o.data.vertices:
        pt=to_local @ o.matrix_world @ v.co * 1000
        hit=shell.ray_cast(pt,Vector((0,0,-1)),40)[0]
        if hit is not None:floor_gaps.append(pt.z-hit.z)
assert min(floor_gaps)>2.0,min(floor_gaps)
print("Smallest checked socket-vertex to tray-floor gap",round(min(floor_gaps),3),"mm")


group_names=("02 · Mainboard", "03 · Switch plate","04 · MX switches","05 · Keycaps")
for frame,heights in [(1,[0]*4),(61,[55,111,163,215])]:
    scene.frame_set(frame)
    for name,h in zip(group_names,heights):
        near(obj(name).location.z*1000,h)
raw=(out/"Omar-Keyboard-Internals.glb").read_bytes()
magic,version,size,n,kind=struct.unpack_from("<4sIIII",raw)
assert (magic,version,size,kind)==(b"glTF",2,len(raw),0x4e4f534a)
doc=json.loads(raw[20:20+n])
assert all("uri" not in b for b in doc["buffers"])
assert len(doc["animations"])==1
anim=doc["animations"][0]
assert len(anim["channels"])==4
for item in anim["samplers"]:
    speed=doc["accessors"][item["input"]]
    near(speed["min"][0],0)
    near(speed["max"][0],2)
print("Verified 90 switches and sockets, 92 diodes, 15 LEDs, 102 cap receivers, 14 supports, actual switch and LED openings, USB clearance, both native poses and one portable four-layer animation.")
