// "Try it": the board lies flat, its keys can be clicked, and a simulated Omarchy desktop responds.
// The simulation follows the stock Omarchy 4.5.0 behavior the keys are mapped to; it is a sketch of
// Hyprland's tiling, not an emulator.

import { burst } from "./fx.js";

const viewer = document.querySelector("model-viewer");
const screen = document.querySelector(".screen");
const sentKey = document.querySelector(".play-key");
const sentChord = document.querySelector(".play-chord");
if (!viewer || !screen) throw new Error("play section missing");

const HOLD_MS = 4000;     // how long a clicked Focus, Swap, Super or Fn stays held
const MOVE_MS = 3000;     // how long Send & Stay or Move & Go waits for a desk
const ARROWS = { "←": "Left", "→": "Right", "↑": "Up", "↓": "Down" };
const CHORD = {
  "Last Desk": "Super + Ctrl + Tab", "Next Window": "Alt + Tab",
  "Flip Split": "Super + J", "Float": "Super + T", "Fullscreen": "Super + F",
  "Browser": "Super + Shift + B", "Menu": "Super + Space", "Terminal": "Super + Return", "Files": "Super + Shift + F",
  "Guide": "F13, through the optional host binding", "Clipboard": "Super + Ctrl + V", "Paste": "Super + V",
  "Alerts": "Super + Shift + Alt + comma", "Delete": "Delete", "Screenshot": "Print Screen",
  "Grab Text": "Super + Ctrl + Print Screen", "Lock": "Super + Ctrl + L", "Mic Mute": "XF86AudioMicMute",
  "Esc": "Escape", "Enter": "Return", "Backspace": "BackSpace", "Tab": "Tab", "Space": "space",
};

// ---------- the simulated desktop ----------
const APPS = {
  Terminal: { title: "Terminal" },
  Browser: { title: "Browser" },
  Files: { title: "Files" },
};
let nextId = 1;
const state = {
  active: 1, previous: 1,
  desks: { 1: [], 2: [], 3: [], 4: [], 5: [] },
  focus: { 1: null, 2: null, 3: null, 4: null, 5: null },
  lastFocus: { 1: null, 2: null, 3: null, 4: null, 5: null },
  layout: { 1: "dwindle", 2: "dwindle", 3: "dwindle", 4: "dwindle", 5: "dwindle" },
  flip: { 1: false, 2: false, 3: false, 4: false, 5: false },
  windows: {},
  pending: null,          // { mode: "send" | "move", until }
  held: null,             // { key: "Focus" | "Swap" | "Super" | "Fn", until }
  overlay: null,          // "menu" | "guide" | "clip" | "lock"
  volume: 55, muted: false, light: 70, mic: true,
  slide: 0,
};

function open(app, desk = state.active, quiet = false) {
  const count = Object.values(state.windows).filter(w => w.app === app).length;
  const w = { id: nextId++, app, title: APPS[app].title + (count ? ` ${count + 1}` : ""), floating: false, full: false,
              lines: app === "Terminal" ? ["Arch Linux with Hyprland, Omarchy 4.5.0"] : [], input: "", scroll: 0 };
  state.windows[w.id] = w;
  state.desks[desk].push(w.id);
  focusWindow(w.id, desk);
  if (!quiet) toast(`${w.title} opened on desk ${desk}`);
  return w;
}

function focusWindow(id, desk = state.active) {
  if (state.focus[desk] !== id) state.lastFocus[desk] = state.focus[desk];
  state.focus[desk] = id;
}

function focused() { return state.windows[state.focus[state.active]] || null; }

function goDesk(n) {
  if (n === state.active) return;
  state.slide = n > state.active ? 1 : -1;
  state.previous = state.active;
  state.active = n;
}

