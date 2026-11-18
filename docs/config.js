// The QMK configurator at the bottom of the page. It shows the keymap from the pilot build notes on
// the real switch positions, runs a port of omar_process_record() from firmware/qmk/omar-controls.h
// as keys are pressed, and writes keymap.c, config.h, rules.mk and keymap.json from the current
// keymap and build options.
import { burst, twinkle } from "./fx.js";

const root = document.querySelector(".cfg");
if (!root) throw new Error("configurator section missing");

const [geo, mat] = await Promise.all([
  fetch("assets/omar-keys.json").then(r => r.json()),
  fetch("assets/omar-matrix.json").then(r => r.json()),
]);
const [OX, OY] = geo.field_offset;
const [CW, CH] = geo.case;
const KEYS = geo.keys.map(([label, cx, cy, w, group], i) => {
  const [id, row, col, led, sw, legendFn, legendSuper] = mat.keys[i];
  return { i, id, label, cx: cx + OX, cy: cy + OY, w, group, row, col, led, sw, legendFn, legendSuper };
});
const byId = Object.fromEntries(KEYS.map(k => [k.id, k]));

// ---------------------------------------------------------------- keycodes

const MOD_NAME = { LGUI: "Super", RGUI: "Super", LSFT: "Shift", RSFT: "Shift", LCTL: "Ctrl", RCTL: "Ctrl", LALT: "Alt", RALT: "Alt" };
const MOD_ORDER = ["Super", "Ctrl", "Shift", "Alt"];
const MOD_SHORT = { LGUI: "G", LSFT: "S", LCTL: "C", LALT: "A", RGUI: "RG", RSFT: "RS", RCTL: "RC", RALT: "RA" };
const MODIFIER_KEYS = { KC_LCTL: "Ctrl", KC_RCTL: "Ctrl", KC_LSFT: "Shift", KC_RSFT: "Shift", KC_LGUI: "Super", KC_RGUI: "Super", KC_LALT: "Alt", KC_RALT: "Alt" };

// Key names as Omarchy's own binding list writes them.
const KEY_NAME = {
  KC_GRV: "`", KC_MINS: "-", KC_EQL: "=", KC_LBRC: "[", KC_RBRC: "]", KC_BSLS: "\\", KC_SCLN: ";", KC_QUOT: "'",
  KC_COMM: ",", KC_DOT: ".", KC_SLSH: "/", KC_ESC: "Esc", KC_TAB: "Tab", KC_ENT: "Return", KC_BSPC: "Backspace",
  KC_SPC: "Space", KC_DEL: "Delete", KC_INS: "Insert", KC_HOME: "Home", KC_END: "End", KC_PGUP: "Page Up",
  KC_PGDN: "Page Down", KC_LEFT: "Left", KC_RGHT: "Right", KC_UP: "Up", KC_DOWN: "Down", KC_PSCR: "Print Screen",
  KC_CAPS: "Caps Lock", KC_F13: "F13", KC_F14: "F14", KC_F15: "F15", KC_MUTE: "Mute", KC_VOLU: "Volume Up",
  KC_VOLD: "Volume Down", KC_BRIU: "Brightness Up", KC_BRID: "Brightness Down", KC_MPLY: "Play", KC_MNXT: "Next Track",
  KC_MPRV: "Previous Track", MS_WHLU: "Wheel Up", MS_WHLD: "Wheel Down",
};
for (let c = 65; c <= 90; c++) KEY_NAME[`KC_${String.fromCharCode(c)}`] = String.fromCharCode(c);
for (let d = 0; d <= 9; d++) KEY_NAME[`KC_${d}`] = String(d);

// The picker's list, grouped. The second field is the short name a key shows when remapped.
const CATALOG = [
  ["Omar", [["OM_DESK1", "Desk 1"], ["OM_DESK2", "Desk 2"], ["OM_DESK3", "Desk 3"], ["OM_DESK4", "Desk 4"], ["OM_DESK5", "Desk 5"],
    ["OM_LAST_DESK", "Last Desk"], ["OM_STAY", "Send & Stay"], ["OM_GO", "Move & Go"], ["OM_FOCUS", "Focus"], ["OM_SWAP", "Swap"],
    ["OM_NEXT", "Next Window"], ["OM_MENU", "Menu"]]],
  ["Omarchy", [["LGUI(KC_ENT)", "Terminal"], ["LGUI(LSFT(KC_B))", "Browser"], ["LGUI(LSFT(KC_F))", "Files"],
    ["LGUI(LCTL(KC_V))", "Clip History"], ["LGUI(KC_V)", "Paste"], ["LGUI(KC_C)", "Copy"], ["LGUI(KC_W)", "Close"],
    ["LGUI(LSFT(LALT(KC_COMM)))", "Alerts"], ["KC_PSCR", "Screenshot"], ["LGUI(LCTL(KC_PSCR))", "Grab Text"],
    ["LGUI(LCTL(KC_L))", "Lock"], ["LGUI(KC_J)", "Flip Split"], ["LGUI(KC_T)", "Float"], ["LGUI(KC_F)", "Fullscreen"],
    ["LGUI(KC_L)", "Layout"], ["LGUI(KC_MINS)", "Split −"], ["LGUI(KC_EQL)", "Split +"], ["LGUI(KC_K)", "Shortcuts"],
    ["LGUI(KC_TAB)", "Next Desk"], ["LGUI(LSFT(KC_TAB))", "Prev Desk"]]],
  ["Host codes", [["KC_F13", "Guide"], ["KC_F14", "Last Window"], ["KC_F15", "Mic Mute"]]],
  ["Media and wheel", [["KC_MUTE", "Mute"], ["KC_VOLD", "Vol −"], ["KC_VOLU", "Vol +"], ["KC_BRID", "Bright −"], ["KC_BRIU", "Bright +"],
    ["KC_MPLY", "Play"], ["KC_MPRV", "Prev Track"], ["KC_MNXT", "Next Track"], ["MS_WHLU", "Wheel ↑"], ["MS_WHLD", "Wheel ↓"]]],
  ["Navigation", [["KC_LEFT", "←"], ["KC_DOWN", "↓"], ["KC_UP", "↑"], ["KC_RGHT", "→"], ["KC_HOME", "Home"], ["KC_END", "End"],
    ["KC_PGUP", "PgUp"], ["KC_PGDN", "PgDn"], ["KC_INS", "Insert"], ["KC_DEL", "Delete"]]],
  ["Modifiers", [["KC_LCTL", "Left Ctrl"], ["KC_RCTL", "Right Ctrl"], ["KC_LSFT", "Shift"], ["KC_RSFT", "Shift"], ["KC_LGUI", "Super"], ["KC_RGUI", "Super"],
    ["KC_LALT", "Left Alt"], ["KC_RALT", "Alt"]]],
  ["Layers", [["LT(1, KC_CAPS)", "Caps / Fn"], ["MO(1)", "Fn"], ["KC_TRNS", "▽"], ["KC_NO", "None"]]],
  ["Backlight", [["RM_VALD", "Dimmer"], ["RM_VALU", "Brighter"], ["RM_TOGG", "Lights on/off"]]],
  ["Typing", [
    ...Array.from({ length: 26 }, (_, i) => { const c = String.fromCharCode(65 + i); return [`KC_${c}`, c]; }),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => [`KC_${d}`, String(d)]),
    ["KC_GRV", "~"], ["KC_MINS", "-"], ["KC_EQL", "="], ["KC_LBRC", "["], ["KC_RBRC", "]"], ["KC_BSLS", "\\"], ["KC_SCLN", ";"],
    ["KC_QUOT", "'"], ["KC_COMM", ","], ["KC_DOT", "."], ["KC_SLSH", "/"], ["KC_ESC", "Esc"], ["KC_TAB", "Tab"], ["KC_ENT", "Enter"],
    ["KC_BSPC", "Backspace"], ["KC_SPC", "Space"], ["KC_CAPS", "Caps Lock"]]],
];
const SHORT = {};
for (const [, list] of CATALOG) for (const [code, name] of list) SHORT[code] ??= name;

// Base keycodes from docs/build/pilot.md and docs/design/keymap.md, by switch id.
const BASE = {
  "Volume dial press": "KC_MUTE", "Esc": "KC_ESC", "Desk 1": "OM_DESK1", "Desk 2": "OM_DESK2", "Desk 3": "OM_DESK3",
  "Desk 4": "OM_DESK4", "Desk 5": "OM_DESK5", "Last Desk": "OM_LAST_DESK", "Send & Stay": "OM_STAY", "Move & Go": "OM_GO",
  "Clipboard": "LGUI(LCTL(KC_V))", "Paste": "LGUI(KC_V)", "Alerts": "LGUI(LSFT(LALT(KC_COMM)))", "Mic Mute": "KC_F15",
  "Delete": "KC_DEL", "Screenshot": "KC_PSCR", "Grab Text": "LGUI(LCTL(KC_PSCR))", "Lock": "LGUI(LCTL(KC_L))",
  "Brightness dial press": "LGUI(KC_L)", "Guide": "KC_F13", "~": "KC_GRV", "-": "KC_MINS", "=": "KC_EQL", "Backspace": "KC_BSPC",
  "Flip Split": "LGUI(KC_J)", "Browser": "LGUI(LSFT(KC_B))", "Tab": "KC_TAB", "[": "KC_LBRC", "]": "KC_RBRC", "\\": "KC_BSLS",
  "Float": "LGUI(KC_T)", "Menu": "OM_MENU", "Caps": "LT(1, KC_CAPS)", ";": "KC_SCLN", "'": "KC_QUOT", "Enter": "KC_ENT",
  "Fullscreen": "LGUI(KC_F)", "Terminal": "LGUI(KC_ENT)", "Left Shift": "KC_LSFT", ",": "KC_COMM", ".": "KC_DOT", "/": "KC_SLSH",
  "Right Shift": "KC_RSFT", "↑": "KC_UP", "Swap": "OM_SWAP", "Files": "LGUI(LSFT(KC_F))", "Ctrl": "KC_LCTL", "Left Super": "KC_LGUI",
  "Space": "KC_SPC", "Right Super": "KC_RGUI", "Next Window": "OM_NEXT", "Right Ctrl": "KC_RCTL", "←": "KC_LEFT", "↓": "KC_DOWN",
  "→": "KC_RGHT", "Focus": "OM_FOCUS",
};
for (let c = 65; c <= 90; c++) BASE[String.fromCharCode(c)] = `KC_${String.fromCharCode(c)}`;
for (let d = 0; d <= 9; d++) BASE[String(d)] = `KC_${d}`;
// Fn + [ and ] dim and brighten the backlight in steps; Fn + \ switches all the lights off and on (Rev B).
const FN = { "←": "KC_HOME", "→": "KC_END", "↑": "KC_PGUP", "↓": "KC_PGDN", "Delete": "KC_INS", "Next Window": "KC_F14",
  "[": "RM_VALD", "]": "RM_VALU", "\\": "RM_TOGG" };

