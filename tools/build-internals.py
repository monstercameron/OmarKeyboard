"""Build the Rev A service assembly. Run inside Blender 5.2 from any directory."""
import csv
import hashlib
import json
import runpy
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "hardware/model"
OUT = MODEL / "internals"
OUT.mkdir(parents=True, exist_ok=True)
if not globals().get("exterior_ready"):
    runpy.run_path(str(ROOT/"tools/build-model.py"), run_name="omar_exterior")
cad=json.loads((OUT/"board-geometry.json").read_text(encoding="utf8"))
source=ROOT/"hardware/mainboard/omar-mainboard.kicad_pcb"
if hashlib.sha256(source.read_bytes()).hexdigest()!=cad["source_sha256"]:
    raise ValueError("Re-export board-geometry.json from the edited KiCad board.")
fp=cad["parts"]

scene = bpy.context.scene
deck = next(o for o in scene.objects if o.name.startswith("Plate datum"))
assembly = deck.parent
assembly["scope"] = "Rev A routed mainboard. KiCad X/Y registration and nominal mounted component envelopes."
assembly["usb_mount"] = "Proposed 20 x 7 mm rear USB-C carrier and relieved wall. Under-board harness to J1 in the roller bay."
assembly["poses"] = "Frame 1 assembled, frame 61 exploded"
mm = .001
cx, cy = 202.40625, 59.53125
rows = list(csv.DictReader((ROOT / "hardware/layout/omar-switches.csv").open(encoding="utf-8")))
keys = [r for r in rows if r["zone"] != "dial"]
assert len(rows) == 92 and len(keys) == 90


def collection(name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


def empty(name, col, parent):
    o = bpy.data.objects.new(name, None)
    col.objects.link(o)
    o.parent = parent
    o.empty_display_size = .0015
    return o


def material(name, color, metal=0, rough=.43):
    m = bpy.data.materials.new(name)
    rgb = [int(color[i:i+2], 16) / 255 for i in (0,2,4)]
    rgba = tuple(c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb) + (1,)
    m.diffuse_color = rgba
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = rgba
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    return m


mask = material("PCB · forest solder mask", "19735b", .24)
edge = material("PCB · exposed FR4 edge", "ad9366", .12)
au = material("Contacts · ENIG", "d9ac5e", .70, .28)
tin = material("Terminations · solder", "afb7b8", .70, .33)
shield = material("Shield · satin nickel", "c5cecf", .78, .25)
ic = material("IC · graphite mould", "282f32", .08)
socket = material("Socket · carbon polymer", "323637")
switch_base = material("Switch · warm ivory PA", "ded9c8")
switch_lid = material("Switch · smoky lid", "9ca9a2", .14, .32)
stem = material("Switch · tactile amber", "b07642", .13)
heavy = material("Switch · heavy linear grey", "606568")
ceramic = material("Ceramic · sand", "be976b", .10)
silk = material("Silkscreen · warm ivory", "f0eedb")
white = material("Emitter · milky white", "eae8d4")
black = material("Connector · black LCP", "202626")
red = material("Harness · VBUS", "ae604c")
blue = material("Harness · D minus", "6eacc5")
green = material("Harness · D plus", "93af87")
trace_mat = material("PCB · masked copper", "328067", .32)

pcb_col = collection("07  Main PCB · sockets, matrix and indicators")
power_col = collection("08  USB power, RP2040 and service points")
switch_col = collection("09  MX switch assemblies")
layers = collection("10  Exploded assembly controls")
board_root = empty("02 · Mainboard assembly", layers, deck)
plate_root = empty("03 · Switch plate and roller module", layers, deck)
switch_root = empty("04 · MX switches", layers, deck)
cap_root = empty("05 · Keycaps and dial knobs", layers, deck)
usb_root = empty("J1 · Rear USB power assembly", power_col, board_root)


def place(o, parent, x, y, z=0):
    o.parent = parent
    o.location = ((x-cx)*mm, (cy-y)*mm, z*mm)
    return o


def xy(row):
    return float(row["center_x_mm"]), float(row["center_y_mm"])


def rounded(w, h, r, steps=4):
    r = min(r, w*.49, h*.49)
    return [(sx*(w/2-r)+r*math.cos(math.radians(a+90*k/steps)),
             sy*(h/2-r)+r*math.sin(math.radians(a+90*k/steps)))
            for sx,sy,a in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]
            for k in range(steps+1)]


def circle(radius, n=16):
    return [(radius*math.cos(i*math.tau/n), radius*math.sin(i*math.tau/n)) for i in range(n)]


def shifted(poly, x, y):
    return [(u+x, v+y) for u,v in poly]