function moveWindow(n, follow) {
  const w = focused();
  if (!w) { toast("No window to move on this desk"); return; }
  if (n === state.active) { toast(`The window is already on desk ${n}`); return; }
  const from = state.active, list = state.desks[from];
  list.splice(list.indexOf(w.id), 1);
  state.focus[from] = list[list.length - 1] ?? null;
  state.desks[n].push(w.id);
  focusWindow(w.id, n);
  state.landed = n;
  if (follow) { goDesk(n); toast(`${w.title} and you moved to desk ${n}`); }
  else toast(`${w.title} sent to desk ${n}. You stayed on desk ${from}`);
}

function closeWindow() {
  const w = focused();
  if (!w) return;
  const list = state.desks[state.active];
  list.splice(list.indexOf(w.id), 1);
  delete state.windows[w.id];
  state.focus[state.active] = list[list.length - 1] ?? null;
  toast(`${w.title} closed`);
}

// Tile rectangles in fractions of the work area, in the order of the desk's window list.
function tiles(desk) {
  const ids = state.desks[desk].filter(id => !state.windows[id].floating);
  const rects = {};
  const flip = state.flip[desk];
  if (state.layout[desk] === "master" && ids.length > 1) {
    const [m, ...rest] = ids;
    rects[m] = flip ? { x: 0, y: 0, w: 1, h: 0.56 } : { x: 0, y: 0, w: 0.56, h: 1 };
    rest.forEach((id, i) => {
      const s = 1 / rest.length;
      rects[id] = flip ? { x: i * s, y: 0.56, w: s, h: 0.44 } : { x: 0.56, y: i * s, w: 0.44, h: s };
    });
    return rects;
  }
  let area = { x: 0, y: 0, w: 1, h: 1 };
  ids.forEach((id, i) => {
    if (i === ids.length - 1) { rects[id] = area; return; }
    const wide = area.w * 1.6 >= area.h;
    const sideBySide = i === 0 && flip ? !wide : wide;
    if (sideBySide) { rects[id] = { ...area, w: area.w / 2 }; area = { ...area, x: area.x + area.w / 2, w: area.w / 2 }; }
    else { rects[id] = { ...area, h: area.h / 2 }; area = { ...area, y: area.y + area.h / 2, h: area.h / 2 }; }
  });
  return rects;
}

function neighbor(dir) {
  const rects = tiles(state.active), from = rects[state.focus[state.active]];
  if (!from) return null;
  const cx = from.x + from.w / 2, cy = from.y + from.h / 2;
  let best = null, bestD = Infinity;
  for (const id in rects) {
    if (+id === state.focus[state.active]) continue;
    const r = rects[id], x = r.x + r.w / 2, y = r.y + r.h / 2;
    const ok = dir === "Left" ? x < cx - 0.01 : dir === "Right" ? x > cx + 0.01 : dir === "Up" ? y < cy - 0.01 : y > cy + 0.01;
    const d = Math.hypot(x - cx, y - cy);
    if (ok && d < bestD) { best = +id; bestD = d; }
  }
  return best;
}

// ---------- rendering ----------
screen.innerHTML = `
  <div class="os-bar">
    <div class="os-desks"></div>
    <div class="os-clock"></div>
    <div class="os-tray"></div>
  </div>
  <div class="os-work"><div class="os-tiles"></div></div>
  <div class="os-overlay" hidden></div>
  <div class="os-toasts"></div>
  <div class="os-flash"></div>`;
const els = {
  desks: screen.querySelector(".os-desks"), clock: screen.querySelector(".os-clock"), tray: screen.querySelector(".os-tray"),
  work: screen.querySelector(".os-work"), tiles: screen.querySelector(".os-tiles"), overlay: screen.querySelector(".os-overlay"),
  toasts: screen.querySelector(".os-toasts"), flash: screen.querySelector(".os-flash"),
};
const winEls = new Map();