const DEFAULT_LAYERS = [KEYS.map(k => BASE[k.id]), KEYS.map(k => FN[k.id] ?? "KC_TRNS")];
const missing = KEYS.filter((k, i) => !DEFAULT_LAYERS[0][i]).map(k => k.id);
if (missing.length) console.warn("No base keycode for", missing);

// Encoders in pin order: volume (GP20/21), brightness (GP22/23), roller (GP24/25).
const ENCODERS = [
  { name: "Volume dial", key: "Volume dial press", ccw: "Turn left", cw: "Turn right" },
  { name: "Brightness dial", key: "Brightness dial press", ccw: "Turn left", cw: "Turn right" },
  { name: "Scroll roller", key: null, ccw: "Push away", cw: "Pull toward you" },
];
const DEFAULT_ENC = [
  [["KC_VOLD", "KC_VOLU"], ["KC_BRID", "KC_BRIU"], ["MS_WHLU", "MS_WHLD"]],
  [["KC_VOLD", "KC_VOLU"], ["LGUI(KC_MINS)", "LGUI(KC_EQL)"], ["KC_PGUP", "KC_PGDN"]],
];

// Status roles 0–14 from the Rev B light register. Every other key just shows the white backlight.
const LED_SHOWS = {
  0: "Green while Caps Lock is on", 1: "Amber while a transfer waits for a desk; cyan on the active desk the host reports",
  6: "Amber while Send & Stay is armed", 7: "Amber while Move & Go is armed", 8: "Red while the host reports the microphone muted",
  9: "Blue while held", 10: "Blue while held", 11: "Blue while Focus or Swap is held",
};
for (const i of [2, 3, 4, 5]) LED_SHOWS[i] = LED_SHOWS[1];
for (const i of [12, 13, 14]) LED_SHOWS[i] = LED_SHOWS[11];

// Sparkle colors by key group, from Tokyo Night, Omarchy's default theme.
const FX_COLOR = { desk: "#ff9e64", launch: "#9ece6a", window: "#2ac3de", capture: "#bb9af7", dial: "#e0af68", plain: "#7aa2f7" };

const SWITCH_NAME = { tactile: "Gateron G Pro 3.0 Brown, tactile, in a hot-swap socket",
  "linear-80gf": "Cherry MX Grey, linear, about 80 gf, in a hot-swap socket",
  "EC11E-push": "Bourns PEC11R encoder with a push switch, wired into the matrix" };

const DEFAULT_OPTS = {
  tappingTerm: 200, holdOnOther: true, quickTap: 0, debounceType: "sym_defer_pk", debounce: 5,
  resDial: 4, resRoller: 2, raw: true, rgb: true, brightness: 16, nkro: true, armedPin: "", via: true,
};
// Rev B's 90 lights draw too much above a low ceiling; the 16 of 255 default keeps the board inside 450 mA.
const BRIGHT_MAX = DEFAULT_OPTS.brightness;
// Estimated whole-board draw in mA at white, from sheet 07B of the assembly specification:
// 100 mA for logic and margin, plus 90 lights at 1 mA idle and 12 mA per channel at full scale.
const boardMa = level => Math.round(100 + 90 * (1 + 36 * level / 255));

// ---------------------------------------------------------------- state and storage

const STORE = "omar-configurator-v1";
let layers = DEFAULT_LAYERS.map(l => l.slice());
let enc = structuredClone(DEFAULT_ENC);
let opts = { ...DEFAULT_OPTS };
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if (saved?.layers?.[0]?.length === KEYS.length) { layers = saved.layers; enc = saved.enc ?? enc; opts = { ...opts, ...saved.opts }; }
  // A ceiling saved for the 15-light Rev A board would overload the Rev B supply.
  if (!Number.isInteger(opts.brightness) || opts.brightness < 4 || opts.brightness > BRIGHT_MAX) opts.brightness = DEFAULT_OPTS.brightness;
  // Migrate a previously saved factory layout only when it still exactly matches the old defaults.
  const thumb = byId["Right Ctrl"].i;
  if (layers[0][thumb] === "KC_RALT" && DEFAULT_LAYERS.every((row, layer) =>
    row.every((code, key) => layers[layer]?.[key] === (layer === 0 && key === thumb ? "KC_RALT" : code)))) {
    layers[0][thumb] = "KC_RCTL";
  }
} catch { /* storage unavailable: start from the defaults */ }
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ layers, enc, opts })); } catch { /* ignore */ }
}

let tabLayer = 0, show = "label", selected = byId["Send & Stay"].i, picking = null;

// ---------------------------------------------------------------- keycode parsing and wording

function parse(code) {
  const mods = [];
  let m;
  while ((m = /^(LGUI|RGUI|LSFT|RSFT|LCTL|RCTL|LALT|RALT)\((.*)\)$/.exec(code))) { mods.push(m[1]); code = m[2]; }
  return { mods, base: code };
}
const isTrns = c => c === "KC_TRNS";
const isLT = c => /^LT\(1,\s*KC_CAPS\)$/.test(c);
const isMO = c => c === "MO(1)";
const isCustom = c => c.startsWith("OM_");
const isModifier = c => c in MODIFIER_KEYS;
const holdKey = c => isModifier(c) || isMO(c) || c === "OM_FOCUS" || c === "OM_SWAP";

