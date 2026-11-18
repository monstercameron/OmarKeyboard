// Scroll drives the camera. Each step in the text names a pose. While a step sits on the reading
// line the board holds that pose; in the gap before the next step it turns and slides into the next.
// t: the point to show, in metres in the model's frame (x right, y up, z toward the reader);
//    null means the model's own center.
// o: [azimuth deg, polar deg, distance as % of the distance that frames the whole board].
// dx, dy: where that point sits on screen, as a fraction of the window from its center. Without dx,
//    the board moves away from the text: right of center when the text is on the left, and back.
// dyPhone: dy on narrow screens, where the board lives in a band at the top.
// rp: distance on narrow screens, when the default pull-back does not fit.
// inner: show the internal assembly instead. x opens it (0 assembled, 1 exploded); k moves every
//    layer except the main board out of the frame.
const poses = {
  hero:      { t: [null, null, null],        o: [13, 52, 88],   c: "", dx: 0.08, dyPhone: -0.15 },
  lean:      { t: [null, null, null],        o: [24, 50, 128],  c: "The whole board, from the front right." },
  above:     { t: [null, null, null],        o: [0, 4, 150],    c: "From above: launchers down the left, places across the top, windows down the right.", dx: -0.22 },
  desks:     { t: [-0.064, 0.036, -0.048],   o: [-4, 38, 62],   c: "Desk 1 to Desk 5, directly above the digits they stand for." },
  transfers: { t: [-0.012, 0.036, -0.048],   o: [6, 40, 60],    c: "Send & Stay and Move & Go both finish on one of the five desk keys." },
  next:      { t: [0.020, 0.028, 0.050],     o: [4, 50, 52],    c: "Next Window, beside the right Super key.", dx: -0.14 },
  corner:    { t: [0.178, 0.030, 0.046],     o: [20, 48, 44],   c: "Focus and Swap beside the arrows. Both work only while held." },
  rail:      { t: [0.193, 0.033, 0.012],     o: [34, 50, 52],   c: "Flip Split, Float and Fullscreen down the right edge." },
  toprow:    { t: [null, 0.036, -0.048],     o: [0, 34, 112],   c: "The top row, where F1 to F12 used to be." },
  roller:    { t: [0.144, 0.034, -0.016],    o: [12, 44, 44],   c: "The scroll roller, in place of the six navigation keys." },
  rightCtrl: { t: [0.120, 0.028, 0.050],     o: [10, 50, 48],   c: "Right Ctrl sits beside the left arrow for text navigation and selection." },
  fn:        { t: [0.150, 0.030, 0.040],     o: [-14, 46, 56],  c: "Home, End, PgUp and PgDn, printed in plum on the arrows." },
  dial:      { t: [-0.208, 0.045, -0.070],   o: [-24, 46, 30],  c: "The volume dial. Press it to mute the speakers.", dx: -0.1 },
  lock:      { t: [0.172, 0.040, -0.064],    o: [18, 46, 42],   c: "Lock sits lower than its neighbors, beside the brightness dial." },
  capture:   { t: [0.136, 0.040, -0.064],    o: [12, 46, 42],   c: "Screenshot and Grab Text, side by side." },
  stockview: { t: [null, null, null],        o: [-18, 30, 126], c: "Every labeled key sends a shortcut Omarchy already has." },
  play:      { t: [null, null, null],        o: [0, 1, 94],     c: "", dx: 0, dy: 0.24, dyPhone: 0 },
  layers:    { t: [0, 0.122, 0.011],         o: [14, 64, 125],  c: "Keycaps, switches, plate, main board and tray, pulled apart.", rp: 115, inner: { x: 1, k: 0 } },
  board:     { t: [0, 0.075, 0.001],         o: [3, 25, 82],   c: "The component side of the main board, with the other layers moved away.", inner: { x: 1, k: 1 } },
  usb:       { t: [-0.104, 0.077, -0.052],   o: [169, 39, 30],  c: "The USB-C inlet and protection carrier behind Desk 3. The main controller sits under the scroll roller.", inner: { x: 1, k: 1 } },
  sockets:   { t: [0, 0.075, 0.001],         o: [3, 156, 82],  c: "The underside: hot-swap sockets, diodes and the upside-down LEDs.", inner: { x: 1, k: 1 } },
  rear:      { t: [null, 0.014, null],       o: [180, 62, 96],  c: "The back edge and its USB-C port.", dx: -0.17 },
  finale:    { t: [null, null, null],        o: [-28, 58, 124], c: "Drag the board to turn it." },
};
const SHIFT = 0.21;
const FOV = 30;        // matches field-of-view on the element
const SPIN = 0.006;    // landing turntable, degrees per millisecond