function body(w) {
  if (w.app === "Terminal") {
    const lines = w.lines.slice(-12).map(l => `<div>${esc(l)}</div>`).join("");
    return `<div class="os-term">${lines}<div><span class="os-prompt">~ ❯</span> ${esc(w.input)}<span class="os-caret"></span></div></div>`;
  }
  if (w.app === "Browser") {
    return `<div class="os-browser"><div class="os-url">omarchy.org</div>
      <div class="os-page" style="transform: translateY(${-w.scroll}%)">
        <div class="os-h"></div>${'<div class="os-l"></div><div class="os-l s"></div><div class="os-l"></div><div class="os-img"></div>'.repeat(4)}
      </div></div>`;
  }
  return `<div class="os-files"><div class="os-side"><div>Home</div><div>Documents</div><div>Downloads</div><div>Pictures</div></div>
    <div class="os-grid">${'<div class="os-file"></div>'.repeat(8)}</div></div>`;
}

function render() {
  const now = performance.now();
  if (state.pending && now > state.pending.until) { state.pending = null; toast("Move canceled after three seconds"); }
  if (state.held && now > state.held.until) state.held = null;

  els.desks.innerHTML = [1, 2, 3, 4, 5].map(n => {
    const cls = [n === state.active && "on", state.desks[n].length && "used", state.pending && "wait"].filter(Boolean).join(" ");
    return `<span class="${cls}">${n}</span>`;
  }).join("");
  els.tray.innerHTML = `<span class="t-mic">${state.mic ? "mic on" : "mic off"}</span><span>vol ${state.muted ? "muted" : state.volume + "%"}</span><span class="t-light">light ${state.light}%</span>`;
  const t = new Date();
  els.clock.textContent = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;

  const rects = tiles(state.active), f = state.focus[state.active];
  const visible = new Set(state.desks[state.active]);
  for (const [id, el] of winEls) if (!visible.has(id) || !state.windows[id]) { el.remove(); winEls.delete(id); }
  for (const id of state.desks[state.active]) {
    const w = state.windows[id];
    let el = winEls.get(id);
    if (!el) { el = document.createElement("div"); el.className = "os-win"; els.tiles.append(el); winEls.set(id, el); }
    let r = w.floating ? { x: 0.2, y: 0.14, w: 0.6, h: 0.66 } : rects[id];
    if (w.full) r = { x: 0, y: 0, w: 1, h: 1 };
    el.style.left = `${r.x * 100}%`; el.style.top = `${r.y * 100}%`;
    el.style.width = `${r.w * 100}%`; el.style.height = `${r.h * 100}%`;
    el.classList.toggle("focus", id === f);
    el.classList.toggle("floating", w.floating);
    el.classList.toggle("full", w.full);
    el.style.zIndex = w.full ? 3 : w.floating ? 2 : 1;
    const html = `<div class="os-frame ${w.app.toLowerCase()}"><span class="os-name">${w.title}</span>${body(w)}</div>`;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  }
  // The desk a window was just sent to sparkles in the bar.
  if (state.landed) { burst(els.desks.children[state.landed - 1], { color: "#ff9e64", count: 8, spread: 18, px: 2 }); state.landed = 0; }
  els.tiles.dataset.empty = state.desks[state.active].length ? "" : `Desk ${state.active} is empty. Press Terminal, Browser or Files.`;

  if (state.slide) {
    els.tiles.animate([{ transform: `translateX(${state.slide * 8}%)`, opacity: 0.2 }, { transform: "none", opacity: 1 }],
      { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
    state.slide = 0;
  }

  els.overlay.hidden = !state.overlay;
  els.overlay.className = `os-overlay ${state.overlay || ""}`;
  const overlay = overlayHTML();
  if (els.overlay.dataset.html !== overlay) { els.overlay.innerHTML = overlay; els.overlay.dataset.html = overlay; }
  screen.style.setProperty("--light", 0.55 + state.light / 220);
  lights();
}

function overlayHTML() {
  switch (state.overlay) {
    case "menu": return `<div class="os-menu"><div class="os-search">Search applications</div>
      ${["Terminal", "Browser", "Files"].map(a => `<button type="button" data-app="${a}">${a}</button>`).join("")}</div>`;
    case "guide": return `<div class="os-guide"><b>Key guide</b>
      <div>Desk 1–5</div><div>show a desk</div><div>Send &amp; Stay, desk</div><div>send the window, stay</div>
      <div>Move &amp; Go, desk</div><div>move the window, follow it</div><div>Next Window</div><div>next window on this desk</div>
      <div>Focus + arrow</div><div>focus a neighbor</div><div>Swap + arrow</div><div>trade places</div>
      <div>Flip Split</div><div>side by side or stacked</div><div>Esc</div><div>close this guide</div></div>`;
    case "clip": return `<div class="os-menu"><div class="os-search">Clipboard history</div>
      <button type="button" data-paste="omarchy-update">omarchy-update</button>
      <button type="button" data-paste="hyprctl clients">hyprctl clients</button>
      <button type="button" data-paste="Tile windows, not tabs.">Tile windows, not tabs.</button></div>`;
    case "lock": return `<div class="os-lock"><div class="os-lock-time">${els.clock.textContent}</div><div>Locked. Press any key to return.</div></div>`;
    default: return "";
  }
}

els.overlay.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) { if (state.overlay === "lock") state.overlay = null; render(); return; }
  if (b.dataset.app) { state.overlay = null; open(b.dataset.app); }
  if (b.dataset.paste) { state.overlay = null; pasteText(b.dataset.paste); }
  render();
});

