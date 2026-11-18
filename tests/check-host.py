import runpy
from pathlib import Path
from unittest.mock import Mock

HOST = Path(__file__).resolve().parents[1] / "host/omarchy"
from lupa import LuaRuntime

host = runpy.run_path(str(HOST / "omar-host.py"))
bridge = runpy.run_path(str(HOST / "omar-indicators.py"))
current = {"address": "0x11", "workspace": {"id": 13}}

def client(address, rank, **overrides):
    return dict({"address": address, "workspace": {"id": 13}, "focusHistoryID": rank,
                 "mapped": True, "hidden": False}, **overrides)

possible = [client("0x11", 0), client("0x22", 3), client("0x33", 1),
            client("0x44", 0, hidden=True), client("0x55", 0, workspace={"id": 1}),
            client("no-address", 0), client("0x66", -1)]
assert host["previous_client"](current, possible)["address"] == "0x33"
assert host["previous_client"]({}, possible) is None
assert host["previous_client"](current, []) is None
for slot, volume, flags, expected in [("3", "Volume: 1.00 [MUTED]", 7, 3), ("6", "", 0, 0),
                                       ("0", "Volume: 0.80", 2, 0), ("5", "", 1, 5)]:
    report = bridge["packet"](slot, volume)
    assert len(report) == 33 and report[:5] == bytes([0, 0x4f, 1, flags, expected])
for text, expected in [('{"id": 3}', 3), ('{"id": 13}', 3), ('{"id": 25}', 5), ('{"id": 10}', 10),
                       ('{"id": 0}', 0), ('{"id": -98}', 0), ('{}', 0), ('{"id": "3"}', 0),
                       ('{"id": true}', 0), ('{"id": 3.0}', 0), ('[]', 0), ('null', 0), ('', 0), ('garbage', 0)]:
    assert bridge["desk_slot"](text) == expected, (text, expected)
query = bridge["should_query"]
assert query(100.0, 100.0, True) and not query(100.0, 100.0, False)
assert not query(104.9, 100.0, False) and query(105.0, 100.0, False) and query(120.0, 100.0, False)
hid = Mock()
hid.enumerate.return_value = [{"usage_page": 0xff60, "usage": 0x61, "serial_number": sn, "path": sn}
                              for sn in ["a", "b"]]
try:
    bridge["open_device"](hid, 14, 25, None)
    raise AssertionError("Ambiguous devices must not be opened")
except OSError:
    pass
bridge["open_device"](hid, 14, 25, "b")
hid.device.return_value.open_path.assert_called_once_with("b")
for strict in [None, False, True]:
    lua = LuaRuntime(unpack_returned_tuples=True)
    lua.globals().omar_five_desks = strict
    lua.execute("""
        binds={} unbinds={} events={} monitor={name='A',base=10} ws={id=11}
        o={bind=function(k,d,f) binds[k]=f end, rebind=function(k,d,f) binds[k]=f end, workspaces={}}
        hl={get_active_monitor=function()return monitor end, get_active_workspace=function()return ws end,
            unbind=function(k) table.insert(unbinds,k) end, on=function(k,f) events[k]=f end}
        o.workspaces.workspace_id=function(m,i)return m.base+i end
        o.workspaces.focus=function(i)
          return function() ws.id=monitor.base+i; if events['workspace.active'] then events['workspace.active']() end end
        end
    """)
    lua.execute((HOST / "omar-bindings.lua").read_text(encoding="utf-8"))
    assert lua.eval("binds['code:191'] and binds['code:192'] and binds['code:193']")
    if strict is False:
        assert lua.eval("#unbinds == 0 and binds['SUPER + TAB'] == nil")
        continue
    assert lua.eval("#unbinds == 15")
    lua.execute("""
        binds['SUPER + SHIFT + TAB'](); assert(ws.id==15)
        binds['SUPER + TAB'](); assert(ws.id==11)
        binds['SUPER + CTRL + TAB'](); assert(ws.id==15)
        binds['SUPER + CTRL + TAB'](); assert(ws.id==11)
        monitor={name='B',base=30}; ws={id=33}; events['monitor.focused']()
        binds['SUPER + mouse_down'](); assert(ws.id==34)
        binds['SUPER + CTRL + TAB'](); assert(ws.id==33)
        ws.id=37; events['workspace.active']()
        binds['SUPER + CTRL + TAB'](); assert(ws.id==33)
        monitor={name='A',base=10}; ws={id=11}; events['monitor.focused']()
        binds['SUPER + CTRL + TAB'](); assert(ws.id==15)
        events['monitor.removed'](monitor); binds['SUPER + CTRL + TAB'](); assert(ws.id==15)
    """)
print("Passed host focus selection, indicator packet/slot/timing/device filters, stock and five-desk Lua profiles.")