function chord(mods, key) {
  const set = new Set(mods);
  return [...MOD_ORDER.filter(n => set.has(n)), key].join(" + ");
}
function keyName(base) { return KEY_NAME[base] ?? base.replace(/^KC_/, ""); }
function compact(code) {
  if (isTrns(code)) return "▽";
  let out = code.replace(/KC_/g, "");
  out = out.replace(/\b(LGUI|LSFT|LCTL|LALT|RGUI|RSFT|RCTL|RALT)\(/g, (_, m) => `${MOD_SHORT[m]}(`);
  return out;
}

// What Omarchy 4.5.0 does with a chord, from docs/design/keymap.md.
const OMARCHY = {
  "Super + Return": "opens a terminal", "Super + Shift + B": "opens the browser", "Super + Shift + F": "opens the file manager",
  "Super + Space": "opens the launcher", "Super + Alt + Space": "opens the app grid", "Super + Ctrl + V": "opens clipboard history",
  "Super + V": "pastes, in any app", "Super + C": "copies, in any app", "Super + W": "closes the focused window",
  "Super + Shift + Alt + ,": "shows notifications", "Print Screen": "takes a screenshot",
  "Super + Ctrl + Print Screen": "copies the text in a screen region", "Super + Ctrl + L": "locks the screen",
  "Super + J": "flips the split", "Super + T": "floats or tiles the window", "Super + F": "makes the window fullscreen",
  "Super + L": "changes the desk's layout", "Super + -": "narrows the split", "Super + =": "widens the split",
  "Super + Ctrl + Tab": "returns to the former desk on this monitor", "Alt + Tab": "focuses the next window on this desk",
  "Shift + Alt + Tab": "focuses the previous window on this desk", "Super + K": "shows the shortcut list",
  "Super + Tab": "shows the next desk", "Super + Shift + Tab": "shows the previous desk",
  "F13": "opens the Omar key guide, with the optional host binding",
  "F14": "returns to the last window on this desk, with the optional host binding",
  "F15": "mutes or unmutes the microphone, with the optional host binding",
  "Mute": "mutes or unmutes the speakers", "Volume Up": "raises the volume", "Volume Down": "lowers the volume",
  "Brightness Up": "brightens the screen", "Brightness Down": "dims the screen", "Wheel Up": "scrolls up under the pointer",
  "Wheel Down": "scrolls down under the pointer", "Page Up": "pages up in the focused app", "Page Down": "pages down in the focused app",
};
const DIR = { Left: "left", Right: "right", Up: "above", Down: "below" };
function meaning(text) {
  if (OMARCHY[text]) return OMARCHY[text];
  if (/^Super \+ (?:Shift \+ (?:Alt \+ )?)?[6-90]$/.test(text)) return "has no workspace binding for this number in the five-desktop profile";
  let m;
  if ((m = /^Super \+ ([1-9]|0)$/.exec(text))) return `shows desk ${m[1] === "0" ? 10 : m[1]}`;
  if ((m = /^Super \+ Shift \+ ([0-9])$/.exec(text))) return `moves the window to desk ${m[1]} and follows it`;
  if ((m = /^Super \+ Shift \+ Alt \+ ([0-9])$/.exec(text))) return `sends the window to desk ${m[1]} and stays here`;
  if ((m = /^Super \+ (Left|Right|Up|Down)$/.exec(text))) return `focuses the window ${DIR[m[1]] === "left" || DIR[m[1]] === "right" ? "to the " + DIR[m[1]] : DIR[m[1]]}`;
  if ((m = /^Super \+ Shift \+ (Left|Right|Up|Down)$/.exec(text))) return `swaps the window with the one ${DIR[m[1]] === "left" || DIR[m[1]] === "right" ? "to the " + DIR[m[1]] : DIR[m[1]]}`;
  return "";
}

// A plain sentence about a keycode, for the key panel.
const ABOUT = {
  OM_STAY: "Arms a transfer for three seconds and sends nothing yet. The next Desk key sends Super + Shift + Alt + its digit, which moves the focused window there while you stay where you are. Esc or a second press cancels it, and Move & Go replaces it.",
  OM_GO: "Arms a transfer for three seconds and sends nothing yet. The next Desk key sends Super + Shift + its digit, which moves the focused window and takes you with it. Esc or a second press cancels it, and Send & Stay replaces it.",
  OM_FOCUS: "Sends nothing by itself. While it is held, the arrows send Super + arrow and move focus to the neighboring window. Pressing it cancels a waiting transfer. If Swap is held too, Focus wins.",
  OM_SWAP: "Sends nothing by itself. While it is held, the arrows send Super + Shift + arrow and trade the focused window with its neighbor. Pressing it cancels a waiting transfer.",
  OM_NEXT: "Sends Alt + Tab, which focuses the next window on this desk. With Shift held it sends Alt + Shift + Tab and goes the other way. The firmware sends the chord exactly and then puts back whatever modifiers you were holding.",
  OM_LAST_DESK: "Sends Super + Ctrl + Tab, which returns to the former desk on this monitor. It also cancels a waiting transfer.",
  OM_MENU: "Sends Super + Space for the launcher. With Shift held it sends Super + Alt + Space for the app grid.",
  "LT(1, KC_CAPS)": "Caps Lock when tapped, Fn while held. A press shorter than the tapping term with no other key toggles Caps Lock. Holding past the tapping term, or pressing another key while it is down, selects the Fn layer. It never cancels a waiting transfer.",
  "MO(1)": "Selects the Fn layer while held.",
  KC_TRNS: "Transparent: the key does what it does on the base layer.",
  KC_NO: "Does nothing.",
};
for (let n = 1; n <= 5; n++) ABOUT[`OM_DESK${n}`] = `Sends Super + ${n} and shows desk ${n}. While a transfer is waiting, it finishes it instead: Super + Shift + Alt + ${n} after Send & Stay, Super + Shift + ${n} after Move & Go.`;

function sendsText(code) {
  if (isCustom(code) || isTrns(code) || isLT(code) || isMO(code) || code === "KC_NO") return "";
  if (isModifier(code)) return `${MODIFIER_KEYS[code]}, held with other keys`;
  const { mods, base } = parse(code);
  return chord(mods.map(m => MOD_NAME[m]), keyName(base));
}
function aboutCode(code) {
  if (ABOUT[code]) return ABOUT[code];
  if (/^0x[0-9A-F]{4}$/.test(code)) return "A keycode read from the board that this page has no name for. It is kept as a number and written back unchanged.";
  const sent = sendsText(code);
  if (!sent) return "";
  if (isModifier(code)) return code === "KC_RALT"
    ? "Sends Right Alt. Omarchy uses a held Right Alt for dictation push-to-talk, and it is AltGr on layouts that have one."
    : `A modifier. It changes the keys pressed with it and never cancels a waiting transfer.`;
  const does = meaning(sent);
  const { mods, base } = parse(code);
  if (!mods.length && /^KC_([A-Z0-9]|GRV|MINS|EQL|LBRC|RBRC|BSLS|SCLN|QUOT|COMM|DOT|SLSH|SPC|TAB|ENT|BSPC|ESC|DEL|INS)$/.test(base))
    return `Sends ${sent}.${does ? " Omarchy " + does + "." : ""} It cancels a waiting transfer.`;
  return `Sends ${sent}.${does ? " Omarchy " + does + "." : ""}`;
}

// ---------------------------------------------------------------- firmware simulation

const sim = {
  transfer: null, armedAt: 0, focus: false, swap: false, intercepted: new Set(), held: new Map(), down: new Map(),
  fn: false, fnLatched: false, caps: false, capsDown: null, desk: 1, prevDesk: 1, mic: false, log: [],
};
const TRANSFER_MS = 3000;   // fixed in omar_scan()

function layerCode(i) {
  const top = layers[1][i];
  return sim.fn && !isTrns(top) ? top : layers[0][i];
}
function heldMods() {
  const out = new Set();
  for (const code of sim.held.values()) if (isModifier(code)) out.add(MODIFIER_KEYS[code]);
  return out;
}
function log(key, code, text, sent = "") {
  sim.log.unshift({ key, code, text, sent, t: performance.now() });
  sim.log.length = Math.min(sim.log.length, 60);
}
function scan() {
  if (sim.transfer && performance.now() - sim.armedAt >= TRANSFER_MS) {
    const name = sim.transfer === "OM_STAY" ? "Send & Stay" : "Move & Go";
    sim.transfer = null;
    log(name, "", "Three seconds passed without a desk. The transfer expires and the desk keys go back to visiting.");
  }
}
// A simulated Omarchy session, so the lights the host reports back have something to show.
function hostReceives(text) {
  const numbered = /^Super \+ (?:Shift \+ )?([1-5])$/.exec(text);
  let target;
  if (numbered) target = Number(numbered[1]);
  else if (text === "Super + Tab") target = sim.desk % 5 + 1;
  else if (text === "Super + Shift + Tab") target = (sim.desk + 3) % 5 + 1;
  else if (text === "Super + Ctrl + Tab") target = sim.prevDesk;
  else if (text === "F15") sim.mic = !sim.mic;
  if (target && target !== sim.desk) [sim.prevDesk, sim.desk] = [sim.desk, target];
}
function tap(label, code, mods, key, note) {
  const text = chord(mods, key);
  hostReceives(text);
  const does = meaning(text);
  log(label, code, `${note ? note + " " : ""}${does ? "Omarchy " + does + "." : ""}`.trim(), text);
}

// omar_process_record(), step for step. Returns nothing; the trace is the output.
function process(i, code, pressed) {
  const label = KEYS[i]?.label ?? "Encoder";
  const matrix = i >= 0;
  scan();
  if (!pressed && matrix && sim.intercepted.has(i)) { sim.intercepted.delete(i); return; }
  if (code === "OM_FOCUS" || code === "OM_SWAP") {
    const was = sim.transfer;
    if (pressed) sim.transfer = null;
    if (code === "OM_FOCUS") sim.focus = pressed; else sim.swap = pressed;
    if (pressed) log(label, code, `Held. The arrows now ${code === "OM_FOCUS" ? "move focus" : "swap windows"}; nothing is sent until one is pressed.${was ? " The waiting transfer is cancelled." : ""}`);
    else log(label, code, "Released. The arrows are plain arrows again.");
    return;
  }
  const custom = isCustom(code);
  if (!pressed) {
    if (isModifier(code)) log(label, code, `${MODIFIER_KEYS[code]} is released.`);
    return;
  }
  if (!custom && (!matrix || isModifier(code) || isLT(code) || isMO(code))) {
    if (isModifier(code)) log(label, code, `${MODIFIER_KEYS[code]} is down.${sim.transfer ? " The transfer keeps waiting." : ""}`);
    else if (!matrix) basic(label, code, sim.transfer ? "The transfer keeps waiting." : "");
    return;
  }
  const previous = sim.transfer;
  const shifted = heldMods().has("Shift");
  sim.transfer = null;
  if (code === "OM_STAY" || code === "OM_GO") {
    if (previous !== code) {
      sim.transfer = code; sim.armedAt = performance.now();
      log(label, code, `Armed${previous ? ", replacing the other transfer" : ""}. The desk keys light amber and the next one finishes the move. Nothing is sent yet.`);
    } else log(label, code, "Pressed again, so the transfer is cancelled.");
    return;
  }
  const desk = /^OM_DESK([1-5])$/.exec(code);
  if (desk) {
    const mods = ["Super"];
    if (previous) mods.push("Shift");
    if (previous === "OM_STAY") mods.push("Alt");
    tap(label, code, mods, desk[1], previous ? `Finishes ${previous === "OM_STAY" ? "Send & Stay" : "Move & Go"}.` : "");
    // A finished transfer is the moment worth marking: the window has landed on its desk.
    if (previous && matrix) burst(els[i], { color: FX_COLOR.desk, count: 10, spread: 34, px: 3, within: boardScroll });
    return;
  }
  if (previous && code === "KC_ESC") {
    sim.intercepted.add(i);
    log(label, code, "Cancels the waiting transfer. The firmware swallows the press, so the app never sees Esc.");
    return;
  }
  const arrow = { KC_LEFT: "Left", KC_RGHT: "Right", KC_UP: "Up", KC_DOWN: "Down" }[code];
  if (arrow && (sim.focus || sim.swap)) {
    sim.intercepted.add(i);
    tap(label, code, sim.focus ? ["Super"] : ["Super", "Shift"], arrow, sim.focus && sim.swap ? "Focus and Swap are both held, so Focus wins." : "");
    return;
  }
  const note = previous ? "The waiting transfer is cancelled first." : "";
  if (code === "OM_NEXT") return tap(label, code, shifted ? ["Shift", "Alt"] : ["Alt"], "Tab", note);
  if (code === "OM_LAST_DESK") return tap(label, code, ["Super", "Ctrl"], "Tab", note);
  if (code === "OM_MENU") return tap(label, code, shifted ? ["Super", "Alt"] : ["Super"], "Space", note);
  basic(label, code, note);
}
function basic(label, code, note) {
  if (code === "KC_NO" || isTrns(code)) return log(label, code, `Nothing is sent.${note ? " " + note : ""}`);
  const { mods, base } = parse(code);
  const all = new Set([...heldMods(), ...mods.map(m => MOD_NAME[m])]);
  if (base === "KC_CAPS") { sim.caps = !sim.caps; return log(label, code, `Caps Lock ${sim.caps ? "on" : "off"}.`, "Caps Lock"); }
  tap(label, code, [...all], keyName(base), note);
}

function keyDown(i) {
  if (sim.down.has(i)) return;
  // Hold-on-other-key-press: a key pressed while Caps is down selects Fn at once.
  if (sim.capsDown && !sim.fn && sim.capsDown.i !== i) {
    if (opts.holdOnOther) { sim.fn = true; log("Caps", layers[0][sim.capsDown.i], "Another key went down while Caps was held, so Caps becomes Fn at once."); }
    else sim.capsDown.other = true;
  }
  const code = layerCode(i);
  sim.down.set(i, code);
  burst(els[i], { color: FX_COLOR[KEYS[i].group] ?? FX_COLOR.plain, count: 5, spread: 20, px: 2, star: false, within: boardScroll });
  if (isLT(code)) { sim.capsDown = { i, t: performance.now(), other: false }; render(); return; }
  if (isMO(code)) { sim.fn = true; log(KEYS[i].label, code, "Fn is held."); }
  if (holdKey(code)) sim.held.set(i, code);
  process(i, code, true);
  render();
}
function keyUp(i) {
  const code = sim.down.get(i);
  if (code === undefined) return;
  sim.down.delete(i);
  sim.held.delete(i);
  if (isLT(code)) {
    const t = performance.now() - (sim.capsDown?.t ?? 0);
    if (sim.fn) { sim.fn = false; sim.fnLatched = false; log("Caps", code, "Released. Fn is off."); }
    else if (t < opts.tappingTerm) { sim.caps = !sim.caps; log("Caps", code, `Tapped in ${Math.round(t)} ms, inside the ${opts.tappingTerm} ms tapping term: Caps Lock ${sim.caps ? "on" : "off"}.`, "Caps Lock"); }
    else log("Caps", code, `Held for ${Math.round(t)} ms with no other key, so it acted as Fn and nothing is sent.`);
    sim.capsDown = null;
    render();
    return;
  }
  if (isMO(code)) { sim.fn = false; log(KEYS[i].label, code, "Released. Fn is off."); }
  process(i, code, false);
  render();
}
function turn(e, dir) {
  const code = enc[sim.fn ? 1 : 0][e][dir];
  const real = isTrns(code) ? enc[0][e][dir] : code;
  const label = `${ENCODERS[e].name}, ${(dir ? ENCODERS[e].cw : ENCODERS[e].ccw).toLowerCase()}`;
  process(-1 - e, real, true);
  if (sim.log[0]) sim.log[0].key = label;
  render();
}

// ---------------------------------------------------------------- the board

const board = root.querySelector(".cfg-board");
const boardScroll = root.querySelector(".cfg-board-scroll");
const pct = (v, of) => `${(v / of * 100).toFixed(3)}%`;
board.style.setProperty("--case-ratio", `${CW} / ${CH}`);
const roller = document.createElement("button");
{
  const [rx, ry, rw, rh] = geo.roller;
  roller.type = "button";
  roller.className = "ck roller";
  Object.assign(roller.style, { left: pct(OX + rx, CW), top: pct(OY + ry, CH), width: pct(rw, CW), height: pct(rh, CH) });
  roller.innerHTML = `<span class="k-label">Roller</span>`;
  roller.setAttribute("aria-label", "Scroll roller");
  board.append(roller);
}
const els = KEYS.map(k => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `ck g-${k.group}${k.group === "dial" ? " dial" : ""}`;
  b.dataset.i = k.i;
  if (k.group === "dial") {
    const d = 15.2;
    Object.assign(b.style, { left: pct(k.cx - d / 2, CW), top: pct(k.cy - d / 2, CH), width: pct(d, CW), height: pct(d, CH) });
  } else {
    Object.assign(b.style, { left: pct(k.cx - k.w / 2 + 0.7, CW), top: pct(k.cy - 9.525 + 0.7, CH), width: pct(k.w - 1.4, CW), height: pct(17.65, CH) });
  }
  b.innerHTML = `<span class="led"></span><span class="k-label"></span>`;
  board.append(b);
  return b;
});