function toast(text) {
  const el = document.createElement("div");
  el.className = "os-toast";
  el.textContent = text;
  els.toasts.append(el);
  while (els.toasts.children.length > 2) els.toasts.firstElementChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 2400);
}

function esc(s) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function pasteText(text) {
  const w = focused();
  if (w?.app === "Terminal") w.input += text;
  else toast("Pasted into the focused window");
}

function say(key, chord) {
  sentKey.textContent = key;
  sentChord.textContent = chord ? `Omarchy receives ${chord}` : "";
}

// ---------- key handling ----------
function press(label) {
  pressCap(label);
  const now = performance.now();
  const holding = state.held?.key;

  if (state.overlay === "lock") { state.overlay = null; say(label, CHORD[label] || label); render(); return; }

  const desk = /^Desk ([1-5])$/.exec(label);
  if (desk) {
    const n = +desk[1];
    if (state.pending) {
      const follow = state.pending.mode === "move";
      say(`${follow ? "Move & Go" : "Send & Stay"}, then ${label}`, follow ? `Super + Shift + ${n}` : `Super + Shift + Alt + ${n}`);
      moveWindow(n, follow);
      state.pending = null;
    } else { say(label, `Super + ${n}`); goDesk(n); }
    render(); return;
  }

  if (label === "Send & Stay" || label === "Move & Go") {
    const mode = label === "Send & Stay" ? "send" : "move";
    if (state.pending?.mode === mode) { state.pending = null; say(label, ""); sentChord.textContent = "Second tap: move canceled"; }
    else { state.pending = { mode, until: now + MOVE_MS }; say(label, ""); sentChord.textContent = "Nothing sent yet. Choose a desk within three seconds"; }
    render(); return;
  }

  if (label === "Focus" || label === "Swap" || label === "Left Super" || label === "Right Super" || label === "Caps") {
    const key = label.endsWith("Super") ? "Super" : label === "Caps" ? "Fn" : label;
    state.held = { key, until: now + HOLD_MS };
    say(`${key} held`, "");
    sentChord.textContent = key === "Focus" || key === "Swap" ? "Press an arrow" : key === "Super" ? "Press a digit, an arrow or W" : "Press Next Window, an arrow or the roller";
    render(); return;
  }

  if (ARROWS[label]) {
    const dir = ARROWS[label];
    if (holding === "Focus" || holding === "Super") {
      const id = neighbor(dir);
      say(`${holding} + ${label}`, `Super + ${dir}`);
      if (id) focusWindow(id); else toast(`No window to the ${dir.toLowerCase()}`);
      state.held.until = now + HOLD_MS;
    } else if (holding === "Swap") {
      const id = neighbor(dir), list = state.desks[state.active];
      say(`Swap + ${label}`, `Super + Shift + ${dir}`);
      if (id) { const a = list.indexOf(state.focus[state.active]), b = list.indexOf(id); [list[a], list[b]] = [list[b], list[a]]; }
      else toast(`No window to the ${dir.toLowerCase()}`);
      state.held.until = now + HOLD_MS;
    } else {
      if (state.pending) { state.pending = null; toast("Move canceled. The arrow went to the window"); }
      const fn = holding === "Fn";
      say(fn ? `Fn + ${label}` : label, fn ? { Left: "Home", Right: "End", Up: "Page Up", Down: "Page Down" }[dir] : dir);
      const w = focused();
      if (w?.app === "Browser" && (dir === "Up" || dir === "Down")) w.scroll = Math.max(0, Math.min(60, w.scroll + (dir === "Down" ? 1 : -1) * (fn ? 30 : 8)));
    }
    render(); return;
  }

  if (label === "Next Window") {
    const list = state.desks[state.active];
    if (holding === "Fn") {
      const last = state.lastFocus[state.active];
      say("Fn + Next Window", "F14, through the optional host binding");
      if (last && list.includes(last)) focusWindow(last); else toast("No earlier window on this desk");
    } else {
      say(label, CHORD[label]);
      if (list.length > 1) focusWindow(list[(list.indexOf(state.focus[state.active]) + 1) % list.length]);
    }
    render(); return;
  }

  // Modifiers leave a waiting move alone, as on the board.
  if (["Left Shift", "Right Shift", "Ctrl", "Alt"].includes(label)) { say(label, label.replace(/^(Left|Right) /, "")); render(); return; }

  // A typing key cancels a waiting move and then does its usual job.
  if (state.pending && !CHORD[label]?.startsWith("Super")) { state.pending = null; toast("Move canceled. The key went to the window"); }

  const w = focused();
  switch (label) {
    case "Last Desk": say(label, CHORD[label]); goDesk(state.previous); break;
    case "Flip Split": say(label, CHORD[label]); state.flip[state.active] = !state.flip[state.active]; break;
    case "Float": say(label, CHORD[label]); if (w) { w.floating = !w.floating; w.full = false; } break;
    case "Fullscreen": say(label, CHORD[label]); if (w) w.full = !w.full; break;
    case "Terminal": case "Browser": case "Files": say(label, CHORD[label]); open(label); break;
    case "Menu": say(label, CHORD[label]); state.overlay = state.overlay === "menu" ? null : "menu"; break;
    case "Guide": say(label, CHORD[label]); state.overlay = state.overlay === "guide" ? null : "guide"; break;
    case "Clipboard": say("Clip History", CHORD[label]); state.overlay = state.overlay === "clip" ? null : "clip"; break;
    case "Paste": say(label, CHORD[label]); pasteText("omarchy-update"); break;
    case "Alerts": say(label, CHORD[label]); toast("Notifications: nothing new"); break;
    case "Mic Mute": say(label, CHORD[label]); state.mic = !state.mic; toast(state.mic ? "Microphone on" : "Microphone muted"); break;
    case "Screenshot": say(label, CHORD[label]); els.flash.animate([{ opacity: 0.9 }, { opacity: 0 }], 420); toast("Screenshot copied to the clipboard"); break;
    case "Grab Text": say(label, CHORD[label]); toast("Text from the region copied as words"); break;
    case "Lock": say(label, CHORD[label]); state.overlay = "lock"; break;
    case "Esc": say(label, CHORD[label]); state.overlay = null; state.held = null; break;
    case "Delete": case "Backspace": say(label, CHORD[label]); if (w?.app === "Terminal") w.input = w.input.slice(0, -1); break;
    case "Enter": say(label, CHORD[label]); if (w?.app === "Terminal") { w.lines.push(`~ ❯ ${w.input}`); w.input = ""; } break;
    default: typeKey(label, holding, w);
  }
  render();
}