class Mesh:
    """Collection of solid primitives in millimetres, reusable as a single linked part."""
    def __init__(self):
        self.verts, self.faces, self.slots, self.indices = [], [], [], []

    def face(self, face, mat):
        if mat not in self.slots:
            self.slots.append(mat)
        self.faces.append(face)
        self.indices.append(self.slots.index(mat))

    def loft(self, rings, mat, caps=True):
        n = len(rings[0])
        start = len(self.verts)
        for ring in rings:
            self.verts.extend(ring)
        if caps:
            self.face(tuple(start+j for j in reversed(range(n))), mat)
        for k in range(len(rings)-1):
            for i in range(n):
                a, b = start+k*n+i, start+k*n+(i+1)%n
                self.face((a,b,b+n,a+n), mat)
        if caps:
            self.face(tuple(start+(len(rings)-1)*n+i for i in range(n)), mat)

    def shape(self, poly, z0, z1, mat):
        self.loft([[(x,y,z) for x,y in poly] for z in (z0,z1)], mat)

    def box(self, x,y,z,w,h,d,mat,r=.10):
        self.shape(shifted(rounded(w,h,r,2),x,y), z, z+d, mat)

    def disc(self, x,y,z,r,h,mat,n=16):
        self.shape(shifted(circle(r,n),x,y), z, z+h, mat)

    def tube(self, points, radius, mat, n=8):
        points = [Vector(p) for p in points]
        rings = []
        for i,p in enumerate(points):
            t = (points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
            ref = Vector((0,1,0)) if abs(t.z)>.9 else Vector((0,0,1))
            u = t.cross(ref).normalized()
            v = t.cross(u)
            rings.append([tuple(p+radius*(u*math.cos(j*math.tau/n)+v*math.sin(j*math.tau/n))) for j in range(n)])
        self.loft(rings, mat)

    def data(self, name):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([tuple(mm*c for c in v) for v in self.verts], [], self.faces)
        for mat in self.slots:
            mesh.materials.append(mat)
        mesh.polygons.foreach_set("material_index", self.indices)
        mesh.update()
        return mesh


def component(name, mesh, col, parent, x,y,z=0):
    data = mesh.data(name) if isinstance(mesh,Mesh) else mesh
    o = bpy.data.objects.new(name, data)
    col.objects.link(o)
    return place(o,parent,x,y,z)


def punched(name, w,h, radius, holes, thickness, x,y,z, col, parent, outline=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions, curve.fill_mode = "2D", "BOTH"
    curve.extrude = thickness*mm/2
    for poly in [outline or rounded(w,h,radius,7)] + [list(reversed(p)) for p in holes]:
        spline = curve.splines.new("POLY")
        spline.points.add(len(poly)-1)
        spline.points.foreach_set("co", [v for a,b in poly for v in (a*mm,b*mm,0,1)])
        spline.use_cyclic_u = True
    tmp = bpy.data.objects.new(name,curve)
    col.objects.link(tmp)
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp,do_unlink=True)
    bpy.data.curves.remove(curve)
    mesh.materials.append(mask)
    mesh.materials.append(edge)
    for poly in mesh.polygons:
        poly.material_index = int(abs(poly.normal.z)<.15)
    return component(name,mesh,col,parent,x,y,z)


def marking(label, x,y,z, size, col=pcb_col, parent=board_root, ink=silk):
    font = bpy.data.curves.new("Silk "+label,"FONT")
    font.body, font.size, font.align_x, font.align_y = label, size*mm, "CENTER","CENTER"
    font.resolution_u = 3
    tmp = bpy.data.objects.new(label,font)
    col.objects.link(tmp)
    result = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp,do_unlink=True)
    bpy.data.curves.remove(font)
    result.materials.append(ink)
    return component("Mark · "+label,result,col,parent,x,y,z)


# Keep the exact exterior and its 6-degree datum. Group its layers for service access.
for o in list(scene.objects):
    name = o.name
    if name.startswith(("MX housing |","MX stem envelope |","PCB | FR4 envelope","USB-C |","M2 collar ")):
        bpy.data.objects.remove(o,do_unlink=True)
    elif o.parent == deck:
        if name.startswith(("Cap |","Dial |")):
            o.parent = cap_root
        elif name.startswith(("5052 aluminium","Plate print","M2 screw ","Roller |","Bezel |","Bezel legend |")):
            o.parent = plate_root
        elif name.startswith(("EC11E body","EC11E shaft","Stabilizer housing","Stabilizer wire")):
            o.parent = board_root

# Open the base of each exterior keycap and give it an inner roof and cruciform receivers.
receiver=Mesh()
slot=[(-.67,-2.13),(.67,-2.13),(.67,-.67),(2.13,-.67),(2.13,.67),(.67,.67),
      (.67,2.13),(-.67,2.13),(-.67,.67),(-2.13,.67),(-2.13,-.67),(-.67,-.67)]
outer=[(2.83*x/math.hypot(x,y),2.83*y/math.hypot(x,y)) for x,y in slot]
receiver.loft([[(x,y,z) for x,y in poly] for poly,z in [(outer,4.42),(outer,10.64),
               (slot,10.64),(slot,4.42),(outer,4.42)]],switch_base,False)
