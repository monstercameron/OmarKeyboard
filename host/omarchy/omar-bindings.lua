-- Optional additions for ~/.config/hypr/bindings.lua on Omarchy 4.5.0.
local helper = 'python3 "$HOME/.local/share/omar-keyboard/omar-host.py" '
-- XKB input codes for physical F13, F14 and F15 (Linux EV_KEY plus 8).
o.bind("code:191", "Omar keyboard guide", helper .. "guide")
o.bind("code:192", "Return to last window on this workspace", helper .. "previous-window")
o.bind("code:193", "Mute microphone", "omarchy-audio-input-mute", { locked = true })

-- Five desks per monitor by default. Set omar_five_desks = false before loading to opt out.
if omar_five_desks ~= false then
  local history = {}
  local visits = {}
  for i = 1, 5 do visits[i] = o.workspaces.focus(i) end

  local function current_slot()
    local monitor = hl.get_active_monitor()
    local ws = hl.get_active_workspace()
    if not monitor or not ws or ws.special or monitor.active_special_workspace then return nil end
    return ws.id - o.workspaces.workspace_id(monitor, 1) + 1, monitor.name
  end

  local function remember()
    local slot, name = current_slot()
    if not slot or slot < 1 or slot > 5 then return end
    local h = history[name] or {}
    if h.current ~= slot then h.previous, h.current = h.current, slot end
    history[name] = h
  end
  local function step(delta)
    return function()
      local slot = current_slot()
      if not slot or slot < 1 or slot > 5 then visits[delta > 0 and 1 or 5]()
      else visits[(slot - 1 + delta) % 5 + 1]() end
    end
  end
  for slot = 6, 10 do
    local key = "code:" .. tostring(slot + 9)
    for _, mods in ipairs({"SUPER", "SUPER + SHIFT", "SUPER + SHIFT + ALT"}) do
      hl.unbind(mods .. " + " .. key)
    end
  end
  o.rebind("SUPER + TAB", "Next of five desks", step(1))
  o.rebind("SUPER + SHIFT + TAB", "Previous of five desks", step(-1))
  o.rebind("SUPER + mouse_down", "Next of five desks", step(1))
  o.rebind("SUPER + mouse_up", "Previous of five desks", step(-1))
  o.rebind("SUPER + CTRL + TAB", "Former desk on this monitor", function()
    local slot, name = current_slot()
    local h = history[name]
    if not h then return end
    local target = h.current
    if target == slot then target = h.previous end
    if target then visits[target]() end
  end)
  remember()
  hl.on("workspace.active", remember)
  hl.on("monitor.focused", remember)
  hl.on("monitor.removed", function(monitor)
    if monitor and monitor.name then history[monitor.name] = nil end
  end)
end