function typeKey(label, holding, w) {
  if (holding === "Super") {
    if (label === "W") { say("Super + W", "Super + W"); closeWindow(); return; }
    if (/^[1-5]$/.test(label)) { say(`Super + ${label}`, `Super + ${label}`); goDesk(+label); return; }
    if (/^[06-9]$/.test(label)) { say(`Super + ${label}`, `Super + ${label}`); toast("Desks 6 to 10 exist, but this demo shows five"); return; }
  }
  const ch = label === "Space" ? " " : label.length === 1 ? label.toLowerCase() : "";
  say(label, ch ? `${label === "Space" ? "space" : label.toLowerCase()}` : label);
  if (ch && w?.app === "Terminal") w.input = (w.input + ch).slice(-48);
  else if (ch) toast("Typing goes to the focused window. Open a terminal to see it");
}

function dial(which, step) {
  if (which === "volume") {
    if (step === 0) { state.muted = !state.muted; say("Volume dial press", "XF86AudioMute"); toast(state.muted ? "Speakers muted" : "Speakers on"); }
    else { state.muted = false; state.volume = Math.max(0, Math.min(100, state.volume + step * 5)); say(`Volume dial ${step > 0 ? "clockwise" : "counterclockwise"}`, step > 0 ? "XF86AudioRaiseVolume" : "XF86AudioLowerVolume"); }
  } else if (step === 0) {
    state.layout[state.active] = state.layout[state.active] === "dwindle" ? "master" : "dwindle";
    say("Brightness dial press", "Super + L"); toast(`Layout: ${state.layout[state.active]}`);
  } else {
    state.light = Math.max(5, Math.min(100, state.light + step * 5));
    say(`Brightness dial ${step > 0 ? "clockwise" : "counterclockwise"}`, step > 0 ? "XF86MonBrightnessUp" : "XF86MonBrightnessDown");
  }
  render();
}