receiver_data=receiver.data("MX cruciform keycap receiver")
caps_collection=bpy.data.collections.get("04  Keycaps and legends")
for r in keys:
    cap=bpy.data.objects["Cap | "+r["id"]]
    bm=bmesh.new()
    bm.from_mesh(cap.data)
    floor=next(f for f in bm.faces if len(f.verts)>10 and all(abs(v.co.z-.0044)<1e-7 for v in f.verts))
    outline=list(reversed(floor.verts))
    bm.faces.remove(floor)
    hx=max(abs(v.co.x) for v in outline)
    hy=max(abs(v.co.y) for v in outline)
    rings=[outline]
    for z,dx,dy in [(.00440,.00115,.00115),(.01064,.00325,.00310)]:
        rings.append([bm.verts.new((v.co.x*(1-dx/hx),v.co.y*(1-dy/hy),z)) for v in outline])
    for a,b in zip(rings,rings[1:]):
        for i in range(len(a)):
            j=(i+1)%len(a)
            bm.faces.new((a[j],a[i],b[i],b[j]))
    bm.faces.new(list(reversed(rings[-1])))
    bm.to_mesh(cap.data)
    bm.free()
    half=50 if r["stabilizer"]=="6.25u" else 11.94
    for dx in ([0] if r["stabilizer"]=="none" else [0,-half,half]):
        o=bpy.data.objects.new("Keycap receiver · "+r["id"],receiver_data)
        caps_collection.objects.link(o)
        o.parent=cap
        o.location.x=dx*mm

all_mounts=[fp[f"H{i}"]["xy"] for i in range(1,1+sum(ref[1:].isdigit() for ref in fp if ref.startswith("H")))]
def contour(points):
    p=[(x-cx,cy-y) for x,y in points]
    area=sum(x*v-u*y for (x,y),(u,v) in zip(p,p[1:]+p[:1]))
    return p if area>0 else p[::-1]

def oval(w,h,angle):
    # Capsule, including an exactly circular drill when both axes match.
    r=min(w,h)/2
    a=math.radians(angle)+(math.pi/2 if h>w else 0)
    dx=abs(w-h)/2
    poly=[]
    for i in range(24):
        t=i*math.tau/24
        x,y=r*math.cos(t)+(dx if math.cos(t)>=0 else -dx),r*math.sin(t)
        poly.append((x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a)))
    return poly
holes=[contour(p) for p in cad["windows"]]
for f in fp.values():
    for pad in f["pads"]:
        w,h=pad["drill"]
        if w:
            x,y=pad["xy"]
            holes.append(shifted(oval(w,h,pad["angle"]),x-cx,cy-y))
for x,y,d,_ in cad["vias"]:holes.append(shifted(circle(d/2,10),x-cx,cy-y))
for r in keys:
    if r["stabilizer"]!="none" and r["keycap_row"]=="R4" and xy(r)[1]>100:
        bpy.data.objects["Stabilizer wire | "+r["id"]].location.y+=8*mm
pcb=punched("PCB · 405.81 x 120.06 x 1.60 mm",405.81,120.06,1,holes,cad["thickness"],
            cx,cy,-5-cad["thickness"]/2,pcb_col,board_root,outline=contour(cad["outline"]))
pcb["drills_and_windows"]=len(holes)
pcb["board_sha256"]=cad["source_sha256"]
pcb["mounts"]="H1–H12 shared with plate, H13–H14 board supports"
# Visible artwork uses the actual centreline and width on each copper layer.
for back,z in [(False,-4.995),(True,-6.605)]:
    g=Mesh()
    for x1,y1,x2,y2,width,side in cad["tracks"]:
        if bool(side)!=back:continue
        dx,dy=x2-x1,y1-y2
        length=math.hypot(dx,dy)
        if not length:continue
        nx,ny=-dy*width/(2*length),dx*width/(2*length)
        k=len(g.verts)
        g.verts.extend([(x1-cx+nx,cy-y1+ny,z),(x1-cx-nx,cy-y1-ny,z),
                        (x2-cx-nx,cy-y2-ny,z),(x2-cx+nx,cy-y2+ny,z)])
        g.face(tuple(range(k,k+4)),trace_mat)
    component("Copper · "+("B.Cu" if back else "F.Cu"),g,pcb_col,board_root,cx,cy)
    lands=Mesh()
    for f in fp.values():
        for pad in f["pads"]:
            w,h=pad["size"];dw,dh=pad["drill"];x,y=pad["xy"];angle=pad["angle"]
            if not pad["copper"] or not pad["plated"] or (not dw and back!=f["back"]):continue
            if dw:
                outer=oval(w,h,angle);inner=oval(dw,dh,angle)
                k=len(lands.verts)
                for loop in (outer,inner):lands.verts.extend([(x-cx+u,cy-y+v,z+(-.007 if back else .007)) for u,v in loop])
                for j in range(24):lands.face((k+j,k+(j+1)%24,k+24+(j+1)%24,k+24+j),au)
            else:
                a=math.radians(angle);k=len(lands.verts)
                poly=oval(w,h,0) if pad["shape"] in (0,2) else rounded(w,h,.08,2)
                lands.verts.extend([(x-cx+u*math.cos(a)-v*math.sin(a),cy-y+u*math.sin(a)+v*math.cos(a),z+(-.007 if back else .007)) for u,v in poly])
                lands.face(tuple(range(k,k+len(poly))),au)
    component("Lands · "+("back" if back else "front"),lands,pcb_col,board_root,cx,cy)