// Two-line legends as the real caps print them.
const CAP_TEXT = { "Right Ctrl": "Ctrl", Clipboard: "Clip History", Screenshot: "Screen shot", Fullscreen: "Full screen", "Left Super": "Super", "Right Super": "Super" };
function viewLayer() { return sim.fn ? 1 : tabLayer; }
function capLabel(k, layer) {
  const code = layers[layer][k.i];
  if (show === "code") return compact(code);
  if (layer === 1) return isTrns(code) ? "▽" : (k.legendFn && code === (FN[k.id] ?? "KC_TRNS") ? k.legendFn : SHORT[code] ?? compact(code));
  if (code === DEFAULT_LAYERS[0][k.i]) return k.group === "dial" ? (k.label === "Mute" ? "Mute" : "Layout") : CAP_TEXT[k.id] ?? k.label;
  return SHORT[code] ?? compact(code);
}
// Rev B lights every MX key white; the 15 status keys take a color over that while their state holds.
function ledColor(k) {
  if (k.group === "dial") return "";
  const led = k.led;
  const status = led == null ? ""
    : led === 0 ? (sim.caps ? "green" : "")
    : led <= 5 ? (sim.transfer ? "amber" : opts.raw && sim.desk === led ? "cyan" : "")
    : led === 6 ? (sim.transfer === "OM_STAY" ? "amber" : "")
    : led === 7 ? (sim.transfer === "OM_GO" ? "amber" : "")
    : led === 8 ? (opts.raw && sim.mic ? "red" : "")
    : led === 9 ? (sim.swap ? "blue" : "")
    : led === 10 ? (sim.focus ? "blue" : "")
    : (sim.focus || sim.swap ? "blue" : "");
  return status || "base";
}
function renderBoard() {
  const layer = viewLayer();
  board.classList.toggle("fn", layer === 1);
  board.classList.toggle("codes", show === "code");
  for (const k of KEYS) {
    const b = els[k.i], code = layers[layer][k.i];
    const label = capLabel(k, layer);
    const span = b.querySelector(".k-label");
    if (span.textContent !== label) span.textContent = label;
    b.classList.toggle("trns", layer === 1 && isTrns(code));
    b.classList.toggle("fnkey", layer === 1 && !isTrns(code));
    b.classList.toggle("changed", layers[0][k.i] !== DEFAULT_LAYERS[0][k.i] || layers[1][k.i] !== DEFAULT_LAYERS[1][k.i]);
    b.classList.toggle("down", sim.down.has(k.i));
    b.classList.toggle("sel", selected === k.i);
    b.dataset.led = opts.rgb ? ledColor(k) : "";
    b.setAttribute("aria-label", `${k.id}: ${code}`);
    b.title = code;
  }
  roller.classList.toggle("sel", selected === "roller");
  for (const btn of root.querySelectorAll("[data-layer]")) btn.setAttribute("aria-pressed", String(+btn.dataset.layer === layer));
  for (const btn of root.querySelectorAll("[data-show]")) btn.setAttribute("aria-pressed", String(btn.dataset.show === show));
}

// Pointer input. Keys that only matter while held latch, because a mouse can hold one key at a time.
let pointerKey = null;
board.addEventListener("pointerdown", e => {
  const b = e.target.closest(".ck");
  if (!b || e.button !== 0) return;
  if (b === roller) { select("roller"); return; }
  const i = +b.dataset.i;
  select(i);
  const code = layerCode(i);
  if (sim.down.has(i)) {
    // A second click lets go of a latched key.
    keyUp(i);
    return;
  }
  keyDown(i);
  if (holdKey(code)) return;
  pointerKey = i;
  b.setPointerCapture?.(e.pointerId);
});
const release = () => {
  if (pointerKey == null) return;
  const i = pointerKey;
  pointerKey = null;
  const code = sim.down.get(i);
  if (isLT(code) && !sim.fn && performance.now() - sim.capsDown.t >= opts.tappingTerm) {
    sim.fn = true; sim.fnLatched = true;
    log("Caps", code, `Held past the ${opts.tappingTerm} ms tapping term, so Fn is on. Click Caps again to let go.`);
    render();
    return;
  }
  keyUp(i);
};
board.addEventListener("pointerup", release);
board.addEventListener("pointercancel", release);
board.addEventListener("click", e => e.preventDefault());
board.addEventListener("wheel", e => {
  const b = e.target.closest(".dial, .roller");
  if (!b) return;
  e.preventDefault();
  const index = b === roller ? 2 : KEYS[+b.dataset.i].label === "Mute" ? 0 : 1;
  select(b === roller ? "roller" : +b.dataset.i);
  turn(index, e.deltaY > 0 ? 1 : 0);
}, { passive: false });

// Optional: the reader's own keyboard drives the board while focus is inside it.
const PHYSICAL = {
  Backquote: "~", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'",
  Comma: ",", Period: ".", Slash: "/", Escape: "Esc", Tab: "Tab", Enter: "Enter", Backspace: "Backspace", Delete: "Delete",
  Space: "Space", CapsLock: "Caps", ShiftLeft: "Left Shift", ShiftRight: "Right Shift", ControlLeft: "Ctrl", ControlRight: "Right Ctrl",
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", PrintScreen: "Screenshot",
  MetaLeft: "Left Super", MetaRight: "Right Super",
};
const typing = root.querySelector(".cfg-typing");
function physical(e) {
  if (!typing.checked || !board.contains(document.activeElement)) return null;
  let id = PHYSICAL[e.code];
  if (!id && /^Key[A-Z]$/.test(e.code)) id = e.code.slice(3);
  if (!id && /^Digit[0-9]$/.test(e.code)) id = e.code.slice(5);
  return id ? byId[id] : null;
}
addEventListener("keydown", e => {
  const k = physical(e);
  if (!k) return;
  e.preventDefault();
  if (e.repeat) return;
  select(k.i);
  keyDown(k.i);
});
addEventListener("keyup", e => {
  const k = physical(e);
  if (!k) return;
  e.preventDefault();
  keyUp(k.i);
});

// ---------------------------------------------------------------- the key panel