import { ambient, twinkle } from "./fx.js";

const viewer = document.querySelector("model-viewer");
const inner = document.querySelector("model-viewer.inner");
const stage = document.querySelector(".stage");
const caption = document.querySelector(".stage-caption");
const narrow = matchMedia("(max-width: 999px)");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let center = [0, 0, 0];
let base = 0;          // camera distance in metres that frames the whole board
let stops = [];
let queued = false;
let spin = 0, held = false, resumeAt = 0, inHero = true, playing = false;

const ease = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.min(Math.max(t, 0), 1);
const rad = d => d * Math.PI / 180;

// Page positions of every step, measured again whenever the layout can change.
function measure() {
  stops = [...document.querySelectorAll(".story [data-view]")].map(el => {
    const r = el.getBoundingClientRect();
    const side = el.closest("[data-side]")?.dataset.side;
    return { pose: poses[el.dataset.view], top: r.top + scrollY, bottom: r.bottom + scrollY,
             side: side === "left" ? SHIFT : side === "right" ? -SHIFT : 0 };
  }).filter(s => s.pose);
  // The opening pose holds only until the reader starts to scroll.
  if (stops.length) stops[0].bottom = Math.min(stops[0].bottom, readingLine(0) + 1);
  update();
}

// The phone band is wide and short, so close views pull back and wide views stop at a full frame.
function radius(r, phone) {
  if (!narrow.matches) return r;
  if (phone) return phone;
  return r >= 100 ? 100 : Math.min(Math.round(r * 1.5), 100);
}

function resolve(stop) {
  const p = stop.pose, o = p.o;
  const theta = p === poses.hero ? o[0] + spin : o[0];
  return {
    t: p.t.map((v, i) => v ?? center[i]),
    o: [theta, o[1], radius(o[2], p.rp)],
    dx: narrow.matches ? 0 : p.dx ?? stop.side,
    dy: narrow.matches ? p.dyPhone ?? 0 : p.dy ?? 0,
    ins: p.inner ? 1 : 0, x: p.inner?.x ?? 0, k: p.inner?.k ?? 0,
  };
}

// Where the reader is looking: the middle of the window, or a third of the way into the text under the phone band.
function readingLine(y = scrollY) {
  if (!narrow.matches) return y + innerHeight * 0.5;
  return y + innerHeight * (0.46 + 0.54 * 0.35);
}