def switch_mesh(stem_material):
    g = Mesh()
    for dx in (-5.08,5.08):
        g.disc(dx,0,-7.28,.74,2.4,switch_base)
    g.disc(0,0,-7.5,1.83,2.65,switch_base,24)
    for dx,dy in [(-3.81,-2.54),(2.54,-5.08)]:
        g.box(dx,dy,-7.75,.58,.26,3.0,au)
    g.loft([[(a,b,z) for a,b in rounded(w,h,.8)] for w,h,z in [(12.7,12.4,-4.95),(13.8,13.8,-3.15),(13.8,13.8,-.38)]],switch_base)
    g.box(0,0,-.4,15.25,15.25,.83,switch_base,.7)
    g.loft([[(a,b,z) for a,b in rounded(w,h,.65)] for w,h,z in [(14.0,14.0,.43),(13.65,13.5,1.36),(10.55,10.0,4.00)]],switch_lid)
    for dx in (-6.1,6.1):
        for dy in (-3.75,3.75):
            g.box(dx,dy,.60,1.3,2.3,1.15,switch_base)
    g.box(0,0,3.98,6.8,5.6,.19,black,.48)
    g.box(0,0,4.16,4.8,4.55,.67,stem_material,.5)
    cross=[(-.59,-2.02),(.59,-2.02),(.59,-.59),(2.02,-.59),(2.02,.59),(.59,.59),
           (.59,2.02),(-.59,2.02),(-.59,.59),(-2.02,.59),(-2.02,-.59),(-.59,-.59)]
    g.shape(cross,4.82,7.3,stem_material)
    return g.data("Five-pin MX · "+stem_material.name)


def socket_mesh():
    g=Mesh()
    left,right=(-3.81,-2.54),(2.54,-5.08)
    g.tube([(left[0],left[1],-7.46),(-1.8,-2.54,-7.46),(.45,-5.08,-7.46),(right[0],right[1],-7.46)],.80,socket,12)
    for side,(a,b) in zip((-1,1),(left,right)):
        g.box(a+side*1.75,b,-6.71,2.2,2.75,.12,au,.15)
        g.box(a+side*1.42,b,-7.67,1.75,2.38,.98,tin,.20)
        g.disc(a,b,-8.4,1.68,1.80,socket,24)
        g.disc(a,b,-8.41,.81,.02,au)
        g.box(a,b,-8.43,1.2,.30,.03,black)
    return g.data("MX hot-swap · contact pair")


def smd(w,h,t,body,band=False):
    g=Mesh()
    g.box(0,0,0,w,h,t,body,.085)
    for s in (-1,1):
        g.box(s*w*.46,0,-.025,.20*w,h+.06,t+.04,tin)
    if band:
        g.box(-w*.23,0,t,w*.13,h*.95,.025,silk)
    return g


mx,lock = switch_mesh(stem),switch_mesh(heavy)
sockets = socket_mesh()
diodes = smd(2.75,1.55,.95,ic,True).data("SOD-123 · marked cathode")
cap100 = smd(1.60,.80,.72,ceramic).data("0603 · bypass")
pixel = Mesh()
pixel.box(0,0,-6.82,3.18,2.80,1.68,white,.17)
pixel.disc(0,0,-5.14,.92,.07,ceramic,28)
for x in (-1.78,1.78):
    for y in (-.77,.77):
        pixel.box(x,y,-6.81,1.12,.58,.20,tin)
pixel_data = pixel.data("SK6812MINI-E · reverse-mount")
for i,r in enumerate(rows,1):
    x,y = xy(r)
    if r["zone"]!="dial":
        sw = component("Switch · "+r["id"],lock if r["id"]=="Lock" else mx,switch_col,switch_root,x,y)
        sw["matrix_row"],sw["matrix_col"]=int(r["matrix_row"]),int(r["matrix_col"])
        component("Socket · "+r["id"],sockets,pcb_col,board_root,x,y)
    if r["led_index"]:
        n=int(r["led_index"])+1
        led=component(f"LED{n:02d} · "+r["id"],pixel_data,pcb_col,board_root,*fp[f"LED{n}"]["xy"])
        led["reference"]=f"LED{n}"