function roll(step) {
  const w = focused();
  say(`Roller ${step > 0 ? "toward you" : "away from you"}`, step > 0 ? "Scroll down" : "Scroll up");
  if (w?.app === "Browser") w.scroll = Math.max(0, Math.min(60, w.scroll + step * 4));
  render();
}

// ---------- the 3D board ----------
let scene = null;
const caps = new Map();
const LIT = ["Desk 1", "Desk 2", "Desk 3", "Desk 4", "Desk 5", "Focus", "Swap", "Mic Mute", "Caps", "Send & Stay", "Move & Go"];

function grabScene() {
  if (scene) return scene;
  const sym = Object.getOwnPropertySymbols(viewer).find(s => s.description === "scene");
  const s = sym && viewer[sym];
  if (!s?.traverse || !s.hitFromPoint) return null;
  s.traverse(o => {
    if (!o.name?.startsWith("Cap_|_")) return;
    const label = o.name.slice(6).replace(/_/g, " ");
    const cap = { obj: o, y: o.position.y, mat: null };
    if (LIT.includes(label) && o.material?.clone) { o.material = o.material.clone(); cap.mat = o.material; }
    caps.set(label, cap);
  });
  scene = s;
  return s;
}

function hit(x, y) {
  const s = grabScene();
  if (!s) return null;
  let o = s.hitFromPoint(s.getNDC(x, y))?.object;
  while (o) {
    const n = o.name || "";
    if (n.startsWith("Cap_|_")) return { key: n.slice(6).replace(/_/g, " ") };
    if (/Dial|EC11E|Index/.test(n)) return { dial: /Volume|Mute/.test(n) ? "volume" : "light" };
    if (n.startsWith("Roller")) return { roller: true };
    o = o.parent;
  }
  return null;
}

function pressCap(label) {
  const cap = caps.get(label);
  if (!cap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now();
  const step = now => {
    const t = (now - start) / 190;
    const depth = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 0.7);
    cap.obj.position.y = cap.y - 0.0028 * depth;
    scene.queueRender();
    if (t < 1) requestAnimationFrame(step); else { cap.obj.position.y = cap.y; scene.queueRender(); }
  };
  requestAnimationFrame(step);
}

