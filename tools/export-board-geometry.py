"""Export the Rev A board's mechanical registration with KiCad's pcbnew Python module."""
import hashlib
import json
from pathlib import Path
import pcbnew as k

root = Path(__file__).resolve().parents[1]
source = root / "hardware/mainboard/omar-mainboard.kicad_pcb"
board = k.LoadBoard(str(source))
def xy(v):
    return [round(k.ToMM(v.x), 6), round(k.ToMM(v.y), 6)]

parts = {}
for f in board.GetFootprints():
    pads = []
    for p in f.Pads():
        pads.append(dict(pin=p.GetNumber(), xy=xy(p.GetPosition()), size=xy(p.GetSize()),
                         drill=xy(p.GetDrillSize()), angle=p.GetOrientationDegrees(),
                         shape=int(p.GetShape()), plated=p.GetAttribute()!=k.PAD_ATTRIB_NPTH,
                         copper=p.IsOnLayer(k.F_Cu) or p.IsOnLayer(k.B_Cu)))
    parts[f.GetReference()] = dict(xy=xy(f.GetPosition()), angle=f.GetOrientationDegrees(),
                                   back=f.IsFlipped(), value=f.GetValue(), pads=pads)
edges=k.SHAPE_POLY_SET()
assert board.GetBoardPolygonOutlines(edges) and edges.OutlineCount()==1
def points(chain):
    return [xy(chain.CPoint(i)) for i in range(chain.PointCount())]
vias,tracks=[],[]
for item in board.GetTracks():
    if isinstance(item,k.PCB_VIA):
        vias.append([*xy(item.GetPosition()), k.ToMM(item.GetDrillValue()), k.ToMM(item.GetWidth())])
    else:
        tracks.append([*xy(item.GetStart()),*xy(item.GetEnd()), k.ToMM(item.GetWidth()), int(item.GetLayer()==k.B_Cu)])
result=dict(source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            thickness=k.ToMM(board.GetDesignSettings().GetBoardThickness()),
            outline=points(edges.COutline(0)), windows=[points(edges.CHole(0,i)) for i in range(edges.HoleCount(0))],
            parts=parts, vias=sorted(vias), tracks=sorted(tracks))
target=root/"hardware/model/internals/board-geometry.json"
target.write_text(json.dumps(result,sort_keys=True,separators=(",",":"))+"\n",encoding="utf8")
print(len(parts),"footprints,",len(tracks),"segments,",len(vias),"vias,",len(result["windows"]),"interior profiles")