# Visible collars stop on each side of the PCB. Underside spacers and upper washers stay separate.
for i,(x,y) in enumerate(all_mounts,1):
    g=Mesh()
    for outer,z0,z1 in ([(2.15,-9.8,-6.60)] + ([(2.05,-5.0,-1.50)] if i<=12 else [])):
        rings=[[(a,b,z) for a,b in circle(r,24)] for r,z in [(outer,z0),(outer,z1),(1.1,z1),(1.1,z0),(outer,z0)]]
        g.loft(rings,au,False)
    collar=component(f"Mount {i:02d} · M2",g,pcb_col,board_root,x,y)
    collar["status"]="routed PCB interior support" if i>12 else "fixed mounting centre"
    boss=Mesh()
    bottom=(3.95-deck.location.z/mm-(cy-y)*math.sin(deck.rotation_euler.x))/math.cos(deck.rotation_euler.x)
    rings=[[(a,b,z) for a,b in circle(rad,28)] for rad,z in [(3.15,bottom),(2.75,bottom+.45),
           (2.45,-9.82),(1.12,-9.82),(1.12,bottom),(3.15,bottom)]]
    boss.loft(rings,black,False)
    component(f"Tray boss {i:02d} · M2 insert support",boss,pcb_col,deck,x,y)


def fitted(ref,label,mesh,height=0):
    f=fp[ref];o=component(label,mesh,power_col,board_root,*f["xy"],-6.6 if f["back"] else -5)
    o.rotation_euler.x=math.pi if f["back"] else 0
    o.rotation_euler.z=math.radians(f["angle"])
    o["reference"]=ref;o["pcb_xy_mm"]=f["xy"];o["side"]="B" if f["back"] else "F"
    if height:o["installed_height_mm"]=height
    return o

# Contacts follow the individual footprint lands, including the 0.4 mm U1 pitch.
for ref,w,h,body,seat,name in [
    ("U1",7,7,.90,.10,"RP2040 / QFN-56"),("U2",5.3,5.3,2.05,.10,"W25Q16 2 MB QSPI"),
    ("U3",1.65,2.9,1.10,.08,"AP2112 3V3 LDO"),("U4",1.65,2.9,1.10,.08,"AHCT1G125 LED driver"),
    ("Y1",3.2,2.5,.80,.05,"12 MHz crystal")]:
    g=Mesh()
    g.box(0,0,seat,w,h,body,shield if ref=="Y1" else ic,.18)
    x,y=fp[ref]["xy"]
    for p in fp[ref]["pads"]:
        if not p["pin"] or p["pin"]=="57":continue
        u,v=p["xy"];sw,sh=p["size"]
        g.box(u-x,y-v,0,sw*.86,sh*.86,.12,tin,.025)
    g.disc(-w*.32,h*.31,seat+body-.01,.15,.01,silk)
    fitted(ref,ref+" · "+name,g,seat+body)
    if ref in ("U1","U2"):
        marking("RP2040" if ref=="U1" else "W25Q16",x,y,-5+seat+body+.002,.94 if ref=="U1" else .7,power_col)
for ref,f in fp.items():
    if ref[0] in "CRD" and ref[1:].isdigit():
        code=ref[0]
        g=diodes if code=="D" else cap100 if code=="C" else smd(1.6,.8,.45,ic)
        fitted(ref,ref[0]+ref[1:].zfill(2)+" · "+f["value"],g)
for ref,label in [("SW93","BOOT"),("SW94","RUN")]:
    g=Mesh();g.box(0,0,0,4.2,3.2,.85,shield)
    g.box(0,0,.85,2.1,1.5,.45,black,.3)
    fitted(ref,label+" · service button",g,1.30)
for ref in ("J1","J2",*(f"TP{i}" for i in range(1,8))):
    o=empty(ref+" · "+fp[ref]["value"],power_col,board_root)
    place(o,board_root,*fp[ref]["xy"],-5)
    o["reference"]=ref


# A recessed rear carrier puts USB at the original x datum while clearing the Desk 3 switch.
tray = next(o for o in scene.objects if o.name.startswith("Tray |"))
g=Mesh()
g.box(0,0,-7.85,21.6,9.5,6.65,black,.35)
tool=component("Rear carrier wall pocket cutter",g,power_col,deck,95.25,-3.38)
modifier=tray.modifiers.new("Rear internal relief for USB carrier","BOOLEAN")
modifier.operation="DIFFERENCE"
modifier.solver="EXACT"
modifier.object=tool
bpy.context.view_layer.objects.active=tray
bpy.ops.object.modifier_apply(modifier=modifier.name)
bpy.data.objects.remove(tool,do_unlink=True)
tray["USB carrier pocket"]="21.6 mm wide internal relief; exterior 12 x 7 mm opening retained"
carrier=punched("J1a · USB-C carrier PCB",20.0,7.0,.50,[],1,95.25,-4.35,-6.05,power_col,usb_root)
carrier["retention"]="Proposed two lateral chassis ledges and a top keeper; trial fit before tooling"
g=Mesh()
for s in (-1,1):
    g.box(s*9.55,0,-7.15,1.20,7.5,.60,black)
    g.box(s*10.12,0,-7.70,1.10,7.5,2.72,black)
    g.box(s*9.72,0,-5.55,.75,6.0,.35,black)