// The status keys light the way Rev B.1 would: the active desk cyan, all desks amber during a move,
// the held window key blue, and Mic Mute red while the microphone is off.
function lights() {
  if (!scene) return;
  const glow = (label, hex, k) => {
    const m = caps.get(label)?.mat;
    if (!m?.emissive) return;
    m.emissive.setHex(hex);
    m.emissiveIntensity = k;
  };
  for (const l of LIT) glow(l, 0x000000, 0);
  if (!playing) { scene.queueRender(); return; }
  // A waiting move pulses; everything else holds a steady light.
  const beat = state.pending ? 0.75 + 0.55 * Math.sin(performance.now() / 160) : 0;
  for (let n = 1; n <= 5; n++) {
    if (state.pending) glow(`Desk ${n}`, 0xff8a1e, 1.1 + beat);
    else if (n === state.active) glow(`Desk ${n}`, 0x00e1ff, 0.9);
  }
  if (state.pending) glow(state.pending.mode === "send" ? "Send & Stay" : "Move & Go", 0xff8a1e, 1.6);
  if (state.held?.key === "Focus" || state.held?.key === "Swap") glow(state.held.key, 0x0041ff, 1.6);
  if (!state.mic) glow("Mic Mute", 0xff2a1a, 1.4);
  scene.queueRender();
  if (state.pending && !pulsing) { pulsing = true; requestAnimationFrame(() => { pulsing = false; if (state.pending) performance.now() > state.pending.until ? render() : lights(); }); }
}
let pulsing = false;

// ---------- input ----------
let playing = false;
addEventListener("omar:play", e => { playing = e.detail; viewer.style.cursor = ""; render(); });

viewer.addEventListener("pointerdown", e => {
  if (!playing) return;
  const h = hit(e.clientX, e.clientY);
  if (!h) return;
  e.preventDefault();
  if (h.key) {
    const desk = /^(Desk|Send|Move|Last)/.test(h.key), win = /^(Focus|Swap|Next|Flip|Float|Full)/.test(h.key);
    burst({ x: e.clientX, y: e.clientY }, { color: desk ? "#ff9e64" : win ? "#2ac3de" : "#7aa2f7", count: 5, spread: 18, px: 2, star: false });
    press(h.key);
  }
  else if (h.dial) { pressDial(h.dial); dial(h.dial, 0); }
  else if (h.roller) roll(1);
});

let hoverQueued = false;
viewer.addEventListener("pointermove", e => {
  if (!playing || hoverQueued || e.pointerType !== "mouse") return;
  hoverQueued = true;
  requestAnimationFrame(() => { hoverQueued = false; viewer.style.cursor = hit(e.clientX, e.clientY) ? "pointer" : "default"; });
});

viewer.addEventListener("wheel", e => {
  if (!playing) return;
  const h = hit(e.clientX, e.clientY);
  if (!h || h.key) return;
  e.preventDefault();
  const step = e.deltaY > 0 ? 1 : -1;
  if (h.dial) dial(h.dial, -step);
  else roll(step);
}, { passive: false });

function pressDial(which) {
  // Dials are drawn as one knob each; a short dip of the whole knob reads as a press.
  const name = which === "volume" ? "Dial_|_Volume_dial_press" : "Dial_|_Brightness_dial_press";
  let knob = null;
  scene?.traverse(o => { if (o.name === name) knob = o; });
  if (!knob) return;
  const y = knob.position.y;
  knob.position.y = y - 0.0015; scene.queueRender();
  setTimeout(() => { knob.position.y = y; scene.queueRender(); }, 140);
}

const KEYMAP = { Escape: "Esc", Enter: "Enter", Backspace: "Backspace", Delete: "Delete", Tab: "Tab", " ": "Space",
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };
addEventListener("keydown", e => {
  if (!playing || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, a, button")) return;
  const label = KEYMAP[e.key] || (/^[a-z0-9]$/i.test(e.key) ? e.key.toUpperCase() : null);
  if (!label) return;
  e.preventDefault();
  press(label);
});

// Start with something to move around.
open("Terminal", 1, true);
open("Browser", 1, true);
open("Files", 2, true);
state.focus[1] = state.desks[1][0];
render();
setInterval(() => { if (playing) render(); }, 500);
