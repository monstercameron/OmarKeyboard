// Small pixel effects shared by the page: sparkles that answer a key press, pixel icons that
// assemble when their heading scrolls in, and a few twinkles around the board on the opening
// screen. Nothing here runs when the reader asks for reduced motion.
const still = matchMedia("(prefers-reduced-motion: reduce)");
// The Contents drawer can also switch the extras off.
export const calm = () => still.matches || document.documentElement.classList.contains("no-fun");

let layer = null;
function fxLayer() {
  if (!layer?.isConnected) {
    layer = document.createElement("div");
    layer.className = "fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  return layer;
}
// The center of an element, or null when it is hidden or outside the box it is clipped to.
function pointOf(target, within) {
  if (!(target instanceof Element)) return target;
  const r = target.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const c = within?.getBoundingClientRect();
  if (c && (p.x < c.left || p.x > c.right || p.y < c.top || p.y > c.bottom)) return null;
  return p;
}

// One four-point pixel star that grows and shrinks in hard sprite steps.
export function twinkle(target, { color = "#7aa2f7", px = 3, delay = 0, duration = 560, within } = {}) {
  if (calm()) return;
  const p = pointOf(target, within);
  if (!p) return;
  const { x, y } = p;
  const el = document.createElement("i");
  el.className = "fx-star";
  el.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;--c:${color};--p:${px}px;animation-duration:${duration}ms;animation-delay:${delay}ms`;
  fxLayer().append(el);
  setTimeout(() => el.remove(), duration + delay + 50);
}

// Square pixels thrown out from a point, moving in steps the way an 8-bit sprite would.
export function burst(target, { color = "#7aa2f7", count = 7, spread = 26, px = 3, star = true, within } = {}) {
  if (calm()) return;
  const p = pointOf(target, within);
  if (!p) return;
  const { x, y } = p;
  const root = fxLayer();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const d = spread * (0.6 + Math.random() * 0.5);
    const el = document.createElement("i");
    el.className = "fx-px";
    el.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;--c:${color};--p:${px}px`;
    root.append(el);
    const dx = Math.round(Math.cos(a) * d / px) * px, dy = Math.round(Math.sin(a) * d / px) * px;
    el.animate([
      { transform: "translate(-50%, -50%)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`, opacity: 0 },
    ], { duration: 380 + Math.random() * 160, easing: "steps(5, end)", fill: "forwards" }).finished.then(() => el.remove(), () => el.remove());
  }
  if (star) twinkle({ x, y }, { color, px: px + 1 });
}

// ---------------------------------------------------------------- pixel icons
// Each icon is drawn on a small grid. "#" takes the text color; letters take an accent.
const ACCENT = { a: "var(--px-desk, #ff9e64)", g: "var(--px-launch, #9ece6a)", b: "var(--px-window, #7aa2f7)", r: "var(--tn-red, #f7768e)" };
const ICONS = {
  hero: [
    ".#######.",
    "#.......#",
    "#.aaaaa.#",
    "#.......#",
    "#..###..#",
    "#.......#",
    ".#######.",
  ],
  grammar: [
    "##.......",
    "##...#...",
    "....###..",
    "##...#.aa",
    "##.....aa",
  ],
  edges: [
    ".aaaaaaa.",
    "g.......b",
    "g.#####.b",
    "g.#####.b",
    "g.#####.b",
    "g.......b",
    ".........",
  ],
  desks: [
    ".........",
    "#.#.a.#.#",
    "#.#.a.#.#",
    ".........",
    "....a....",
  ],
  windows: [
    "#########",
    "#...#bbbb",
    "#...#b..b",
    "#...#bbbb",
    "#...#...#",
    "#########",
  ],
  room: [
    "..#...#..",
    ".#.....#.",
    "#..a.a..#",
    ".#.....#.",
    "..#...#..",
  ],
  touch: [
    "..#####..",
    ".#..a..#.",
    "#...a...#",
    "#.......#",
    "#.......#",
    ".#.....#.",
    "..#####..",
  ],
  stock: [
    "#########",
    "#.......#",
    "#.#.....#",
    "#..#....#",
    "#.#..aa.#",
    "#.......#",
    "#########",
  ],
  try: [
    "#......",
    "##.....",
    "#a#....",
    "#aa#...",
    "#aaa#..",
    "#aaaa#.",
    "#a###..",
    "##.....",
  ],
  inside: [
    "aaaaaaaaa",
    ".........",
    ".#######.",
    ".........",
    "ggggggggg",
    ".........",
    "#########",
  ],
  specs: [
    "#########",
    "#.#.#.#.#",
    "#.#...#.#",
    "#.......#",
    "#########",
  ],
  circuit: [
    "a.......a",
    "#####...#",
    "....#...#",
    "....#####",
    "........#",
    "g########",
  ],
  lights: [
    "a...a...a",
    "...aaa...",
    ".#######.",
    ".#.###.#.",
    ".#.....#.",
    ".#######.",
  ],
  print: [
    "...aaa...",
    "....a....",
    ".........",
    "..ggggg..",
    ".#######.",
    "#########",
  ],
  parts: [
    "#########",
    "#.......#",
    "#.aa.##.#",
    "#.......#",
    "#.aa.##.#",
    "#.......#",
    "#########",
  ],
  roadmap: [
    "a#a#a#...",
    ".........",
    "......#..",
    ".#.#.#.#.",
    ".........",
  ],
  configure: [
    ".#.#.#.#.",
    "#########",
    "#.......#",
    "#.aaaaa.#",
    "#.a...a.#",
    "#.aaaaa.#",
    "#.......#",
    "#########",
    ".#.#.#.#.",
  ],
};
export function pixelIcon(name, cls = "") {
  const rows = ICONS[name];
  if (!rows) return "";
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  let rects = "", n = 0;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    // A fixed scatter, so the pixels arrive in the same scattered order every time.
    const order = ((x * 7 + y * 13 + n * 5) % 17) / 17;
    rects += `<rect x="${x}" y="${y}" width="1" height="1" style="--o:${order.toFixed(2)}"${ch === "#" ? "" : ` fill="${ACCENT[ch]}"`}/>`;
    n++;
  }));
  return `<svg class="px-icon ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false" fill="currentColor">${rects}</svg>`;
}

// Icons in the page's headings assemble once, the first time their heading comes into view.
export function revealIcons(root = document) {
  const icons = [...root.querySelectorAll(".px-icon.reveal:not(.on)")];
  if (calm() || !("IntersectionObserver" in window)) { icons.forEach(i => i.classList.add("on")); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -15% 0px" });
  icons.forEach(i => io.observe(i));
}

// ---------------------------------------------------------------- the opening screen
// A star now and then over the board while the reader is still on the first screen.
export function ambient(area, { colors = ["#7aa2f7", "#f2cd8f"], active = () => true } = {}) {
  let timer = 0;
  const tick = () => {
    timer = setTimeout(tick, 1100 + Math.random() * 1700);
    if (calm() || document.hidden || !active()) return;
    const r = area();
    if (!r) return;
    const x = r.left + r.width * Math.random(), y = r.top + r.height * Math.random();
    twinkle({ x, y }, { color: colors[Math.floor(Math.random() * colors.length)], px: Math.random() < 0.3 ? 3 : 2, duration: 900 });
  };
  timer = setTimeout(tick, 1800);
  return () => clearTimeout(timer);
}