const keyPanel = root.querySelector(".cfg-key");
function select(i) {
  if (selected === i) return;
  selected = i;
  picking = null;
  renderKey();
  renderBoard();
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function codeRow(label, code, target, fallback) {
  const isDefault = target.kind === "key"
    ? DEFAULT_LAYERS[target.layer][target.i] === code
    : DEFAULT_ENC[target.layer][target.e][target.dir] === code;
  const about = isTrns(code) && fallback ? `Transparent: uses <code>${esc(fallback)}</code> from the base layer.` : esc(aboutCode(code));
  return `<div class="cfg-row">
    <div class="cfg-row-head"><span class="cfg-row-label">${esc(label)}</span><code class="cfg-code-chip">${esc(code)}</code>
      <button type="button" class="cfg-change" data-target='${esc(JSON.stringify(target))}' aria-expanded="${picking && JSON.stringify(picking) === JSON.stringify(target)}">Change</button>
      ${isDefault ? "" : `<button type="button" class="cfg-undo" data-target='${esc(JSON.stringify(target))}'>Restore</button>`}</div>
    ${about ? `<p class="cfg-about">${about}</p>` : ""}
  </div>`;
}
function renderKey() {
  let html = "";
  if (selected === "roller") {
    html = `<h3 id="cfg-key-title">Scroll roller</h3>
      <dl class="cfg-facts"><div><dt>Wiring</dt><dd>Encoder 3 on GP24 and GP25, 30 detents, no push switch</dd></div>
      <div><dt>Resolution</dt><dd>${opts.resRoller} pulses per step</dd></div></dl>`;
    html += encRows(2);
  } else {
    const k = KEYS[selected];
    const e = ENCODERS.findIndex(x => x.key === k.id);
    const title = k.group === "dial" ? (e === 0 ? "Volume dial" : "Brightness dial") : k.id;
    html = `<h3 id="cfg-key-title">${esc(title)}</h3>
      <dl class="cfg-facts">
        <div><dt>Matrix</dt><dd>Row ${k.row}, column ${k.col}</dd></div>
        <div><dt>Switch</dt><dd>${esc(SWITCH_NAME[k.sw] ?? k.sw)}</dd></div>
        ${k.group !== "dial" ? `<div><dt>Light</dt><dd>${k.led != null ? `White backlight, and status light ${k.led}: ${esc(LED_SHOWS[k.led])}.` : "White backlight."}</dd></div>` : ""}
        ${k.legendSuper ? `<div><dt>Front legend</dt><dd>Super + ${esc(k.id)} is ${esc(k.legendSuper)}</dd></div>` : ""}
      </dl>`;
    html += codeRow(k.group === "dial" ? "Press, base" : "Base layer", layers[0][k.i], { kind: "key", i: k.i, layer: 0 });
    html += codeRow(k.group === "dial" ? "Press, Fn" : "Fn layer", layers[1][k.i], { kind: "key", i: k.i, layer: 1 }, layers[0][k.i]);
    if (e >= 0) html += encRows(e);
  }
  if (picking) html += pickerHtml();
  keyPanel.innerHTML = html;
  keyPanel.querySelector(".cfg-search")?.focus({ preventScroll: true });
}
function encRows(e) {
  const E = ENCODERS[e];
  let html = `<div class="cfg-turn"><span>Turn it:</span>
    <button type="button" data-turn="${e}" data-dir="0">${esc(E.ccw)}</button>
    <button type="button" data-turn="${e}" data-dir="1">${esc(E.cw)}</button></div>`;
  for (const layer of [0, 1]) for (const dir of [0, 1]) {
    html += codeRow(`${layer ? "Fn" : "Base"}, ${(dir ? E.cw : E.ccw).toLowerCase()}`, enc[layer][e][dir], { kind: "enc", e, layer, dir }, layer ? enc[0][e][dir] : undefined);
  }
  return html;
}
let query = "";
function groupsHtml() {
  const q = query.trim().toLowerCase();
  const groups = CATALOG.map(([name, list]) => {
    const hits = list.filter(([code, short]) => !q || code.toLowerCase().includes(q) || short.toLowerCase().includes(q) || (sendsText(code) + " " + meaning(sendsText(code))).toLowerCase().includes(q));
    if (!hits.length) return "";
    return `<div class="cfg-group"><h4>${esc(name)}</h4><div class="cfg-codes">${hits.map(([code, short]) =>
      `<button type="button" class="cfg-pick" data-code="${esc(code)}" title="${esc(code)}"><b>${esc(short)}</b><code>${esc(compact(code))}</code></button>`).join("")}</div></div>`;
  }).join("");
  return groups || `<p class="cfg-about">No keycode matches “${esc(query)}”. Try a key name such as Home, or an action such as volume.</p>`;
}
function pickerHtml() {
  return `<div class="cfg-picker">
    <label class="cfg-search-label">Find a keycode <input type="search" class="cfg-search" value="${esc(query)}" placeholder="Desk, Super + T, KC_HOME, volume…" autocomplete="off"></label>
    <div class="cfg-groups">${groupsHtml()}</div>
    <button type="button" class="cfg-pick-close">Close the list</button>
  </div>`;
}
function assign(target, code) {
  if (target.kind === "key") layers[target.layer][target.i] = code;
  else enc[target.layer][target.e][target.dir] = code;
  save();
  render();
  renderFiles();
  changed();
}
keyPanel.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.turn) { turn(+b.dataset.turn, +b.dataset.dir); return; }
  if (b.classList.contains("cfg-change")) {
    const t = JSON.parse(b.dataset.target);
    picking = picking && JSON.stringify(picking) === JSON.stringify(t) ? null : t;
    query = "";
    renderKey();
    keyPanel.querySelector(".cfg-picker")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }
  if (b.classList.contains("cfg-undo")) {
    const t = JSON.parse(b.dataset.target);
    assign(t, t.kind === "key" ? DEFAULT_LAYERS[t.layer][t.i] : DEFAULT_ENC[t.layer][t.e][t.dir]);
    renderKey();
    return;
  }
  if (b.classList.contains("cfg-pick")) { const t = picking; picking = null; assign(t, b.dataset.code); renderKey(); return; }
  if (b.classList.contains("cfg-pick-close")) { picking = null; renderKey(); }
});
keyPanel.addEventListener("input", e => {
  if (!e.target.classList.contains("cfg-search")) return;
  query = e.target.value;
  keyPanel.querySelector(".cfg-groups").innerHTML = groupsHtml();
});
keyPanel.addEventListener("keydown", e => {
  if (e.key === "Escape" && picking) { picking = null; renderKey(); }
});

// ---------------------------------------------------------------- the trace

const lastEl = root.querySelector(".cfg-last");
const stateEl = root.querySelector(".cfg-state"), timerEl = root.querySelector(".cfg-timer"), logEl = root.querySelector(".cfg-log");
function renderTrace() {
  const held = [...new Set([...sim.held.values()].map(c => SHORT[c] ?? MODIFIER_KEYS[c] ?? c))];
  if (sim.fn) held.unshift("Fn");
  const pending = sim.transfer ? (sim.transfer === "OM_STAY" ? "Send & Stay" : "Move & Go") : "";
  stateEl.innerHTML = `<div><dt>Layer</dt><dd>${sim.fn ? "Fn" : "Base"}</dd></div>
    <div><dt>Held</dt><dd>${held.length ? esc(held.join(", ")) : "nothing"}</dd></div>
    <div><dt>Transfer</dt><dd>${pending ? `${pending}, waiting for a desk` : "none"}</dd></div>
    <div><dt>Host</dt><dd>${opts.raw ? `desk ${sim.desk}, microphone ${sim.mic ? "muted" : "on"}` : "indicator bridge off"}</dd></div>`;
  timerEl.hidden = !pending;
  // Under the pinned board on narrow screens: the newest trace line, so a press shows its result
  // whichever panel is open.
  const x = sim.log[0];
  lastEl.innerHTML = x ? `<b>${esc(x.key)}</b> ${x.sent ? `sends <kbd>${esc(x.sent)}</kbd> ` : ""}${esc(x.sent ? "" : x.text)}`
    : pending ? `${esc(pending)} is waiting for a desk.` : "Click a key to press it.";
  logEl.innerHTML = sim.log.length ? sim.log.map(x => `<li>
      <div class="cfg-log-head"><b>${esc(x.key)}</b>${x.code ? `<code>${esc(x.code)}</code>` : ""}</div>
      ${x.sent ? `<div class="cfg-sent">Sends <kbd>${esc(x.sent)}</kbd></div>` : ""}
      ${x.text ? `<div class="cfg-what">${esc(x.text)}</div>` : ""}
    </li>`).join("") : `<li class="cfg-empty">Click a key on the board to press it, and each step the firmware takes shows here. Try Send &amp; Stay, then Desk 3. Shift, Ctrl, Super, Focus and Swap stay down until clicked again; hold Caps past the tapping term for Fn.</li>`;
}
root.querySelector(".cfg-clear").addEventListener("click", () => { sim.log.length = 0; renderTrace(); });

let timerRunning = false;
function render() {
  renderBoard();
  renderTrace();
  if (sim.transfer && !timerRunning) {
    timerRunning = true;
    requestAnimationFrame(function loop() {
      scan();
      if (sim.transfer) {
        const left = Math.max(0, TRANSFER_MS - (performance.now() - sim.armedAt));
        timerEl.firstElementChild.style.width = `${(left / TRANSFER_MS * 100).toFixed(1)}%`;
        timerEl.dataset.left = `${(left / 1000).toFixed(1)} s to choose a desk`;
        requestAnimationFrame(loop);
      } else { timerRunning = false; renderBoard(); renderTrace(); }
    });
  }
}

// ---------------------------------------------------------------- build options

const form = root.querySelector(".cfg-form");
form.innerHTML = `
  <fieldset><legend>Caps and Fn</legend>
    <label class="cfg-range">Tapping term <output data-for="tappingTerm"></output>
      <input type="range" name="tappingTerm" min="100" max="400" step="10"></label>
    <p class="cfg-about">How long Caps can be held and still count as a tap. The prototype starts at 200&nbsp;ms; a value that is too short turns quick Caps taps into Fn.</p>
    <label class="cfg-check"><input type="checkbox" name="holdOnOther"> Hold on other key press</label>
    <p class="cfg-about">Pressing any key while Caps is down selects Fn at once, instead of waiting for the tapping term.</p>
    <label class="cfg-num">Quick tap term <input type="number" name="quickTap" min="0" max="400" step="10"> ms</label>
    <p class="cfg-about">0 means holding Caps straight after a tap still gives Fn rather than a held Caps Lock.</p>
  </fieldset>
  <fieldset><legend>Switches and encoders</legend>
    <label class="cfg-num">Debounce <select name="debounceType">
      <option value="sym_defer_pk">sym_defer_pk</option><option value="sym_defer_g">sym_defer_g</option>
      <option value="sym_eager_pk">sym_eager_pk</option><option value="asym_eager_defer_pk">asym_eager_defer_pk</option></select>
      <input type="number" name="debounce" min="1" max="20"> ms</label>
    <label class="cfg-num">Dial resolution <input type="number" name="resDial" min="1" max="8"> pulses per step</label>
    <label class="cfg-num">Roller resolution <input type="number" name="resRoller" min="1" max="8"> pulses per step</label>
    <label class="cfg-check"><input type="checkbox" name="nkro"> N-key rollover</label>
  </fieldset>
  <fieldset><legend>Lights</legend>
    <label class="cfg-check"><input type="checkbox" name="rgb"> Per-key lights (RGB Matrix, 90 SK6812MINI-E)</label>
    <p class="cfg-about">White under every key, with the 15 status keys taking a color over it. Off, the lights' power switch stays open and the board draws nothing for them.</p>
    <label class="cfg-range">Maximum brightness <output data-for="brightness"></output>
      <input type="range" name="brightness" min="4" max="${BRIGHT_MAX}" step="4"></label>
    <p class="cfg-about cfg-power"></p>
    <label class="cfg-check"><input type="checkbox" name="raw"> Indicator bridge (Raw HID)</label>
    <p class="cfg-about">Lets <code>omar-indicators.py</code> report the active desk and the microphone, so those keys can light. Host state that is not confirmed for 3 seconds turns off.</p>
    <label class="cfg-num">Armed light pin <input type="text" name="armedPin" placeholder="none" maxlength="5" spellcheck="false" pattern="GP[0-9]{1,2}"></label>
    <p class="cfg-about">For a pilot board without per-key LEDs: one light on this pin shows a waiting transfer or a held Focus or Swap. On the Rev B.2 board GP27 and GP28 run the lights' power, so only GP29 is free.</p>
  </fieldset>
  <fieldset><legend>USB</legend>
    <label class="cfg-check"><input type="checkbox" name="via"> Live editing over USB (VIA)</label>
    <p class="cfg-about">Keeps a copy of the keymap in the controller's flash, so this page can read and change it over USB without a rebuild. A keymap written over USB is used instead of the one in <code>keymap.c</code> until the board's built-in keymap is restored. The VIA desktop app would also need a keyboard definition file, which the project does not have yet.</p>
  </fieldset>
  <p class="cfg-about">The three-second transfer window is fixed in <code>omar_scan()</code> in <code>omar-controls.h</code>.</p>`;