component("Tray · USB carrier slide rails",g,power_col,deck,95.25,-4.52)
g=Mesh()
def shell_profile(w,h,r,y):
    return [(a,y,b+1.65) for a,b in rounded(w,h,r,7)]
g.loft([shell_profile(w,h,r,y) for w,h,r,y in [(8.94,3.26,1.18,-3.1),(8.94,3.26,1.18,3.45),
        (8.24,2.58,.98,3.45),(8.24,2.58,.98,-2.95),(8.94,3.26,1.18,-3.1)]],shield,False)
g.box(0,-2.47,.36,8.15,1.1,2.58,black,.26)
g.box(0,.32,1.37,6.5,4.72,.53,black,.27)
for i in range(12):
    x=(i-5.5)*.49
    for z in (1.35,1.895):
        g.box(x,.45,z,.24,3.6,.035,au,.09)
for x in (-4.39,4.39):
    for y in (-1.85,1.9):
        g.box(x,y,-.75,.5,1.05,1.20,tin)
j1=component("J1 · USB-C shell, tongue and mating contacts",g,power_col,usb_root,95.25,-4.68,-5.55)
j1["port_center_x_mm"]=95.25
for label,x,y,g in [
    ("F1 · 500 mA resettable fuse",102.2,-5.9,smd(3.2,1.6,.82,ceramic)),
    ("RCC1 · 5.1 k",102.55,-2.28,smd(1.6,.8,.45,ic)),
    ("RCC2 · 5.1 k",102.55,-3.56,smd(1.6,.8,.45,ic))]:
    component(label,g,power_col,usb_root,x,y,-5.55)
g=Mesh()
g.box(0,0,0,1.60,2.9,1.09,ic)
for s in (-1,1):
    for k in (-1,0,1):
        g.box(s*.95,k*.94,0,.53,.36,.20,tin)
component("U5 · USBLC6-2 ESD array",g,power_col,usb_root,88.15,-5.55,-5.55)
# Carry USB below the board, across the rear, clear of the tread and switch pins.
# Only the two short breakouts expose the individual conductors.
path=[(103.5,-2.0,-7.8),(106.5,-.4,-10.6),(111,2,-11.0),(329,2,-11.0),
      (335,3,-11.0),(340.5,6.5,-11.0),(344,11.5,-11.0),(346.2,18,-10.7),(346.2,20,-9.6)]
def deck_points(points):return [(x-cx,cy-y,z) for x,y,z in points]
g=Mesh();g.tube(deck_points(path),1.25,black,16)
jacket=component("USB harness · 2.50 mm jacket",g,power_col,board_root,cx,cy)
jacket["jacket_centerline_mm"]=sum(math.dist(a,b) for a,b in zip(path,path[1:]))
for i,(label,color) in enumerate([("VBUS",red),("D-",blue),("D+",green),("GND",black)]):
    pin=next(p for p in fp["J1"]["pads"] if p["pin"]==str(i+1))
    end=pin["xy"];g=Mesh()
    carrier_x=99.8+i*.88
    # Four carrier solder lands sit on its underside, inside its board outline.
    g.disc(carrier_x-cx,cy+2,-6.65,.34,.10,au,16)
    g.tube(deck_points([(carrier_x,-2,-6.6),(carrier_x,-2,-7.1),(103.5+(i-1.5)*.35,-2,-7.85)]),.21,color)
    g.tube(deck_points([(346.2+(1.5-i)*.35,20,-9.6),(end[0],22.6,-8.1),(*end,-6.65)]),.21,color)
    component("USB link · "+label,g,power_col,board_root,cx,cy)
# U-shaped saddles bonded to the floor. The cable lifts straight out for service.
for x in (134.,218.,309.):
    y=2.;g=Mesh()
    bottom=(3.95-deck.location.z/mm-(cy-y)*math.sin(deck.rotation_euler.x))/math.cos(deck.rotation_euler.x)
    g.box(0,0,bottom,4,5.8,-12.35-bottom,black,.4)
    for side in (-1,1):g.box(0,side*2.15,-12.5,4,1.5,2.9,black,.3)
    component("Tray saddle · USB "+str(int(x)),g,pcb_col,deck,x,y)
for ref in ("ENC1","ENC2"):
    f=fp[ref];x,y=f["xy"];g=Mesh()
    for pad in f["pads"]:
        u,v=pad["xy"]
        w,h=(.52,1.85) if pad["pin"]=="MP" else (.48,.32)
        g.box(u-x,y-v,-7.45,w,h,2.65,tin,.06)
    g.box(0,0,.30,11.6,12.2,.36,shield,.6)
    g.disc(0,0,.59,3.35,1.24,au,32)
    component("Encoder terminations · "+ref,g,pcb_col,board_root,x,y)
