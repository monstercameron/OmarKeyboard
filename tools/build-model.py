"""Build the revision 3 presentation assembly from the project's switch centres."""
import bpy
import csv
import os
import math
import sys
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "hardware/model"
OUT.mkdir(exist_ok=True)
rows = list(csv.DictReader((ROOT / "hardware/layout/omar-switches.csv").open(encoding="utf8", newline="")))
assert len(rows) == 92 and sum(r["zone"] != "dial" for r in rows) == 90
PITCH = 19.05
FIELD_X, FIELD_Y = 21.25*PITCH, 6.25*PITCH
CX, CY = FIELD_X/2, FIELD_Y/2
TILT = math.radians(6)
MM = 0.001

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system="METRIC"
scene.unit_settings.length_unit="MILLIMETERS"
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.threads_mode="FIXED"
scene.render.threads=8
scene.render.resolution_x=2100
scene.render.resolution_y=1060
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.view_settings.view_transform="AgX"
scene.view_settings.look="AgX - Medium High Contrast"
scene.render.film_transparent=False
scene.world=bpy.data.worlds.new("Softbox environment")
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value=(.69,.73,.77,1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.29

def collection(name):
    c=bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

case_col=collection("01  Enclosure and feet")
plate_col=collection("02  Plate and PCB")
switch_col=collection("03  Switches and stabilizers")
caps_col=collection("04  Keycaps and legends")
dial_col=collection("05  Corner dials")
roll_col=collection("06  Scroll roller")
studio=collection("Studio | camera, lights and floor")

def material(name,hex_color,rough=.43,metal=0):
    m=bpy.data.materials.new(name)
    rgb=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
    rgba=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    m.diffuse_color=rgba
    m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value=rgba
    p.inputs["Roughness"].default_value=rough
    p.inputs["Metallic"].default_value=metal
    if name.startswith("Print |"):
        p.inputs["Specular IOR Level"].default_value=.18
    return m

cream=material("PBT | ivory","f6f2e7"); mods=material("PBT | modifiers","e0e0d3")
gold=material("PBT | desk and Super","f2cd8f"); sage=material("PBT | launch rail","bdd4aa")
blue=material("PBT | window rail","cad7e0"); utility=material("PBT | utilities","dfd7c2")
violet=material("PBT | capture","d4cbe4")
ink=material("Print | charcoal","272e23",.58); desk_ink=material("Print | desks","382810")
app_ink=material("Print | launch","162e18"); wm_ink=material("Print | window","1d3140")
util_ink=material("Print | utility","312b1e"); ss_ink=material("Print | screenshot","31253f")
plum=material("Print | Fn plum","7a1346",.5); amber=material("Print | Super amber","6b3d00",.5)
chassis=material("Case | graphite anodized aluminium","434b48",.35,.68)
plate_mat=material("Plate | satin warm grey aluminium","adae9f",.4,.48)
black=material("Hardware | charcoal polymer","252b29",.5)
rubber=material("Feet and roller | rubber","343c39",.62)
knurl=material("Knob | dark aluminium","45504c",.33,.74)
steel=material("Hardware | brushed stainless","a0a7a5",.31,.82)
brass=material("Hardware | brass","aa855a",.36,.7)
pcb_mat=material("PCB | matte solder mask","204943",.54)
accent=material("Dial index | warm enamel","e8c58b",.32)
stage_mat=material("Studio | mineral grey","abb2ab",.78)

def obj(name, data, col, parent=None):
    o=bpy.data.objects.new(name,data);col.objects.link(o)
    if parent is not None: o.parent=parent
    return o

assembly=obj("Omar Keyboard | Rev 3",None,case_col)
assembly.empty_display_size=.012
deck=obj("Plate datum | 6 degree typing angle",None,plate_col,assembly)
deck.empty_display_size=.008
deck.rotation_euler.x=TILT
deck.location.z=(2+68.55*math.sin(TILT)+12.9*math.cos(TILT))*MM
deck["datum"]="Switch field top left, local Z=0 at plate top. 1 Blender unit = 1 metre."
assembly["case_width_mm"]=422.8;assembly["case_depth_mm"]=137.1
assembly["pitch_mm"]=PITCH;assembly["revision"]=3
assembly["scope"]="Appearance and fit assembly. Switch internals, PCB routing and vendor-specific clips are simplified."

def mesh_part(name,vertices,faces,mat,col,parent=deck,loc=(0,0,0),smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata([tuple(a*MM for a in v) for v in vertices],[],faces)
    data.update()
    o=obj(name,data,col,parent);o.location=tuple(a*MM for a in loc)
    if mat:data.materials.append(mat)
    if smooth:
        for p in data.polygons:p.use_smooth=True
        data.set_sharp_from_angle(angle=math.radians(38))
    return o

def roundrect(w,h,r,steps=6):
    r=min(r,w*.499,h*.499)
    pts=[]
    for sx,sy,angle in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
        cx=sx*(w/2-r);cy=sy*(h/2-r)
        for i in range(steps+1):
            a=math.radians(angle+90*i/steps)
            pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return pts

def circle(r,n=40):
    return [(r*math.cos(2*math.pi*i/n),r*math.sin(2*math.pi*i/n)) for i in range(n)]

def ringz(contour,z):
    return [(x,y,z(x,y) if callable(z) else z) for x,y in contour]

def loft(name,loops,mat,col,parent=deck,loc=(0,0,0),solid=True,smooth=False):
    n=len(loops[0]);verts=sum(loops,[]);faces=[]
    for j in range(len(loops)-1):
        for i in range(n):
            ni=(i+1)%n
            faces.append((j*n+i,j*n+ni,(j+1)*n+ni,(j+1)*n+i))
    if solid:faces.extend([tuple(reversed(range(n))),tuple(range((len(loops)-1)*n,len(loops)*n))])
    return mesh_part(name,verts,faces,mat,col,parent,loc,smooth)

def slab(name,w,h,z0,z1,r,mat,col,loc=(0,0,0),parent=deck,bevel=.15):
    a=min(bevel,(z1-z0)*.3,r*.5)
    loops=[ringz(roundrect(w-2*a,h-2*a,max(.02,r-a)),z0),ringz(roundrect(w,h,r),z0+a),
           ringz(roundrect(w,h,r),z1-a),ringz(roundrect(w-2*a,h-2*a,max(.02,r-a)),z1)]
    return loft(name,loops,mat,col,parent,loc,smooth=True)

def cyl(name,r,z0,z1,mat,col,loc=(0,0,0),parent=deck,n=48):
    a=min(.13,(z1-z0)*.16,r*.18)
    return loft(name,[ringz(circle(rr,n),z) for rr,z in [(r-a,z0),(r,z0+a),(r,z1-a),(r-a,z1)]],mat,col,parent,loc,smooth=True)

def offset(contour,x,y,reverse=False):
    result=[(a+x,b+y) for a,b in contour]
    return result[::-1] if reverse else result

def punched(name,outline,holes,z0,z1,mat,col,parent=deck,loc=(0,0,0)):
    curve=bpy.data.curves.new(name,"CURVE");curve.dimensions="2D";curve.fill_mode="BOTH"
    curve.extrude=(z1-z0)*MM/2
    for polygon in [outline]+[h[::-1] for h in holes]:
        spline=curve.splines.new("POLY");spline.points.add(len(polygon)-1)
        spline.points.foreach_set("co",[a for x,y in polygon for a in (x*MM,y*MM,0,1)])
        spline.use_cyclic_u=True
    tmp=obj("Generating "+name,curve,col)
    evaluated=tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())
    data=bpy.data.meshes.new_from_object(evaluated)
    bpy.data.objects.remove(tmp,do_unlink=True);bpy.data.curves.remove(curve)
    o=obj(name,data,col,parent);data.name=name;data.materials.append(mat)
    o.location=(loc[0]*MM,loc[1]*MM,(loc[2]+(z0+z1)/2)*MM)
    return o

def world_floor_local(y,world_z):
    return (world_z-deck.location.z/MM-y*math.sin(TILT))/math.cos(TILT)

# The centre floor is horizontal on the desk. The upper inner wall follows the tilted plate.
cw,ch=422.8,137.1
shell_loops=[
    ringz(roundrect(cw-2.8,ch-2.8,3),lambda x,y:world_floor_local(y,2)),
    ringz(roundrect(cw-.6,ch-.6,3.8),lambda x,y:world_floor_local(y,2.7)),
    ringz(roundrect(cw,ch,4),lambda x,y:world_floor_local(y,3.5)),
    ringz(roundrect(cw,ch,4),3.7),ringz(roundrect(cw-.6,ch-.6,3.7),4.45),
    ringz(roundrect(cw-1.7,ch-1.7,3.2),5),ringz(roundrect(407.65,121.91,1.8),5),
    ringz(roundrect(406.81,121.06,1.5),4.55),ringz(roundrect(406.81,121.06,1.5),-7.5),
    ringz(roundrect(406.81,121.06,1.5),lambda x,y:world_floor_local(y,4.5))]
shell=loft("Tray | 422.8 × 137.1 mm",shell_loops,chassis,case_col,smooth=True)
# Capsule-shaped USB cut through the rear case wall.
def port_solid(name,w,h,r,depth,mat,x,y,z,col):
    o=slab(name,w,h,-depth/2,depth/2,r,mat,col,loc=(x,y,z))
    o.rotation_euler.x=math.pi/2
    return o
portx=95.25-CX
cutter=port_solid("Port opening tool",12,7,1.4,20,None,portx,65,-4.6,case_col)
mod=shell.modifiers.new("USB-C opening | 12 × 7","BOOLEAN");mod.operation="DIFFERENCE";mod.object=cutter;mod.solver="EXACT"
bpy.context.view_layer.objects.active=shell
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
# Keep the broad machined faces planar around the port's triangulated cut.
for face in shell.data.polygons:
    face.use_smooth=False
portframe=punched("USB-C | receptacle shield",roundrect(9.4,3.7,1.55),[roundrect(8.3,2.7,1.15)],-.55,.55,steel,case_col,loc=(portx,66.6,-4.6))
portframe.rotation_euler.x=math.pi/2
port_solid("USB-C | dark socket",9.5,3.8,1.55,1.3,black,portx,65.5,-4.6,case_col)
port_solid("USB-C | tongue",6.1,.67,.28,1,black,portx,66.65,-4.6,case_col)
for i,(x,y) in enumerate([(-183,-50),(183,-50),(-183,50),(183,50)]):
    slab(f"Rubber foot {i+1}",24,10,0,2.3,4,rubber,case_col,(x,y,0),assembly,.35)

fixings=[(x,y) for x in (23.81,381) for y in (33.34,71.44,109.54)]
fixings += [(85.73,21.43),(171.45,21.43),(257.18,21.43),(347.66,71.44),(328.61,90.49),(366.71,90.49)]
def xy(row):
    return ((float(row["x_u"])+float(row["w_u"])/2)*PITCH-CX,CY-(float(row["y_u"])+.5)*PITCH)

switch_holes=[offset(roundrect(14,14,.18,2),*xy(row)) for row in rows]
stab_holes=[]
for row in rows:
    if row["stabilizer"]=="none":continue
    x,y=xy(row);half=50 if row["stabilizer"]=="6.25u" else 11.94
    for side in [-1,1]:
        px=x+side*half
        stab_holes.append(offset(roundrect(6.6,12.2,.25,2),px,y))
        slab("Stabilizer housing | "+row["id"]+str(side),5.5,10.2,-4.8,3,.55,black,switch_col,(px,y,0))
    slab("Stabilizer wire | "+row["id"],2*half+1,1.2,-3.0,-1.8,.45,steel,switch_col,(x,y-4,0))
mount_holes=[offset(circle(1.1,20),x-CX,CY-y) for x,y in fixings]
roller_x,roller_y=345.59-CX,CY-42.86
roller_mounts=[(347.665+sx*25.1,42.86+sy*15.6) for sx in (-1,1) for sy in (-1,1)]
roller_holes=[offset(circle(1.1,32),x-CX,CY-y) for x,y in roller_mounts]
plate=punched("5052 aluminium plate | 1.5 mm",roundrect(405.81,120.06,1),
              switch_holes+stab_holes+mount_holes+roller_holes+[offset(roundrect(44,12,.55),roller_x,roller_y)],
              -1.5,0,plate_mat,plate_col)
plate["switch cutouts"]=92;plate["cutout size mm"]=14.0
punched("PCB | FR4 envelope",roundrect(405.81,120.06,1),mount_holes,-6.6,-5,pcb_mat,plate_col)
for i,(px,py) in enumerate(fixings,1):
    x,y=px-CX,CY-py
    cyl(f"M2 collar {i:02}",2.3,-8.3,-1.5,brass,plate_col,(x,y,0),n=20)
    head=cyl(f"M2 screw {i:02}",1.75,.03,.51,steel,plate_col,(x,y,0),n=32)
    cyl(f"Socket recess {i:02}",.71,.51,.52,black,plate_col,(0,0,0),head,n=6)

font_file = os.environ.get("OMAR_LEGEND_FONT")
default_font = Path(os.environ.get("WINDIR", "/nonexistent")) / "Fonts/segoeuib.ttf"
if font_file:
    regular = bpy.data.fonts.load(str(Path(font_file).expanduser()))
elif default_font.is_file():
    regular = bpy.data.fonts.load(str(default_font))
else:
    regular = bpy.data.fonts.get("Bfont Regular") or bpy.data.fonts.get("Bfont")
    if regular is None:
        temporary_font = bpy.data.curves.new("Default legend font", "FONT")
        regular = temporary_font.font
        bpy.data.curves.remove(temporary_font)
# Text is converted to mesh once. The saved assembly is independent of system fonts.
def legend(name,word,height,cx,cy,zfunc,colour,col,parent,max_width=100):
    cv=bpy.data.curves.new("Glyph layout","FONT");cv.body=word;cv.font=regular;cv.size=1
    cv.align_x="CENTER";cv.align_y="CENTER";cv.resolution_u=4
    tmp=obj("Glyph layout",cv,col)
    dep=bpy.context.evaluated_depsgraph_get()
    glyph=bpy.data.meshes.new_from_object(tmp.evaluated_get(dep))
    bpy.data.objects.remove(tmp,do_unlink=True);bpy.data.curves.remove(cv)
    pts=[v.co.copy() for v in glyph.vertices]
    if not pts:
        bpy.data.meshes.remove(glyph);return
    xmin,xmax=min(p.x for p in pts),max(p.x for p in pts)
    ymin,ymax=min(p.y for p in pts),max(p.y for p in pts)
    # Punctuation has smaller ink bounds at the nominal four-millimetre cap height.
    height={"~":1.45,"-":.67,"=":1.95,",":1.6,".":1.03,";":2.9,"'":1.55}.get(word,height)
    sy=height/max(.01,ymax-ymin);sx=min(.84*sy,max_width/max(.01,xmax-xmin))
    for v,p in zip(glyph.vertices,pts):
        x=cx+(p.x-(xmin+xmax)/2)*sx;y=cy+(p.y-(ymin+ymax)/2)*sy
        v.co=(x*MM,y*MM,(zfunc(x,y)+.105)*MM)
    glyph.name=name
    o=obj(name,glyph,col,parent);glyph.materials.append(colour)
    return o

profiles={"R1":(15.6,-.060),"R2":(14.6,-.021),"R3":(13.8,.045),"R4":(14.4,.105),"DSA":(13.6,0)}
def colour(row):
    zone=row["zone"];k=row["id"]
    if k=="Screenshot":return violet,ss_ink
    if zone=="left rail":return sage,app_ink
    if zone=="right rail" or k=="Next Window":return blue,wm_ink
    if k.startswith("Desk ") or k in {"Last Desk","Send & Stay","Move & Go","Left Super","Right Super"}:return gold,desk_ink
    if zone=="top" and k!="Esc":return utility,util_ink
    if zone=="arrows" or (float(row["w_u"])>1 and k!="Space") or k=="Esc":return mods,ink
    return cream,ink

for row in rows:
    if row["zone"]=="dial":continue
    key=row["id"];x,y=xy(row)
    width=float(row["w_u"])*PITCH-1.05
    bw,bh=width,18;tw,th=width-4.05,13.40
    top,slope=profiles[row["keycap_row"]]
    def top_z(u,v):
        if key=="Space":return top+.4-.7*(v/(th*.5))**2+.035*v
        if row["keycap_row"]=="DSA":return top-.55+.31*(u/(tw*.5))**2+.24*(v/(th*.5))**2
        return top-.50+.55*(u/(tw*.5))**2+slope*v
    mat,ink_mat=colour(row)
    loops=[ringz(roundrect(bw-.55,bh-.55,1.05),4.4),ringz(roundrect(bw,bh,1.2),4.77),
           ringz(roundrect(bw-.10,bh-.10,1.25),5.45),
           ringz(roundrect(tw+.85,th+.85,1.82),lambda u,v:top_z(u,v)-.73),
           ringz(roundrect(tw+.36,th+.36,1.68),lambda u,v:top_z(u,v)-.18)]
    for frac in [1,.85,.7,.55,.4,.25,.10,.025]:
        loops.append(ringz(roundrect(tw*frac,th*frac,1.5*frac),top_z))
    cap=loft("Cap | "+key,loops,mat,caps_col,loc=(x,y,0),smooth=True)
    cap["switch_id"]=key;cap["profile"]=row["keycap_row"];cap["width_u"]=float(row["w_u"])
    cap["switch_x_mm"]=round(x+CX,3);cap["switch_y_mm"]=round(CY-y,3)
    cap["matrix_address"]=[int(row["matrix_row"]),int(row["matrix_col"])]
    if row["led_index"]:cap["led_index"]=int(row["led_index"])
    slab("MX housing | "+key,13.85,13.85,-4.9,3.6,.85,black,switch_col,(x,y,0))
    slab("MX stem envelope | "+key,5,5,3.5,5.3,.45,black,switch_col,(x,y,0))
    primary=row["legend_primary"];secondary=row["legend_fn"] or row["legend_super"]
    max_w=tw-1.2
    if key.startswith("Desk "):
        lines=[("Desk",1.9,2.8,ink_mat),(key[-1],4,-1.4,ink_mat)]
    elif secondary:
        lines=[(primary,4 if len(primary)==1 else 2.8,1.7,ink_mat),(secondary,1.9,-2.45,plum if row["legend_fn"] else amber)]
    elif key in {"Focus","Swap"}:
        lines=[(primary,2.8,1.6,ink_mat),("hold",1.85,-1.95,ink_mat)]
    elif key=="Menu":
        lines=[(primary,2.8,1.6,ink_mat),("Shift+Apps",1.65,-1.85,ink_mat)]
    elif key in {"Flip Split","Last Desk","Send & Stay","Move & Go","Clipboard","Mic Mute","Grab Text","Screenshot","Fullscreen"}:
        words={"Send & Stay":["Send","& Stay"],"Move & Go":["Move","& Go"],"Screenshot":["Screen","shot"],"Fullscreen":["Full","screen"]}.get(key,primary.split())
        lines=[(s,2.8,1.65-i*3.3,ink_mat) for i,s in enumerate(words)]
    else:
        lines=[(primary,4 if len(primary)==1 else 2.8,0,ink_mat)] if primary else []
    for i,(body,size,dy,ink_colour) in enumerate(lines):
        legend("Ink | "+key+" | "+str(i+1),body,size,0,dy,top_z,ink_colour,caps_col,cap,max_w)
    if key in {"F","J","Menu","Focus","Desk 5"}:
        slab("Homing bar | "+key,3.4,.67,0,.32,.29,mat,caps_col,(0,-4.8,top_z(0,-4.8)+.03),cap,.10)

# Knurled aluminium knobs, a shallow chamfer and a flush index mark.
for r in (r for r in rows if r["zone"]=="dial"):
    x,y=xy(r);control=r["legend_primary"]
    n=120
    def flutes(radius,z,amplitude=0,phase=0):
        return [((radius-(amplitude if i%2 else 0))*math.cos(2*math.pi*(i+phase)/n),
                 (radius-(amplitude if i%2 else 0))*math.sin(2*math.pi*(i+phase)/n),z) for i in range(n)]
    loops=[flutes(8.35,4),flutes(8.95,4.55,.15),flutes(9,5.15,.38),flutes(9,14.65,.38),
           flutes(8.93,15.05,.12),flutes(8.15,15.85),flutes(7.8,16)]
    knob=loft("Dial | "+r["id"],loops,knurl,dial_col,loc=(x,y,0))
    knob["outside_diameter_mm"]=18;knob["knob_height_mm"]=12
    cyl("Dial face | "+control,7.43,15.97,16.015,knurl,dial_col,parent=knob,n=72)
    slab("Index | "+control,.75,2.90,0,.10,.33,accent,dial_col,(-2.6,4.4,16.015),knob,.03)
    cyl("EC11E shaft | "+control,3,.3,5.6,steel,dial_col,(x,y,0))
    slab("EC11E body | "+control,11.8,12.6,-4.9,.35,.6,black,dial_col,(x,y,0))
    if control=="Mute":
        legend("Plate print | Mute","Mute",2.4,x,CY-21.4,lambda a,b:0,ink,dial_col,deck,17)
    else:
        legend("Plate print | Layout","Layout ·",2.4,x-7.0,CY-21.4,lambda a,b:0,ink,dial_col,deck,11.2)
        legend("Plate print | Fn Resize","Fn Resize",2.4,x+4.6,CY-21.4,lambda a,b:0,plum,dial_col,deck,12.7)

bezelx,bezely=347.665-CX,CY-42.86
bezel=punched("Roller | satin bezel",roundrect(56.2,37.2,2.2),[offset(roundrect(46,17,.85),roller_x-bezelx,0)],6.8,8,knurl,roll_col,loc=(bezelx,bezely,0))
punched("Roller | bezel skirt",roundrect(56.15,37.15,2.17),[roundrect(53.5,34.5,1.55)],.05,6.8,knurl,roll_col,loc=(bezelx,bezely,0))
legend("Bezel legend | Scroll","SCROLL",2.0,bezelx-6.7,bezely-12.1,lambda a,b:8,cream,roll_col,deck,12)
legend("Bezel legend | Fn Page","Fn PAGE",1.8,bezelx+6.0,bezely-12.1,lambda a,b:8,cream,roll_col,deck,12)
barrel_loops=[ringz(circle(7.55,80),-21),ringz(circle(7.88,80),-20.7)]
for i in range(57):
    z=-20.4+i*.72
    for dz,rad in [(0,7.88),(.14,8),(.37,8),(.54,7.88)]:
        barrel_loops.append(ringz(circle(rad,80),z+dz))
barrel_loops.extend([ringz(circle(7.88,80),20.70),ringz(circle(7.55,80),21)])
barrel=loft("Roller | Ø16 × 42 mm ribbed barrel",barrel_loops,rubber,roll_col,loc=(roller_x,roller_y,6),smooth=True)
barrel.rotation_euler.y=math.pi/2;barrel["axis_height_mm"]=6
for nm,rad,x0,x1,material_ in [("3 mm stub",1.5,320.4,325.5,steel),("MR63ZZ bearing",3,320.8,323.3,steel),("EC11 shaft",3,364.8,370,steel)]:
    part=cyl("Roller | "+nm,rad,0,x1-x0,material_,roll_col,(x0-CX,roller_y,6))
    part.rotation_euler.y=math.pi/2
slab("Roller | left bearing block",4,9,0,7.75,.5,black,roll_col,(322.09-CX,roller_y,0))
slab("Roller | horizontal EC11 envelope",7.5,12.6,.10,7.75,.5,black,roll_col,(370.84-CX,roller_y,0))
# Two clamp feet tie the supports to the four shared bezel/plate fixings.
for side in (-1,1):
    px=bezelx+side*25.1
    punched("Roller | bracket foot "+str(side),roundrect(4.4,35.2,.55),
            [offset(circle(1.1),0,dy) for dy in (-15.6,15.6)],0,1.5,black,roll_col,loc=(px,bezely,0))
for i,(px,py) in enumerate(roller_mounts,1):
    loc=(px-CX,CY-py,0)
    punched(f"Bezel | threaded post {i}",circle(2.3),[circle(.8)],1.5,6.8,knurl,roll_col,loc=loc)
    cyl(f"Bezel | underside M2 head {i}",1.9,-2.6,-1.5,steel,roll_col,loc,n=32)

def point_at(o,target):
    o.rotation_euler=(Vector(target)-o.location).to_track_quat("-Z","Y").to_euler()

def area(name,location,target,power,size,colour):
    ld=bpy.data.lights.new(name,"AREA");ld.shape="DISK";ld.energy=power;ld.size=size;ld.color=colour
    o=obj(name,ld,studio);o.location=location;point_at(o,target)

ground=slab("Studio sweep",3200,3200,-12.2,-.02,18,stage_mat,studio,parent=None)
camdata=bpy.data.cameras.new("Product | orthographic");camdata.type="ORTHO";camdata.ortho_scale=.478
camdata.clip_start=.01
camera=obj("Camera | assembly",camdata,studio);camera.location=(.115,-.51,.515)
point_at(camera,(0,0,.018));scene.camera=camera
area("Softbox | left",(-.31,-.23,.43),(0,0,0),5.4,.36,(1,.94,.84))
area("Softbox | right",(.37,.12,.35),(0,0,0),3.9,.30,(.83,.92,1))
area("Strip | rear",(-.12,.36,.22),(0,0,.015),3.1,.24,(1,.98,.91))
area("Fill | front",(.02,-.36,.20),(0,0,0),1.25,.30,(1,.97,.94))

for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=="VIEW_3D":
            s=a.spaces.active;s.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            s.region_3d.view_distance=.50;s.region_3d.view_location=(0,0,.018)
            s.region_3d.view_perspective="ORTHO";s.clip_start=.001
            s.overlay.show_overlays=False;s.shading.color_type="MATERIAL";s.shading.light="STUDIO"
scene.render.filepath=str(OUT/"Omar-Keyboard.png")
bpy.context.preferences.filepaths.save_version=0
for o in studio.objects:o.hide_set(True)  # keep the editing viewport clear; objects remain renderable
bpy.context.view_layer.update()
assert sum(o.name.startswith("Cap | ") for o in caps_col.objects)==90
assert len([o for o in dial_col.objects if o.name.startswith("Dial | ")])==2
# Both public models use one populated assembly and the same tray geometry.
if __name__ == "__main__":
    import runpy
    runpy.run_path(str(ROOT/"tools/build-internals.py"), init_globals={"exterior_ready": True})