function update() {
  queued = false;
  if (!stops.length) return;
  if (narrow.matches) {
    stage.style.height = `${Math.round(mix(innerHeight, innerHeight * 0.46, ease(clamp01(scrollY / (innerHeight * 0.55)))))}px`;
  } else stage.style.height = "";

  const line = readingLine();
  let a = stops[stops.length - 1], b = a, t = 0, ia = stops.length - 1, ib = ia;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i], n = stops[i + 1];
    if (line < s.bottom || !n) { a = b = s; ia = ib = i; break; }
    if (line < n.top) { a = s; b = n; ia = i; ib = i + 1; t = (line - s.bottom) / Math.max(n.top - s.bottom, 1); break; }
  }
  if (still.matches) t = t < 0.5 ? 0 : 1;
  const e = ease(clamp01(t));
  const A = resolve(a), B = resolve(b);
  // Turn the short way round.
  while (A.o[0] - B.o[0] > 180) A.o[0] -= 360;
  while (B.o[0] - A.o[0] > 180) A.o[0] += 360;

  const point = A.t.map((v, i) => mix(v, B.t[i], e));
  const [theta, phi, pct] = A.o.map((v, i) => mix(v, B.o[i], e));
  const w = viewer.clientWidth || innerWidth, h = viewer.clientHeight || innerHeight;
  const sx = mix(A.dx, B.dx, e) * w, sy = mix(A.dy, B.dy, e) * h;

  // Aim the camera beside the point so the point lands (sx, sy) pixels from the center of the view.
  const dist = base ? base * pct / 100 : 0;
  let target = point;
  if (dist) {
    const per = 2 * dist * Math.tan(rad(FOV) / 2) / h;
    const th = rad(theta), ph = rad(phi);
    const right = [Math.cos(th), 0, -Math.sin(th)];
    const up = [-Math.cos(ph) * Math.sin(th), Math.sin(ph), -Math.cos(ph) * Math.cos(th)];
    target = point.map((v, i) => v - right[i] * sx * per + up[i] * sy * per);
  }
  const camTarget = `${target[0].toFixed(4)}m ${target[1].toFixed(4)}m ${target[2].toFixed(4)}m`;
  const camOrbit = `${theta.toFixed(2)}deg ${phi.toFixed(2)}deg ${dist ? dist.toFixed(4) + "m" : pct.toFixed(1) + "%"}`;
  viewer.cameraTarget = camTarget;
  viewer.cameraOrbit = camOrbit;
  if (still.matches) viewer.jumpCameraToGoal();

  // The internal assembly fades in over the board while it is still closed, opens, and closes
  // again before fading back out, so the swap itself never shows.
  let op = 0, ie = e;
  if (A.ins && B.ins) op = 1;
  else if (B.ins) { op = clamp01(e / 0.3); ie = clamp01((e - 0.3) / 0.7); }
  else if (A.ins) { op = 1 - clamp01((e - 0.7) / 0.3); ie = clamp01(e / 0.45); }
  const wantsInner = A.ins || B.ins;
  if (!innerReady) op = 0;
  if (inner) {
    // Keep the second view running one step either side of the chapter so it is already in place.
    const near = [ia - 1, ia, ib, ib + 1].some(i => stops[i]?.pose.inner);
    if (innerReady && near) {
      const wasHidden = inner.style.display === "none";
      inner.style.display = "";
      inner.cameraTarget = camTarget;
      inner.cameraOrbit = camOrbit;
      if (wasHidden || still.matches) inner.jumpCameraToGoal();
      explode(mix(A.x, B.x, ie), mix(A.k, B.k, ie));
    } else inner.style.display = "none";
    inner.style.opacity = op;
    inner.style.pointerEvents = op >= 1 ? "auto" : "none";
    viewer.style.visibility = op >= 1 ? "hidden" : "";
  }

  inHero = a === b && a.pose === poses.hero;
  const nowPlaying = a === b && a.pose === poses.play;
  if (nowPlaying !== playing) {
    playing = nowPlaying;
    viewer.cameraControls = !playing;
    document.body.classList.toggle("playing", playing);
    dispatchEvent(new CustomEvent("omar:play", { detail: playing }));
  }

  const shown = e < 0.5 ? a : b;
  const waiting = wantsInner && !innerReady;
  const text = waiting
    ? (innerFailed ? "The internal assembly could not load. Reload the page to try again." : `Loading the internal assembly ${Math.round(innerProgress * 100)}%`)
    : shown.pose.c;
  if (caption.textContent !== text) caption.textContent = text;
  caption.classList.toggle("loading", waiting && !innerFailed);
  caption.style.setProperty("--load", `${(innerProgress * 100).toFixed(1)}%`);
  caption.style.opacity = a === b || waiting ? 1 : Math.abs(e - 0.5) * 2;
  caption.style.setProperty("--dx", `${sx.toFixed(1)}px`);
  loader?.style.setProperty("--sx", `${sx.toFixed(1)}px`);
  loader?.style.setProperty("--sy", `${sy.toFixed(1)}px`);
}