g=Mesh()
for i,(pin,color) in enumerate([("1",green),("2",black),("3",blue)]):
    x,y=next(p["xy"] for p in fp["J2"]["pads"] if p["pin"]==pin)
    points=[(370.4+i,48.3,1.2),(373.1+.55*i,51,.25),(373.3+.55*i,52.6,-1.9),(x,53.9,-3.4),(x,y,-4.88)]
    g.tube(deck_points(points),.22,color)
roller_leads=component("Roller · A / COM / B to J2",g,pcb_col,board_root,cx,cy)
roller_leads["pin_order"]="1 A · 2 GND · 3 B"


# A service slot in the plate lets the roller pigtail pass through before landing on the PCB.
main_plate=next(o for o in scene.objects if o.name.startswith("5052 aluminium"))
g=Mesh()
g.box(0,0,-3.2,3.8,6.3,5.0,black,.75)
tool=component("Roller lead aperture cutter",g,pcb_col,deck,374.5,53.9)
mod=main_plate.modifiers.new("Proposed roller harness aperture","BOOLEAN")
mod.operation="DIFFERENCE"
mod.solver="EXACT"
mod.object=tool
bpy.context.view_layer.objects.active=main_plate
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(tool,do_unlink=True)

marking("OMAR-KEYBOARD  /  REV A",201,22,-4.98,1.65)
for ref in ("U2","U3","U4","Y1","J1","J2","SW93","SW94"):
    x,y=fp[ref]["xy"]
    marking(ref,x,y+(4 if ref=="U2" else 1.9),-4.975,.65,power_col)
# Keep the board stack animatable in one shared datum. Distances below are display spacing.
poses=[(board_root,55),(plate_root,111),(switch_root,163),(cap_root,215)]
for group,z in poses:
    group.location=(0,0,0)
    group.keyframe_insert(data_path="location",frame=1)
    group.location.z=z*mm
    group.keyframe_insert(data_path="location",frame=61)
scene.frame_start,scene.frame_end=1,61
scene.render.fps=30
scene.timeline_markers.clear()
scene.timeline_markers.new("ASSEMBLED · true component positions",frame=1)
scene.timeline_markers.new("EXPLODED · removable layers",frame=61)
scene.frame_set(61)
scene.view_settings.look="AgX - Medium High Contrast"
scene.cycles.samples=12
scene.cycles.use_denoising=True
scene.render.threads_mode="FIXED"
scene.render.threads=10
scene.cycles.use_adaptive_sampling=True
scene.render.image_settings.file_format="PNG"
scene.render.resolution_percentage=100
studio=next(c for c in scene.collection.children if c.name.startswith("Studio"))
ground=next(o for o in studio.objects if o.type=="MESH")
cam=scene.camera
for o in studio.objects:
    if o.type=="LIGHT":
        o.location.z+=.14
        o.data.energy*=1.06
scene.view_settings.exposure=-.25


def aim(target, direction, scale):
    target=Vector(target)
    cam.location=target+Vector(direction).normalized()*.70
    cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.ortho_scale=scale
    return target


def bounds(objects):
    deps=bpy.context.evaluated_depsgraph_get()
    return [o.matrix_world @ Vector(p) for o in objects if o.type=="MESH"
            for p in o.evaluated_get(deps).bound_box]


def fit(objects,direction,pad=1.10):
    bpy.context.view_layer.update()
    cam.location=Vector(direction)
    quat=(-cam.location).to_track_quat("-Z","Y")
    pts=[quat.inverted() @ p for p in bounds(objects)]
    lo=[min(p[i] for p in pts) for i in range(3)]
    hi=[max(p[i] for p in pts) for i in range(3)]
    target=quat @ Vector([(a+b)/2 for a,b in zip(lo,hi)])
    aspect=scene.render.resolution_x/scene.render.resolution_y
    return aim(target,direction,max(hi[0]-lo[0],(hi[1]-lo[1])*aspect)*pad)


def studio_view(target):
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                space=area.spaces.active
                space.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
                space.region_3d.view_perspective="ORTHO"
                space.region_3d.view_distance=cam.data.ortho_scale*1.50
                space.region_3d.view_location=target
                space.overlay.show_overlays=False
                space.shading.color_type="MATERIAL"
                space.shading.light="STUDIO"


parts=[o for o in scene.objects if not studio.objects.get(o.name)]
scene.render.resolution_x,scene.render.resolution_y=1700,1140
target=fit(parts,(.34,-1.0,.45),1.08)
studio_view(target)
bpy.ops.object.select_all(action="DESELECT")
bpy.context.view_layer.objects.active=board_root
notes=bpy.data.texts.new("READ ME · Internal assembly")
notes.write("Omar-Keyboard • Rev A mechanical integration. Frame 1 is assembled, frame 61 exploded. The 14 Mount and Tray boss objects follow H1–H14 in KiCad. U1 is in the roller bay. The USB carrier remains behind Desk 3. Component heights, harness and barrel are first-article envelopes. See the assembly design specification.")
# Publish a closed assembly and an animated service assembly from the same contents.
scene.frame_set(1)
scene.render.resolution_x,scene.render.resolution_y=2100,1060
target=fit(parts,(.24,-1,.96),1.10)
studio_view(target)
scene.render.filepath="//Omar-Keyboard.png"
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(MODEL/"Omar-Keyboard.blend"),compress=True)
for o in parts:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/"docs/assets/omar-keyboard.glb"),export_format="GLB",use_selection=True,
                          export_extras=True,export_animations=False,export_current_frame=True,export_texcoords=False,
                          export_cameras=False,export_lights=False,export_yup=True)