function syncForm() {
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") el.checked = !!opts[el.name]; else el.value = opts[el.name];
  }
  form.querySelector('[data-for="tappingTerm"]').textContent = `${opts.tappingTerm} ms`;
  form.querySelector('[data-for="brightness"]').textContent = `${opts.brightness} of 255`;
  form.elements.brightness.disabled = !opts.rgb;
  const ma = boardMa(opts.brightness);
  form.querySelector(".cfg-power").textContent = `With every key white at this ceiling the whole board would draw about ${ma} mA, estimated from the light's data sheet. The board asks the computer for 500 mA, and the design target is 450 mA or less.${ma > 500 ? " That is more than the port can supply." : ma > 450 ? " That is over the 450 mA target." : ""}`;
  form.querySelector(".cfg-power").classList.toggle("warn", ma > 450);
}
form.addEventListener("input", e => {
  const el = e.target;
  if (!el.name) return;
  let v = el.type === "checkbox" ? el.checked : el.type === "number" || el.type === "range" ? Number(el.value) : el.value.trim().toUpperCase();
  if (el.type === "number") v = Math.min(Math.max(v || 0, +el.min), +el.max);
  if (el.name === "armedPin" && v && !/^GP\d{1,2}$/.test(v)) return;
  opts[el.name] = v;
  save();
  syncForm();
  render();
  renderFiles();
  renderUsb();
});

// ---------------------------------------------------------------- generated files

