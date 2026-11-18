"""Fuse the assembled tray, bosses, carrier rails and harness saddles into one mm STL."""
from pathlib import Path
import bpy
import bmesh
from mathutils import Matrix, Vector

model=Path(__file__).resolve().parents[1]/"hardware/model"
bpy.ops.wm.open_mainfile(filepath=str(model/"Omar-Keyboard.blend"))
bpy.context.scene.frame_set(1)
scene=bpy.context.scene
tray=next(o for o in scene.objects if o.name.startswith("Tray |"))
members=[o for o in scene.objects if o.name.startswith(("Tray boss ","Tray saddle ","Tray · USB carrier"))]
assert len(members)==18

def solid(bm,name):
    mesh=bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    return obj

def pieces(source):
    bm=bmesh.new()
    bm.from_mesh(source.data)
    bm.transform(Matrix.Scale(1000,4) @ Matrix.Translation((0,0,-.002)) @ source.matrix_world)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
    unseen=set(bm.verts)
    while unseen:
        group=set()
        pending=[next(iter(unseen))]
        while pending:
            vert=pending.pop()
            if vert not in unseen:continue
            unseen.remove(vert)
            group.add(vert)
            pending.extend(e.other_vert(vert) for e in vert.link_edges)
        piece=bmesh.new()
        verts={v:piece.verts.new(v.co) for v in group}
        for face in {f for v in group for f in v.link_faces}:
            piece.faces.new([verts[v] for v in face.verts])
        bmesh.ops.recalc_face_normals(piece,faces=list(piece.faces))
        yield solid(piece,source.name+" solid")
        piece.free()
    bm.free()

body,=pieces(tray)
for part in members:
    for item in pieces(part):
        union=body.modifiers.new("Union "+part.name,"BOOLEAN")
        union.operation="UNION"
        union.solver="MANIFOLD"
        union.object=item
        bpy.context.view_layer.objects.active=body
        bpy.ops.object.modifier_apply(modifier=union.name)
        bpy.data.objects.remove(item,do_unlink=True)
bm=bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=1e-7)
print("Invalid edges",[(list(e.verts[0].co),len(e.link_faces)) for e in bm.edges if not e.is_manifold][:12],flush=True)
assert all(e.is_manifold for e in bm.edges),"Non-manifold edge in the tray"
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
pending=[next(iter(bm.verts))]
visited=set()
while pending:
    v=pending.pop()
    if v not in visited:
        visited.add(v)
        pending.extend(e.other_vert(v) for e in v.link_edges)
assert len(visited)==len(bm.verts),"Detached retainer or support in the tray"
bm.to_mesh(body.data)
bm.free()
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.wm.stl_export(filepath=str(model/"Omar-Keyboard-Tray.stl"),export_selected_objects=True,
                      global_scale=1,use_scene_unit=False,ascii_format=False)
print("Verified single connected closed tray, 14 bosses, three saddles and two carrier rails.")