function queue() {
  if (!queued) { queued = true; requestAnimationFrame(update); }
}

// Find the distance at which the whole board fills the view, so every pose can be given in metres.
async function frame() {
  viewer.cameraTarget = "auto auto auto";
  viewer.cameraOrbit = "0deg 75deg 100%";
  viewer.jumpCameraToGoal();
  await viewer.updateComplete;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  base = viewer.getCameraOrbit().radius;
  update();
  viewer.jumpCameraToGoal();
}

// The landing turntable. It stops while the board is held and picks up from wherever it was left.
let last = performance.now();
function tick(now) {
  const dt = Math.min(now - last, 64);
  last = now;
  if (base && inHero && !held && now > resumeAt && !still.matches && !document.hidden) {
    spin = (spin + dt * SPIN) % 360;
    update();
  }
  requestAnimationFrame(tick);
}
viewer.addEventListener("pointerdown", () => { held = true; });
addEventListener("pointerup", () => {
  if (!held) return;
  held = false;
  resumeAt = performance.now() + 1800;
  if (inHero) spin = viewer.getCameraOrbit().theta * 180 / Math.PI - poses.hero.o[0];
});

// Loader: the key layout draws itself, and keys fill with their group color as the model arrives.
const loader = document.querySelector(".loader");
const svgNS = "http://www.w3.org/2000/svg";
let loaderKeys = [];
fetch("assets/omar-keys.json").then(r => r.json()).then(data => {
  const svg = loader.querySelector(".loader-board");
  const [ox, oy] = data.field_offset;
  const add = (tag, attrs) => {
    const el = document.createElementNS(svgNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    svg.append(el);
    return el;
  };
  add("rect", { class: "case", x: 0, y: 0, width: data.case[0], height: data.case[1], rx: 7, pathLength: 100 });
  const [rx, ry, rw, rh] = data.roller;
  add("rect", { class: "roller", x: ox + rx, y: oy + ry, width: rw, height: rh, rx: 3 });
  loaderKeys = data.keys.slice().sort((p, q) => p[1] - q[1]).map(([label, cx, cy, w, group], i) => {
    const el = group === "dial"
      ? add("circle", { cx: ox + cx, cy: oy + cy, r: 7.6 })
      : add("rect", { x: ox + cx - w / 2 + 0.7, y: oy + cy - 9.525 + 0.7, width: w - 1.4, height: 17.65, rx: 2.4 });
    el.classList.add("key", `g-${group}`);
    el.style.setProperty("--i", i);
    return el;
  });
  progress(lastProgress);
}).catch(() => {});

let lastProgress = 0;
function progress(p) {
  lastProgress = p;
  const pct = Math.round(p * 100);
  loader.querySelector(".loader-pct").textContent = `${pct}%`;
  loader.setAttribute("aria-valuenow", pct);
  const n = Math.round(p * loaderKeys.length);
  loaderKeys.forEach((el, i) => el.classList.toggle("on", i < n));
}
viewer.addEventListener("progress", e => progress(e.detail.totalProgress));

viewer.addEventListener("load", async () => {
  const c = viewer.getBoundingBoxCenter();
  center = [c.x, c.y, c.z];
  progress(1);
  measure();
  await frame();
  loader.classList.add("done");
  setTimeout(() => loader.hidden = true, 900);
  // The one flourish on arrival: a few stars over the board as the loader clears, then the odd one
  // while the reader is still on the opening screen.
  for (let i = 0; i < 6; i++) setTimeout(() => { const r = boardArea(); if (r) twinkle({ x: r.left + r.width * Math.random(), y: r.top + r.height * Math.random() }, { color: TN[i % TN.length], px: 3, duration: 760 }); }, 500 + i * 170);
  ambient(boardArea, { colors: TN, active: () => inHero && scrollY < innerHeight * 0.3 });
  requestAnimationFrame(tick);
  // Fetch the internal assembly once the board is on screen, so the two downloads never compete.
  setTimeout(() => { if (inner && !inner.src) inner.src = inner.dataset.src; }, 1200);
});
// Tokyo Night blue, magenta, orange and green.
const TN = ["#7aa2f7", "#bb9af7", "#ff9e64", "#9ece6a"];
// Roughly where the board sits on the opening screen, clear of the title and the text.
function boardArea() {
  const r = viewer.getBoundingClientRect();
  if (!r.width) return null;
  const [x0, x1, y0, y1] = narrow.matches ? [0.1, 0.9, 0.36, 0.62] : [0.3, 0.95, 0.32, 0.7];
  return { left: r.left + r.width * x0, top: r.top + r.height * y0, width: r.width * (x1 - x0), height: r.height * (y1 - y0) };
}
viewer.addEventListener("error", () => {
  loader.classList.add("failed");
  loader.querySelector(".loader-text").textContent = "The 3D model could not load. Reload the page to try again.";
  loader.querySelector(".loader-pct").textContent = "";
});

// The internal assembly. Its file carries a two-second animation from assembled to exploded; the
// scroll position picks the frame. Layers that leave the frame for the circuit board views are
// wrapped in groups of their own, so the animation and the extra lift never write the same node.
let innerReady = false, innerFailed = false, innerProgress = 0;
let lifts = [], lastX = -1, lastK = -1, innerScene = null;
function explode(x, k) {
  if (!innerScene || (x === lastX && k === lastK)) return;
  lastX = x; lastK = k;
  inner.currentTime = x * Math.max(0, inner.duration - 0.0001);
  for (const l of lifts) {
    l.group.position.y = l.dy * ease(k);
    l.group.visible = k < 0.8;
  }
  inner.shadowIntensity = k > 0 ? 0 : 0.7;
  innerScene.queueRender();
}
function prepareInner() {
  innerScene = inner[Object.getOwnPropertySymbols(inner).find(s => s.description === "scene")];
  let datum = null, root = null, board = null;
  innerScene.traverse(n => {
    if (!datum && n.name.startsWith("Plate_datum")) datum = n;
    if (!board && n.name.includes("Mainboard_assembly")) board = n;
  });
  if (!datum || !board) return;
  root = datum.parent;
  const Group = board.constructor;
  const wrap = (parent, nodes, dy) => {
    if (!nodes.length) return;
    const g = new Group();
    g.name = "lift";
    parent.add(g);
    for (const n of nodes) g.add(n);
    lifts.push({ group: g, dy });
  };
  const rise = { "03": 0.30, "04": 0.40, "05": 0.50 };
  const kids = [...datum.children];
  for (const n of kids) {
    const id = n.name.slice(0, 2);
    if (rise[id]) wrap(datum, [n], rise[id]);
  }
  wrap(datum, kids.filter(n => n !== board && !rise[n.name.slice(0, 2)]), -0.45);
  wrap(root, root.children.filter(n => n !== datum && n.name !== "lift"), -0.45);
}
if (inner) {
  inner.style.display = "none";
  inner.addEventListener("progress", e => { innerProgress = e.detail.totalProgress; if (!innerReady) queue(); });
  inner.addEventListener("load", async () => {
    inner.animationName = inner.availableAnimations[0];
    await inner.updateComplete;
    inner.play();
    await new Promise(requestAnimationFrame);
    inner.pause();
    prepareInner();
    innerReady = true;
    lastX = lastK = -1;
    update();
  });
  inner.addEventListener("error", () => { innerFailed = true; queue(); });
}

let resizeTimer = 0;
addEventListener("resize", () => {
  measure();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (base) frame(); }, 250);
});
addEventListener("scroll", queue, { passive: true });
narrow.addEventListener("change", measure);
document.fonts?.ready.then(measure);
new ResizeObserver(measure).observe(document.querySelector(".story"));

measure();