function rowsOf(list) {
  // Group LAYOUT arguments by physical row, the way the switch CSV orders them.
  const rows = [];
  let last = null;
  KEYS.forEach((k, i) => {
    const r = Math.round((k.cy - OY - 9.525) / 19.05 * 4) / 4;
    const band = r < 1 ? 0 : Math.floor(r - 0.25) + 1;
    if (band !== last) { rows.push([]); last = band; }
    rows[rows.length - 1].push(list[i]);
  });
  return rows;
}
function layoutC(list) {
  return rowsOf(list).map(r => "        " + r.join(", ")).join(",\n");
}
function files() {
  const fnName = ["BASE", "FN"];
  const encLine = l => enc[l].map(([a, b]) => `ENCODER_CCW_CW(${a}, ${b})`).join(", ");
  const keymap = `// Omar-Keyboard Rev B.1, Omarchy keymap. Written by the configurator on the project site.
// Copy omar-controls.h${opts.raw ? " and omar-indicators.h" : ""} from firmware/qmk/ into this keymap directory.
#include QMK_KEYBOARD_H
${opts.rgb ? '#include "usb_device_state.h"\n' : ""}#include "omar-controls.h"
${opts.raw ? '#include "omar-indicators.h"\n' : ""}
enum layers { BASE, FN };

// LAYOUT follows hardware/layout/omar-switches.csv: one line per physical row, left to right.
const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
${[0, 1].map(l => `    [${fnName[l]}] = LAYOUT(\n${layoutC(layers[l])}\n    )`).join(",\n")}
};

#ifdef ENCODER_MAP_ENABLE
// Volume dial, brightness dial, roller. The roller's first direction is a push away from you.
const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS] = {
    [BASE] = { ${encLine(0)} },
    [FN]   = { ${encLine(1)} },
};
#endif

bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    return omar_process_record(keycode, record);
}

${opts.rgb ? `
// Pixels for the 15 status roles in the Rev B light register: Caps, Desk 1–5, Send & Stay,
// Move & Go, Mic Mute, Swap, Focus, then Right, Down, Left and Up.
static const uint8_t status_pixel[15] = {62, 1, 2, 3, 4, 5, 7, 8, 12, 78, 79, 80, 81, 82, 77};

// GP27 closes U5, the load switch on the lights' 5 V rail. GP28 low enables U4, the data buffer.
// The rail stays off until USB is configured, and the buffer waits 5 ms for it to settle.
static bool led_rail_on;
static uint32_t led_rail_started;

static void lighting_off(void) {
    gpio_write_pin_high(GP28);
    gpio_write_pin_low(GP27);
    led_rail_on = false;
}

void keyboard_pre_init_user(void) {
    gpio_write_pin_high(GP28);
    gpio_set_pin_output(GP28);
    gpio_write_pin_low(GP27);
    gpio_set_pin_output(GP27);
}
` : ""}
void keyboard_post_init_user(void) {
    omar_init();
}

void matrix_scan_user(void) {
    omar_scan();
${opts.raw ? "    omar_scan_indicators();\n" : ""}${opts.rgb ? `    if (usb_device_state_get_configure_state() != USB_DEVICE_STATE_CONFIGURED ||
        !rgb_matrix_is_enabled() || !rgb_matrix_get_val()) {
        lighting_off();
        return;
    }
    if (!led_rail_on) {
        gpio_write_pin_high(GP27);
        led_rail_started = timer_read32();
        led_rail_on = true;
    } else if (timer_elapsed32(led_rail_started) >= 5) {
        gpio_write_pin_low(GP28);
    }
` : ""}}

void suspend_power_down_user(void) {
${opts.rgb ? "    lighting_off();\n" : ""}    omar_reset_input();
${opts.raw ? "    omar_clear_indicators();\n" : ""}}
${opts.rgb ? `
#ifdef RGB_MATRIX_ENABLE
// Color weights are 0–255; the brightness level scales every channel, so no status color
// can exceed the ceiling. Local gestures override host state. Not yet run on hardware.
static void status_color(uint8_t role, uint8_t level, uint8_t r, uint8_t g, uint8_t b) {
    rgb_matrix_set_color(status_pixel[role], r * level / 255, g * level / 255, b * level / 255);
}

bool rgb_matrix_indicators_user(void) {
    uint8_t level = MIN(rgb_matrix_get_val(), RGB_MATRIX_MAXIMUM_BRIGHTNESS);
    rgb_matrix_set_color_all(level, level, level);
    if (host_keyboard_led_state().caps_lock) status_color(0, level, 60, 255, 60);
    if (omar_transfer) {
        for (uint8_t i = 1; i <= 5; i++) status_color(i, level, 255, 100, 0);
        status_color(omar_transfer == OM_STAY ? 6 : 7, level, 255, 100, 0);
    }${opts.raw ? ` else if (omar_lit_desk) {
        status_color(omar_lit_desk, level, 0, 225, 255);
    }
    if (omar_mic_known && omar_mic_muted) status_color(8, level, 255, 0, 0);` : ""}
    if (omar_swap_held) status_color(9, level, 0, 65, 255);
    if (omar_focus_held) status_color(10, level, 0, 65, 255);
    if (omar_focus_held || omar_swap_held) {
        for (uint8_t i = 11; i <= 14; i++) status_color(i, level, 0, 65, 255);
    }
    return false;
}
#endif
` : ""}`;

  const config = `#pragma once

// Caps: tap for Caps Lock, hold for Fn.
#define TAPPING_TERM ${opts.tappingTerm}
${opts.holdOnOther ? "#define HOLD_ON_OTHER_KEY_PRESS\n" : ""}#define QUICK_TAP_TERM ${opts.quickTap}

#define DEBOUNCE ${opts.debounce}
#define USB_POLLING_INTERVAL_MS 1
${opts.via ? `
// Live editing over USB: Base and Fn are stored in flash.
#define DYNAMIC_KEYMAP_LAYER_COUNT 2
` : ""}
// Volume dial, brightness dial, roller.
#define ENCODER_RESOLUTIONS { ${opts.resDial}, ${opts.resDial}, ${opts.resRoller} }
${opts.rgb ? `
// 90 lights. About ${boardMa(opts.brightness)} mA for the whole board with every key white at this ceiling.
// The rev_b keyboard definition starts the lights at 8 and steps them by 4.
#define RGB_MATRIX_MAXIMUM_BRIGHTNESS ${opts.brightness}
` : ""}${opts.armedPin ? `
// One armed light for a pilot board: a waiting transfer or a held Focus or Swap.
#define OMAR_ARMED_LED_PIN ${opts.armedPin}
` : ""}`;

  const rules = `ENCODER_ENABLE = yes
ENCODER_MAP_ENABLE = yes
EXTRAKEY_ENABLE = yes
MOUSEKEY_ENABLE = yes
${opts.raw ? "RAW_ENABLE = yes\n" : ""}${opts.via ? "VIA_ENABLE = yes\n" : ""}${opts.nkro ? "NKRO_ENABLE = yes\n" : ""}${opts.rgb ? "RGB_MATRIX_ENABLE = yes\nRGB_MATRIX_DRIVER = ws2812\nWS2812_DRIVER = vendor\n" : ""}DEBOUNCE_TYPE = ${opts.debounceType}
`;

  const json = JSON.stringify({
    version: 1,
    notes: "Omar-Keyboard Rev B.1. The OM_ keycodes need keymap.c and omar-controls.h; this file alone does not define them.",
    keyboard: "omar_keyboard/rev_b",
    keymap: "omarchy",
    layout: "LAYOUT",
    layers,
    encoders: [0, 1].map(l => enc[l].map(([ccw, cw]) => ({ ccw, cw }))),
    config: { tapping: { term: opts.tappingTerm } },
  }, null, 2).replace(/\[\n\s+("[^\]]*?)\n\s+\]/g, (m, inner) => {
    // Keep each layer's 92 keycodes readable: one physical row per line.
    const codes = JSON.parse(`[${inner}]`);
    if (codes.length !== KEYS.length) return m;
    return "[\n" + rowsOf(codes.map(c => JSON.stringify(c))).map(r => "        " + r.join(", ")).join(",\n") + "\n      ]";
  });
  return [["keymap.c", keymap], ["config.h", config], ["rules.mk", rules], ["keymap.json", json]];
}
const tabs = root.querySelector(".cfg-files [role=tablist]");
const codeEl = root.querySelector(".cfg-code code");
let fileTab = 0;
tabs.innerHTML = files().map(([name], i) => `<button type="button" role="tab" data-file="${i}" aria-selected="${i === 0}">${name}</button>`).join("");
tabs.addEventListener("click", e => {
  const b = e.target.closest("[data-file]");
  if (!b) return;
  fileTab = +b.dataset.file;
  renderFiles();
});
function renderFiles() {
  const [, text] = files()[fileTab];
  codeEl.textContent = text;
  for (const b of tabs.children) b.setAttribute("aria-selected", String(+b.dataset.file === fileTab));
}
const done = root.querySelector(".cfg-done");
function say(text) { done.textContent = text; clearTimeout(say.t); say.t = setTimeout(() => done.textContent = "", 2400); }
root.querySelector(".cfg-copy").addEventListener("click", async () => {
  const [name, text] = files()[fileTab];
  try { await navigator.clipboard.writeText(text); say(`Copied ${name}.`); burst(root.querySelector(".cfg-copy"), { color: "#ff9e64", count: 6, spread: 22, px: 2 }); }
  catch {
    const range = document.createRange(); range.selectNodeContents(codeEl);
    getSelection().removeAllRanges(); getSelection().addRange(range);
    say("Copying is blocked here. The file is selected; press Ctrl+C.");
  }
});
root.querySelector(".cfg-download").addEventListener("click", () => {
  const [name, text] = files()[fileTab];
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say(`Downloaded ${name}.`);
  burst(root.querySelector(".cfg-download"), { color: "#ff9e64", count: 6, spread: 22, px: 2 });
});

// ---------------------------------------------------------------- USB: VIA over WebHID
//
// QMK has no serial port by default; VIA's commands travel on the raw HID interface (usage page
// 0xFF60, usage 0x61) as 32-byte reports with no report ID. The board answers each command by
// echoing the packet with the result filled in. Command numbers are from QMK's quantum/via.h.

const VIA = { protocol: 0x01, value: 0x02, getKey: 0x04, setKey: 0x05, reset: 0x06, boot: 0x0b, layers: 0x11, getBuffer: 0x12,
  getEnc: 0x14, setEnc: 0x15, unhandled: 0xff };
const ROWS = 8, COLS = 12;

// Keycode names to the 16-bit numbers in QMK's keycodes.h.
const NUM = { KC_NO: 0x00, KC_TRNS: 0x01 };
for (let c = 0; c < 26; c++) NUM[`KC_${String.fromCharCode(65 + c)}`] = 0x04 + c;
for (let d = 1; d <= 9; d++) NUM[`KC_${d}`] = 0x1d + d;
NUM.KC_0 = 0x27;
Object.assign(NUM, {
  KC_ENT: 0x28, KC_ESC: 0x29, KC_BSPC: 0x2a, KC_TAB: 0x2b, KC_SPC: 0x2c, KC_MINS: 0x2d, KC_EQL: 0x2e, KC_LBRC: 0x2f,
  KC_RBRC: 0x30, KC_BSLS: 0x31, KC_SCLN: 0x33, KC_QUOT: 0x34, KC_GRV: 0x35, KC_COMM: 0x36, KC_DOT: 0x37, KC_SLSH: 0x38,
  KC_CAPS: 0x39, KC_PSCR: 0x46, KC_SCRL: 0x47, KC_PAUS: 0x48, KC_INS: 0x49, KC_HOME: 0x4a, KC_PGUP: 0x4b, KC_DEL: 0x4c,
  KC_END: 0x4d, KC_PGDN: 0x4e, KC_RGHT: 0x4f, KC_LEFT: 0x50, KC_DOWN: 0x51, KC_UP: 0x52, KC_APP: 0x65,
  KC_MUTE: 0xa8, KC_VOLU: 0xa9, KC_VOLD: 0xaa, KC_MNXT: 0xab, KC_MPRV: 0xac, KC_MSTP: 0xad, KC_MPLY: 0xae,
  KC_BRIU: 0xbd, KC_BRID: 0xbe, MS_BTN1: 0xd1, MS_BTN2: 0xd2, MS_BTN3: 0xd3, MS_WHLU: 0xd9, MS_WHLD: 0xda, MS_WHLL: 0xdb, MS_WHLR: 0xdc,
  KC_LCTL: 0xe0, KC_LSFT: 0xe1, KC_LALT: 0xe2, KC_LGUI: 0xe3, KC_RCTL: 0xe4, KC_RSFT: 0xe5, KC_RALT: 0xe6, KC_RGUI: 0xe7,
});
for (let f = 1; f <= 12; f++) NUM[`KC_F${f}`] = 0x39 + f;
for (let f = 13; f <= 24; f++) NUM[`KC_F${f}`] = 0x5b + f;
const NAME = Object.fromEntries(Object.entries(NUM).map(([k, v]) => [v, k]));
const MOD_BIT = { LCTL: 0x01, LSFT: 0x02, LALT: 0x04, LGUI: 0x08, RCTL: 0x11, RSFT: 0x12, RALT: 0x14, RGUI: 0x18 };
// omar-controls.h starts its enum at SAFE_RANGE, which is QK_USER when the keyboard adds no keycodes of its own.
const QK_USER = 0x7e40;
const OM = ["OM_DESK1", "OM_DESK2", "OM_DESK3", "OM_DESK4", "OM_DESK5", "OM_STAY", "OM_GO", "OM_FOCUS", "OM_SWAP", "OM_NEXT", "OM_LAST_DESK", "OM_MENU"];

function encode(code) {
  let m;
  if (code in NUM) return NUM[code];
  if (OM.includes(code)) return QK_USER + OM.indexOf(code);
  if ((m = /^0x([0-9A-F]{1,4})$/i.exec(code))) return parseInt(m[1], 16);
  if ((m = /^MO\((\d+)\)$/.exec(code))) return 0x5220 | (+m[1] & 0x1f);
  if ((m = /^LT\((\d+),\s*(\w+)\)$/.exec(code))) {
    const kc = NUM[m[2]];
    return kc != null && kc <= 0xff && +m[1] < 16 ? 0x4000 | (+m[1] << 8) | kc : null;
  }
  const { mods, base } = parse(code);
  if (!mods.length) return null;
  const right = mods.map(x => x[0] === "R");
  if (right.some(r => r !== right[0])) return null;   // QMK cannot mix left and right modifiers in one keycode
  const kc = NUM[base];
  if (kc == null || kc > 0xff) return null;
  return (mods.reduce((b, x) => b | MOD_BIT[x], 0) << 8) | kc;
}
function decode(n) {
  if (n in NAME) return NAME[n];
  if (n >= QK_USER && n < QK_USER + OM.length) return OM[n - QK_USER];
  if (n >= 0x5220 && n <= 0x523f) return `MO(${n & 0x1f})`;
  if (n >= 0x4000 && n <= 0x4fff && NAME[n & 0xff]) return `LT(${(n >> 8) & 0xf}, ${NAME[n & 0xff]})`;
  if (n >= 0x0100 && n <= 0x1fff && NAME[n & 0xff]) {
    const bits = n >> 8, side = bits & 0x10 ? "R" : "L";
    let out = NAME[n & 0xff];
    // Innermost first, so the result reads LGUI(LCTL(LSFT(LALT(key)))) like the keymap.
    for (const [bit, mod] of [[0x04, "ALT"], [0x02, "SFT"], [0x01, "CTL"], [0x08, "GUI"]]) if (bits & bit) out = `${side}${mod}(${out})`;
    return out;
  }
  return "0x" + n.toString(16).toUpperCase().padStart(4, "0");
}

const usbEl = root.querySelector(".cfg-usb");
const $u = s => usbEl.querySelector(s);
const usb = { dev: null, via: 0, layers: 0, encoders: false, snap: null, busy: "", note: "", live: false, presses: false,
  lights: 0, pollT: 0, down: new Set() };

let chain = Promise.resolve();
const waiting = [];
function onReport(e) {
  const d = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
  const w = waiting[0];
  if (w && (d[0] === w.cmd || d[0] === VIA.unhandled)) { waiting.shift(); clearTimeout(w.timer); w.resolve(d.slice()); }
}
// One command at a time: VIA answers in order, and a reply is matched to the command that is waiting.
function request(bytes, ms = 700) {
  const dev = usb.dev;
  const run = () => new Promise((resolve, reject) => {
    if (!dev?.opened) return reject(new Error("The board is not connected."));
    const data = new Uint8Array(32);
    data.set(bytes);
    const w = { cmd: bytes[0], resolve };
    w.timer = setTimeout(() => { waiting.splice(waiting.indexOf(w), 1); reject(new Error("The board did not answer.")); }, ms);
    waiting.push(w);
    dev.sendReport(0, data).catch(err => { clearTimeout(w.timer); waiting.splice(waiting.indexOf(w), 1); reject(err); });
  });
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}
function post(bytes) {
  const dev = usb.dev;
  const data = new Uint8Array(32);
  data.set(bytes);
  chain = chain.then(() => dev?.opened && dev.sendReport(0, data)).catch(() => {});
  return chain;
}

async function readBoard() {
  const L = Math.min(usb.layers, 2), size = L * ROWS * COLS * 2, buf = new Uint8Array(size);
  for (let off = 0; off < size; off += 28) {
    const n = Math.min(28, size - off);
    usb.busy = `Reading the board's keymap, ${off} of ${size} bytes…`;
    renderUsb();
    const r = await request([VIA.getBuffer, off >> 8, off & 0xff, n]);
    if (r[0] !== VIA.getBuffer) throw new Error("The board refused to send its keymap.");
    buf.set(r.subarray(4, 4 + n), off);
  }
  const at = (l, k) => { const o = (l * ROWS * COLS + k.row * COLS + k.col) * 2; return (buf[o] << 8) | buf[o + 1]; };
  const out = { layers: [0, 1].map(l => KEYS.map(k => l < L ? decode(at(l, k)) : "KC_TRNS")), enc: null };
  const first = await request([VIA.getEnc, 0, 0, 0]);
  usb.encoders = first[0] === VIA.getEnc;
  if (usb.encoders) {
    out.enc = [0, 1].map(() => ENCODERS.map(() => ["KC_NO", "KC_NO"]));
    for (let l = 0; l < L; l++) for (let e = 0; e < ENCODERS.length; e++) for (const dir of [0, 1]) {
      const r = l || e || dir ? await request([VIA.getEnc, l, e, dir]) : first;
      out.enc[l][e][dir] = decode((r[4] << 8) | r[5]);
    }
    if (L < 2) out.enc[1] = ENCODERS.map(() => ["KC_TRNS", "KC_TRNS"]);
  }
  return out;
}
// Everything on this page that the board does not hold yet.
function differences() {
  if (!usb.snap) return [];
  const out = [];
  for (let l = 0; l < Math.min(usb.layers, 2); l++) {
    for (const k of KEYS) if (layers[l][k.i] !== usb.snap.layers[l][k.i]) out.push({ kind: "key", layer: l, k, code: layers[l][k.i] });
    if (usb.encoders) ENCODERS.forEach((E, e) => [0, 1].forEach(dir => {
      if (enc[l][e][dir] !== usb.snap.enc[l][e][dir]) out.push({ kind: "enc", layer: l, e, dir, code: enc[l][e][dir] });
    }));
  }
  return out;
}
let writing = null, writeAgain = false;
async function writeBoard() {
  if (writing) { writeAgain = true; return writing; }
  writing = (async () => {
    const skipped = [];
    do {
      writeAgain = false;
      const todo = differences();
      let n = 0;
      for (const d of todo) {
        usb.busy = `Writing to the board, ${++n} of ${todo.length}…`;
        renderUsb();
        const v = encode(d.code);
        const where = d.kind === "key" ? `${d.k.id}${d.layer ? " (Fn)" : ""}` : `${ENCODERS[d.e].name}${d.layer ? " (Fn)" : ""}`;
        if (v == null) { if (!skipped.includes(where)) skipped.push(where); continue; }
        const r = d.kind === "key"
          ? await request([VIA.setKey, d.layer, d.k.row, d.k.col, v >> 8, v & 0xff])
          : await request([VIA.setEnc, d.layer, d.e, d.dir, v >> 8, v & 0xff]);
        if (r[0] === VIA.unhandled) throw new Error("The board refused a keycode change.");
        if (d.kind === "key") usb.snap.layers[d.layer][d.k.i] = d.code; else usb.snap.enc[d.layer][d.e][d.dir] = d.code;
      }
    } while (writeAgain);
    usb.note = skipped.length ? `Not written, because QMK has no number for the keycode: ${skipped.join(", ")}.` : "";
  })();
  let ok = true;
  try { await writing; } catch (err) { usb.note = err.message; ok = false; }
  finally { writing = null; usb.busy = ""; renderUsb(); }
  if (ok && !usb.note && !differences().length) twinkle($u(".cfg-usb-diff"), { color: "#9ece6a", px: 3 });
}
function changed() {
  if (usb.dev && usb.via && usb.live) writeBoard(); else renderUsb();
}

async function connect() {
  let dev;
  try { [dev] = await navigator.hid.requestDevice({ filters: [{ usagePage: 0xff60, usage: 0x61 }] }); }
  catch (err) { usb.note = err.message; renderUsb(); return; }
  if (!dev) return;   // the chooser was closed
  try { if (!dev.opened) await dev.open(); }
  catch (err) { usb.note = `The browser could not open the board: ${err.message}`; renderUsb(); return; }
  Object.assign(usb, { dev, via: 0, layers: 0, snap: null, note: "", busy: "Asking the board what it runs…" });
  dev.addEventListener("inputreport", onReport);
  renderUsb();
  try {
    const r = await request([VIA.protocol]);
    usb.via = r[0] === VIA.protocol ? (r[1] << 8) | r[2] : 0;
  } catch { usb.via = 0; }
  if (usb.via) {
    try {
      usb.layers = (await request([VIA.layers]))[1];
      usb.snap = await readBoard();
    } catch (err) { usb.note = err.message; }
  }
  usb.busy = "";
  renderUsb();
  burst($u(".cfg-disconnect"), { color: "#9ece6a", count: 6, spread: 22, px: 2 });
}
function forget(note = "") {
  clearTimeout(usb.pollT);
  clearInterval(usb.lights);
  for (const i of usb.down) keyUp(i);
  usb.dev?.removeEventListener("inputreport", onReport);
  for (const w of waiting.splice(0)) clearTimeout(w.timer);
  Object.assign(usb, { dev: null, via: 0, layers: 0, snap: null, busy: "", note, lights: 0, presses: false, live: false, down: new Set() });
  $u(".cfg-usb-presses").checked = $u(".cfg-usb-live").checked = false;
  renderUsb();
}
async function disconnect() {
  const dev = usb.dev;
  forget();
  try { await dev?.close(); } catch { /* already gone */ }
}

// The board's own switches, polled through VIA's matrix-state value and fed to the firmware trace.
async function pollMatrix() {
  if (!usb.presses || !usb.dev) return;
  try {
    const r = await request([VIA.value, 0x03]);
    if (r[0] !== VIA.value) { usb.presses = false; $u(".cfg-usb-presses").checked = false; usb.note = "This firmware does not report its switches."; renderUsb(); return; }
    for (const k of KEYS) {
      const row = (r[2 + k.row * 2] << 8) | r[3 + k.row * 2];
      const on = (row >> k.col) & 1;
      if (on && !usb.down.has(k.i)) { usb.down.add(k.i); keyDown(k.i); }
      else if (!on && usb.down.has(k.i)) { usb.down.delete(k.i); keyUp(k.i); }
    }
  } catch { /* a missed poll is retried */ }
  if (usb.presses) usb.pollT = setTimeout(pollMatrix, 25);
}

function sendLights() {
  const desk = +$u(".cfg-usb-desk").value, muted = $u(".cfg-usb-mic").checked;
  post([0x4f, 1, (desk ? 1 : 0) | 2 | (muted ? 4 : 0), desk]);
  sim.desk = desk;
  sim.mic = muted;
  render();
}

function renderUsb() {
  const supported = "hid" in navigator;
  const on = !!usb.dev, busy = !!usb.busy || !!writing;
  const name = usb.dev ? `${usb.dev.productName || "an unnamed board"} (${hex4(usb.dev.vendorId)}:${hex4(usb.dev.productId)})` : "";
  let status;
  if (!supported) status = window.isSecureContext
    ? "This browser cannot talk to USB keyboards. Chrome, Edge and Opera on a desktop computer can, through WebHID."
    : "USB access needs the page to be served over HTTPS. The published site is.";
  else if (!on) status = "Plug in a board running this firmware and choose it in the list your browser shows. The page uses the raw HID channel that QMK and VIA use, so nothing needs installing.";
  else if (usb.via) status = `Connected to ${name}. VIA protocol ${usb.via}, ${usb.layers} layer${usb.layers === 1 ? "" : "s"} stored on the board.`;
  else if (busy) status = `Connected to ${name}.`;
  else status = `Connected to ${name}. It answers on the raw HID channel but does not run VIA, so its keymap cannot be read or written. Turn on Live editing over USB in the build options, flash that build and connect again. The host lights below work either way.`;
  $u(".cfg-usb-status").textContent = status;
  $u(".cfg-connect").hidden = on;
  $u(".cfg-connect").disabled = !supported;
  $u(".cfg-disconnect").hidden = !on;
  $u(".cfg-usb-body").hidden = !on;
  for (const el of usbEl.querySelectorAll("[data-needs=via]")) el.hidden = !usb.via;
  const diffs = differences();
  const keys = diffs.filter(d => d.kind === "key").length, turns = diffs.length - keys;
  let diff = "";
  if (usb.busy) diff = usb.busy;
  else if (usb.snap) diff = !diffs.length ? "The board holds the same keymap as this page."
    : `${[keys && `${keys} key${keys === 1 ? "" : "s"}`, turns && `${turns} dial turn${turns === 1 ? "" : "s"}`].filter(Boolean).join(" and ")} on this page differ from the board.`;
  $u(".cfg-usb-diff").textContent = diff;
  $u(".cfg-usb-note").textContent = usb.note;
  $u(".cfg-usb-note").hidden = !usb.note;
  $u(".cfg-usb-read").disabled = busy || !usb.snap;
  $u(".cfg-usb-write").disabled = busy || !usb.snap || !diffs.length;
  $u(".cfg-usb-restore").disabled = $u(".cfg-usb-boot").disabled = busy;
  for (const t of root.querySelectorAll('[data-pane="usb"][role=tab], [data-side="usb"][role=tab]')) t.classList.toggle("live", on);
  const lb = $u(".cfg-usb-lights");
  lb.setAttribute("aria-pressed", String(!!usb.lights));
  lb.textContent = usb.lights ? "Stop the test lights" : "Send test lights";
}
const hex4 = n => n.toString(16).toUpperCase().padStart(4, "0");

usbEl.addEventListener("click", async e => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.classList.contains("cfg-connect")) return connect();
  if (b.classList.contains("cfg-disconnect")) return disconnect();
  if (b.classList.contains("cfg-usb-read")) {
    layers = usb.snap.layers.map(l => l.slice());
    if (usb.snap.enc) enc = structuredClone(usb.snap.enc);
    usb.note = "";
    save(); render(); renderKey(); renderFiles(); renderUsb();
    return;
  }
  if (b.classList.contains("cfg-usb-write")) return writeBoard();
  if (b.classList.contains("cfg-usb-lights")) {
    if (usb.lights) { clearInterval(usb.lights); usb.lights = 0; usb.note = "The board turns the host lights off 3 seconds after the last report."; }
    else { sendLights(); usb.lights = setInterval(sendLights, 1000); usb.note = ""; }
    renderUsb();
    return;
  }
  if (b.classList.contains("cfg-usb-restore")) {
    if (!confirm("Replace the keymap stored on the board with the one built into its firmware?")) return;
    try {
      usb.busy = "Restoring the board's built-in keymap…";
      renderUsb();
      await request([VIA.reset]);
      usb.snap = await readBoard();
      usb.note = "The board now uses its built-in keymap. Load it here to see it on the page.";
    } catch (err) { usb.note = err.message; }
    usb.busy = "";
    renderUsb();
    return;
  }
  if (b.classList.contains("cfg-usb-boot")) {
    if (!confirm("Restart the board into its bootloader? It disconnects and shows up as a drive named RPI-RP2.")) return;
    await post([VIA.boot]);
    forget("The board restarted into its bootloader. Copy a .uf2 build onto the RPI-RP2 drive to flash it; the board restarts on its own, and you can connect again.");
  }
});
usbEl.addEventListener("change", e => {
  const t = e.target;
  if (t.classList.contains("cfg-usb-live")) { usb.live = t.checked; if (usb.live) writeBoard(); }
  else if (t.classList.contains("cfg-usb-presses")) {
    usb.presses = t.checked;
    clearTimeout(usb.pollT);
    if (usb.presses) pollMatrix(); else { for (const i of usb.down) keyUp(i); usb.down.clear(); }
  } else if ((t.classList.contains("cfg-usb-desk") || t.classList.contains("cfg-usb-mic")) && usb.lights) sendLights();
});
navigator.hid?.addEventListener("disconnect", e => {
  if (e.device === usb.dev) forget("The board was unplugged.");
});