scene.render.filepath=str(MODEL/"Omar-Keyboard.png")
bpy.ops.render.render(write_still=True)
scene.frame_set(61)
scene.render.resolution_x,scene.render.resolution_y=1700,1140
target=fit(parts,(.34,-1,.45),1.08)
studio_view(target)
bpy.ops.object.select_all(action="DESELECT")
scene.render.filepath="//Exploded.png"
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"Omar-Keyboard-Internals.blend"),compress=True)
print("Saved native model.",flush=True)
for o in parts:
    o.select_set(True)
# Save the exploded pose as the static default for ordinary GLB viewers.
bpy.ops.export_scene.gltf(filepath=str(OUT/"Omar-Keyboard-Internals.glb"),export_format="GLB",
                          use_selection=True,export_extras=True,export_animations=True,
                          export_animation_mode="SCENE",export_anim_scene_split_object=False,
                          export_anim_slide_to_zero=True,export_current_frame=True,export_frame_range=True,
                          export_texcoords=False,export_cameras=False,export_lights=False,export_yup=True)
print("Saved GLB.",flush=True)
scene.frame_set(61)
scene.render.filepath=str(OUT/"Exploded.png")
bpy.ops.render.render(write_still=True)

# Render a service view from the open back panel, then a top-side macro of the USB and logic area.
pcb_family=set(board_root.children_recursive)
for o in parts:
    if o.type=="MESH":
        o.hide_render=o not in pcb_family
ground.hide_render=True
scene.frame_set(1)
scene.render.film_transparent=True
scene.render.resolution_x,scene.render.resolution_y=1600,650
underlight=bpy.data.lights.new("Under-board softbox","AREA")
underlight.energy=3.1
underlight.shape="DISK"
underlight.size=.40
lamp=bpy.data.objects.new(underlight.name,underlight)
studio.objects.link(lamp)
lamp.location=(.02,-.04,-.24)
lamp.rotation_euler=(-lamp.location).to_track_quat("-Z","Y").to_euler()
fit(pcb_family,(0,-.22,-1),1.065)
scene.render.filepath=str(OUT/"PCB-underside.png")
bpy.ops.render.render(write_still=True)
scene.render.resolution_x,scene.render.resolution_y=1180,660
target=deck.matrix_world @ Vector(((94.7-cx)*mm,(cy-14.1)*mm,-6.9*mm))
aim(target,(.12,-.24,-1),.064)
scene.render.filepath=str(OUT/"Socket-detail.png")
bpy.ops.render.render(write_still=True)
lamp.hide_render=True
scene.render.resolution_x,scene.render.resolution_y=1400,820
for o in usb_root.children_recursive:o.hide_render=False
target=deck.matrix_world @ Vector(((99.0-cx)*mm,(cy-1.0)*mm,-4.4*mm))
aim(target,(-.18,.66,.83),.065)
scene.render.filepath=str(OUT/"USB-and-logic.png")
bpy.ops.render.render(write_still=True)
print("Rendered exploded stack, underside and USB/logic region.",flush=True)
# Section through the populated assembly in its closed position. Leave native files intact.
import bmesh
barrel=next(o for o in parts if o.name.startswith("Roller | Ø16"))
cut=barrel.copy()
cut.data=barrel.data.copy()
barrel.users_collection[0].objects.link(cut)
cut.hide_render=False
bm=bmesh.new()
bm.from_mesh(cut.data)
slice_info=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
    plane_co=(0,0,(342-345.59)*mm),plane_no=(0,0,1),clear_inner=True)
rim=[e for e in slice_info["geom_cut"] if isinstance(e,bmesh.types.BMEdge) and e.is_valid and e.is_boundary]
bmesh.ops.holes_fill(bm,edges=rim,sides=0)
bm.to_mesh(cut.data)
bm.free()
for o in parts:
    if o.name.startswith(("Roller | horizontal","Roller | EC11 shaft")):o.hide_render=False
target=deck.matrix_world @ Vector(((343.0-cx)*mm,(cy-42.0)*mm,.7*mm))
direction=deck.matrix_world.to_quaternion() @ Vector((-.88,-.53,.20))
aim(target,direction,.061)
scene.render.resolution_x,scene.render.resolution_y=1500,950
scene.render.filepath=str(OUT/"Controller-under-roller.png")
bpy.ops.render.render(write_still=True)

