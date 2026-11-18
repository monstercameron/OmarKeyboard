// Scroll drives the camera. Each step in the text names a pose. While a step sits on the reading
// line the board holds that pose; in the gap before the next step it turns and slides into the next.
// Targets are metres in the model's frame (x right, y up, z toward the reader); null means the
// model's own center. Orbit is [azimuth deg, polar deg, radius as % of the framing distance].
const poses = {
  hero:      { t: [null, null, null],        o: [13, 52, 100],  c: "", dx: 0.15, dyPhone: -0.15 },
  lean:      { t: [null, null, null],        o: [24, 50, 128],  c: "The whole board, from the front right." },
  above:     { t: [null, null, null],        o: [0, 4, 132],    c: "From above: launchers down the left, places across the top, windows down the right." },
  desks:     { t: [-0.064, 0.036, -0.048],   o: [-4, 38, 62],   c: "Desk 1 to Desk 5, directly above the digits they stand for." },
  transfers: { t: [-0.012, 0.036, -0.048],   o: [6, 40, 60],    c: "Send & Stay and Move & Go both finish on one of the five desk keys." },
  next:      { t: [0.057, 0.028, 0.050],     o: [4, 50, 46],    c: "Next Window, beside the right Super key." },
  corner:    { t: [0.178, 0.030, 0.046],     o: [20, 48, 44],   c: "Focus and Swap beside the arrows. Both work only while held." },
  rail:      { t: [0.193, 0.033, 0.012],     o: [34, 50, 52],   c: "Flip Split, Float and Fullscreen down the right edge." },
  toprow:    { t: [null, 0.036, -0.048],     o: [0, 34, 112],   c: "The top row, where F1 to F12 used to be." },
  roller:    { t: [0.144, 0.034, -0.016],    o: [12, 44, 44],   c: "The scroll roller, in place of the six navigation keys." },
  alt:       { t: [0.120, 0.028, 0.050],     o: [10, 50, 48],   c: "Alt, beside the left arrow, in place of the right-hand Ctrl." },
  fn:        { t: [0.150, 0.030, 0.040],     o: [-14, 46, 56],  c: "Home, End, PgUp and PgDn, printed in plum on the arrows." },
  dial:      { t: [-0.208, 0.040, -0.056],   o: [-24, 46, 40],  c: "The volume dial. Press it to mute the speakers." },
  lock:      { t: [0.172, 0.040, -0.064],    o: [18, 46, 42],   c: "Lock sits lower than its neighbors, beside the brightness dial." },
  capture:   { t: [0.136, 0.040, -0.064],    o: [12, 46, 42],   c: "Screenshot and Grab Text, side by side." },
  stockview: { t: [null, null, null],        o: [-18, 30, 126], c: "Every labeled key sends a shortcut Omarchy already has." },
  rear:      { t: [null, 0.014, null],       o: [180, 72, 96],  c: "The back edge and its USB-C port." },
  finale:    { t: [null, null, null],        o: [-28, 58, 124], c: "Drag the board to turn it." },
};
// How far the board slides away from the text, as a fraction of the window width. A pose can
// override it with dx, and lift the board on phones with dyPhone (a fraction of the window height).
const SHIFT = 0.21;

const viewer = document.querySelector("model-viewer");
const stage = document.querySelector(".stage");
const caption = document.querySelector(".stage-caption");
const narrow = matchMedia("(max-width: 999px)");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let center = { x: 0, y: 0, z: 0 };
let stops = [];
let queued = false;

// Page positions of every step, measured again whenever the layout can change.
function measure() {
  stops = [...document.querySelectorAll(".story [data-view]")].map(el => {
    const r = el.getBoundingClientRect();
    const side = el.closest("[data-side]")?.dataset.side;
    return { pose: poses[el.dataset.view], top: r.top + scrollY, bottom: r.bottom + scrollY,
             dx: side === "left" ? SHIFT : side === "right" ? -SHIFT : 0 };
  }).filter(s => s.pose);
  // The opening pose holds only until the reader starts to scroll.
  if (stops.length) stops[0].bottom = Math.min(stops[0].bottom, readingLine(0) + 1);
  update();
}

const ease = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = t => Math.min(Math.max(t, 0), 1);

// The phone band is wide and short, so close views pull back and wide views stop at a full frame.
function radius(r) {
  if (!narrow.matches) return r;
  return r >= 100 ? 100 : Math.round(r * 1.25);
}

function resolve(stop) {
  const c = [center.x, center.y, center.z], o = stop.pose.o;
  return { t: stop.pose.t.map((v, i) => v ?? c[i]), o: [o[0], o[1], radius(o[2])], dx: narrow.matches ? 0 : stop.pose.dx ?? stop.dx,
           dy: narrow.matches ? stop.pose.dyPhone ?? 0 : 0 };
}

// Where the reader is looking: the middle of the window, or a third of the way into the text under the phone band.
function readingLine(y = scrollY) {
  if (!narrow.matches) return y + innerHeight * 0.5;
  return y + innerHeight * (0.46 + 0.54 * 0.35);
}

function update() {
  queued = false;
  if (!stops.length) return;
  stage.style.height = narrow.matches
    ? `${Math.round(mix(innerHeight, innerHeight * 0.46, ease(clamp01(scrollY / (innerHeight * 0.55)))))}px`
    : "";

  const line = readingLine();
  let a = stops[stops.length - 1], b = a, t = 0;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i], n = stops[i + 1];
    if (line < s.bottom || !n) { a = b = s; break; }
    if (line < n.top) { a = s; b = n; t = (line - s.bottom) / Math.max(n.top - s.bottom, 1); break; }
  }
  if (still.matches) t = t < 0.5 ? 0 : 1;
  const e = ease(clamp01(t));
  const A = resolve(a), B = resolve(b);
  const target = A.t.map((v, i) => mix(v, B.t[i], e));
  const orbit = A.o.map((v, i) => mix(v, B.o[i], e));
  const dx = mix(A.dx, B.dx, e) * innerWidth;
  const dy = mix(A.dy, B.dy, e) * innerHeight;

  viewer.cameraTarget = `${target[0].toFixed(4)}m ${target[1].toFixed(4)}m ${target[2].toFixed(4)}m`;
  viewer.cameraOrbit = `${orbit[0].toFixed(2)}deg ${orbit[1].toFixed(2)}deg ${orbit[2].toFixed(1)}%`;
  if (still.matches) viewer.jumpCameraToGoal();
  viewer.style.transform = dx || dy ? `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)` : "";

  const shown = e < 0.5 ? a : b;
  if (caption.textContent !== shown.pose.c) caption.textContent = shown.pose.c;
  caption.style.opacity = a === b ? 1 : Math.abs(e - 0.5) * 2;
  caption.style.setProperty("--dx", `${dx.toFixed(1)}px`);
}

function queue() {
  if (!queued) { queued = true; requestAnimationFrame(update); }
}

addEventListener("scroll", queue, { passive: true });
addEventListener("resize", measure);
narrow.addEventListener("change", measure);
document.fonts?.ready.then(measure);
new ResizeObserver(measure).observe(document.querySelector(".story"));

viewer.addEventListener("load", () => {
  const c = viewer.getBoundingBoxCenter();
  center = { x: c.x, y: c.y, z: c.z };
  measure();
  viewer.jumpCameraToGoal();
});
viewer.addEventListener("error", () => {
  caption.textContent = "The 3D model could not load. The picture shows the same board.";
  caption.style.opacity = 1;
});

measure();