// ---------------------------------------------------------------- toolbar

// Under the desktop layout every panel is on screen at once and only the settings slot has tabs;
// on narrower screens the board stays pinned and one panel at a time shows under it.
const work = root.querySelector(".cfg-work");
function showPane(name) {
  work.dataset.pane = name;
  for (const b of work.querySelectorAll(".cfg-panes [data-pane]")) b.setAttribute("aria-selected", String(b.dataset.pane === name));
  if (name === "opts" || name === "usb") showSide(name);
}
function showSide(name) {
  work.dataset.side = name;
  for (const b of work.querySelectorAll(".cfg-side-tabs [data-side]")) b.setAttribute("aria-selected", String(b.dataset.side === name));
}
work.querySelector(".cfg-panes").addEventListener("click", e => { const b = e.target.closest("[data-pane]"); if (b) showPane(b.dataset.pane); });
work.querySelector(".cfg-side-tabs").addEventListener("click", e => { const b = e.target.closest("[data-side]"); if (b) showSide(b.dataset.side); });

root.querySelector(".cfg-bar").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.layer) { tabLayer = +b.dataset.layer; renderBoard(); }
  else if (b.dataset.show) { show = b.dataset.show; renderBoard(); }
  else if (b.classList.contains("cfg-reset")) {
    layers = DEFAULT_LAYERS.map(l => l.slice());
    enc = structuredClone(DEFAULT_ENC);
    opts = { ...DEFAULT_OPTS };
    save(); syncForm(); render(); renderKey(); renderFiles(); changed();
  }
});

syncForm();
render();
renderKey();
renderFiles();
renderUsb();
