// The playful layer: Omi the keycap, hand-drawn notes, a glyph field, more sparkles, the board
// drawn in ASCII at the foot of the page and an "Ask about the board" panel. Everything here can
// be switched off from the Contents drawer, and nothing moves for readers who ask for less motion.
import { burst, twinkle, calm } from "./fx.js";

const still = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const narrow = matchMedia("(max-width: 999px)");
const TN = ["#7aa2f7", "#bb9af7", "#ff9e64", "#9ece6a", "#7dcfff", "#e0af68", "#f7768e"];
const pick = a => a[Math.floor(Math.random() * a.length)];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};
const html = document.documentElement;
const funOn = () => !html.classList.contains("no-fun");
if (store.get("omar-fun") === "off") html.classList.add("no-fun");
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const NS = "http://www.w3.org/2000/svg";
const S = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// ---------------------------------------------------------------- switch in the Contents drawer
{
  const toc = document.querySelector("#toc");
  if (toc) {
    const label = el("label", "fun-switch");
    const box = el("input");
    box.type = "checkbox";
    box.checked = funOn();
    label.append(box, el("span", "", "Omi, sketches and sparkles"));
    toc.append(label);
    box.addEventListener("change", () => {
      html.classList.toggle("no-fun", !box.checked);
      store.set("omar-fun", box.checked ? "on" : "off");
      if (box.checked) burst(label, { color: "#ff9e64", count: 10 });
    });
  }
}

// ---------------------------------------------------------------- rough pen strokes
// A seeded wobble, so each sketch looks hand drawn but the same on every visit.
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function smooth(pts) {
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    d += ` Q${x.toFixed(2)} ${y.toFixed(2)} ${((x + nx) / 2).toFixed(2)} ${((y + ny) / 2).toFixed(2)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l[0].toFixed(2)} ${l[1].toFixed(2)}`;
}
function roughEllipse(cx, cy, rx, ry, seed = 1) {
  const r = rng(seed), pts = [], n = 26, start = r() * Math.PI * 2;
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2.18, j = 1 + (r() - .5) * .09;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  return smooth(pts);
}
function roughArrow(x1, y1, x2, y2, bend = .25, seed = 2, head = 4) {
  const r = rng(seed), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * bend, cy = my + dx * bend, pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, u = 1 - t;
    const wob = (r() - .5) * Math.hypot(dx, dy) * .012;
    pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2 + wob, u * u * y1 + 2 * u * t * cy + t * t * y2 + wob]);
  }
  // The curve leaves its control point toward the tip, so that is the way the head points.
  const a = Math.atan2(y2 - cy, x2 - cx);
  const tip = (s) => [x2 - Math.cos(a + s) * head, y2 - Math.sin(a + s) * head];
  const [ax, ay] = tip(.5), [bx, by] = tip(-.5);
  return [smooth(pts), `M${ax.toFixed(2)} ${ay.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} L${bx.toFixed(2)} ${by.toFixed(2)}`];
}
// Strokes draw themselves once their sketch scrolls into view.
const drawIO = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("drawn"); drawIO.unobserve(e.target); }
}, { rootMargin: "0px 0px -12% 0px" }) : null;
function watchDraw(node) {
  for (const p of node.querySelectorAll(".ink")) p.setAttribute("pathLength", "1");
  if (!drawIO || still.matches) node.classList.add("drawn"); else drawIO.observe(node);
}

// Handwritten notes in the text.
function note(target, text, { where = "append", cls = "", tilt = -3 } = {}) {
  if (!target) return null;
  const n = el("span", `sketch-note ${cls}`, text);
  n.setAttribute("aria-hidden", "true");
  n.style.setProperty("--tilt", `${tilt}deg`);
  if (where === "after") target.after(n); else target.append(n);
  watchDraw(n);
  return n;
}
note(document.querySelector("#configure"), "go on, click a key", { tilt: -4 });
note(document.querySelector("#mcu-title"), "29 of 30 pins in use!", { tilt: -3, cls: "cyan" });
note(document.querySelector("#parts"), "90 sockets, zero solder", { tilt: -2 });
note(document.querySelector("#try"), "click the keys!", { tilt: -5 });
note(document.querySelector(".route li.here"), "↓ we are here", { tilt: -4, cls: "here-note" });

// A note and arrow beside the opening line, pointing at the board.
{
  const cue = document.querySelector(".hero .cue");
  if (cue) {
    // Sits to the right of the cue, rising steeply toward the board in the middle of the screen.
    const svg = S("svg", { class: "sketch hero-sketch", viewBox: "0 0 300 170", "aria-hidden": "true" });
    const [a, h] = roughArrow(34, 128, 284, 14, -.28, 7, 12);
    svg.append(S("path", { class: "ink", d: a }), S("path", { class: "ink late", d: h }));
    const t = S("text", { x: 10, y: 160, class: "sketch-text" });
    t.textContent = "drag me around!";
    svg.append(t);
    cue.after(svg);
    watchDraw(svg);
  }
}

// Notes drawn on the circuit board itself, in millimetres, once the board has loaded.
function sketchBoard(pcb) {
  const g = S("g", { class: "pcb-sketch", "aria-hidden": "true" });
  const add = (d, late) => g.append(S("path", { class: `ink${late ? " late" : ""}`, d }));
  const text = (x, y, s, cls = "") => { const t = S("text", { x, y, class: `sketch-text ${cls}` }); t.textContent = s; g.append(t); };
  add(roughEllipse(341.5, 41, 15, 13, 11));
  const [a1, h1] = roughArrow(300, 70, 325, 50, .25, 5, 3.5); add(a1); add(h1, true);
  text(262, 80, "the brain lives here");
  // The light chain starts under Esc and ends at Files, 90 lights later.
  const [a2, h2] = roughArrow(74, 30, 43, 9, .3, 8, 3.5); add(a2); add(h2, true);
  text(62, 38, "90 lights, starting at Esc", "green");
  const [a3, h3] = roughArrow(300, 14, 344, 22, -.25, 13, 3.5); add(a3); add(h3, true);
  text(248, 17, "USB comes in here", "cyan");
  pcb.append(g);
  watchDraw(g);
}
{
  const canvas = document.querySelector(".pcb-canvas");
  if (canvas) {
    const ready = () => { const pcb = canvas.querySelector("svg.pcb"); if (pcb && !pcb.querySelector(".pcb-sketch")) { sketchBoard(pcb); return true; } return false; };
    if (!ready()) {
      const mo = new MutationObserver(() => { if (ready()) mo.disconnect(); });
      mo.observe(canvas, { childList: true });
    }
    // Copper glints follow the mouse over the board.
    let last = 0;
    canvas.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse" || !funOn() || e.buttons) return;
      const now = performance.now();
      if (now - last < 110) return;
      last = now;
      twinkle({ x: e.clientX + (Math.random() - .5) * 26, y: e.clientY + (Math.random() - .5) * 26 }, { color: pick(["#ff9e64", "#e0af68", "#7aa2f7"]), px: 2, duration: 520 });
    });
  }
}

// ---------------------------------------------------------------- sparkles on every click
const CLICKY = "button, a, [role=tab], label:has(input), summary";
document.addEventListener("pointerdown", e => {
  if (!funOn() || e.button !== 0) return;
  const t = e.target.closest(CLICKY);
  // The board keys and the Try it keys already answer with their own sparkles.
  if (!t || t.closest(".cfg-board, .play-panel .k, .monitor, .omi")) return;
  burst({ x: e.clientX, y: e.clientY }, { color: pick(TN), count: 6, spread: 18, px: 2, star: Math.random() < .5 });
});

// A heading's pixel icon throws a few sparks as it finishes assembling.
if ("MutationObserver" in window) {
  const seen = new WeakSet();
  new MutationObserver(list => {
    for (const m of list) {
      const t = m.target;
      if (!(t instanceof SVGElement) || !t.classList.contains("h-icon") || !t.classList.contains("on") || seen.has(t)) continue;
      seen.add(t);
      if (funOn()) setTimeout(() => twinkle(t, { color: pick(TN), px: 2, duration: 640 }), 540);
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
}

// ---------------------------------------------------------------- glyph field
// Faint keyboard glyphs drift up behind the circuit heading and scatter from the pointer.
{
  const head = document.querySelector(".circuit-head");
  if (head) {
    const cv = el("canvas", "glyph-field");
    cv.setAttribute("aria-hidden", "true");
    head.prepend(cv);
    const ctx = cv.getContext("2d");
    const GLYPHS = [..."⌘⇧⌥⏎⌫⇥↹◆▲▼◀▶░▒▓✦✧+×=<>/{}[]λ#$%&*~^|"];
    let W = 0, H = 0, dpr = 1, parts = [], visible = false, raf = 0, mx = -1e4, my = -1e4;
    const size = () => {
      const r = head.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      // 60 px past the heading on each side, but never past the right edge of the page.
      W = Math.min(r.width + 120, document.documentElement.clientWidth - r.left + 60); H = r.height + 80;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      const n = Math.round(Math.min(140, W * H / 9000));
      parts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, s: 11 + Math.random() * 9,
        g: pick(GLYPHS), c: Math.random() < .14 ? pick(TN) : null, a: .1 + Math.random() * .16, sp: .12 + Math.random() * .28,
      }));
      draw(0);
    };
    function draw(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        if (dt) {
          const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
          if (d2 < 9000) { const f = (1 - d2 / 9000) * 1.6; p.vx += dx / Math.sqrt(d2 + 1) * f; p.vy += dy / Math.sqrt(d2 + 1) * f; p.hot = 1; }
          p.vx *= .9; p.vy *= .9;
          p.x += p.vx; p.y += p.vy - p.sp * dt * .06;
          p.hot = Math.max(0, (p.hot || 0) - dt * .0015);
          if (p.y < -20) { p.y = H + 10; p.x = Math.random() * W; }
          if (p.x < -20) p.x = W + 10; else if (p.x > W + 20) p.x = -10;
        }
        ctx.font = `${p.s}px "JetBrains Mono", monospace`;
        const hot = p.hot || 0;
        ctx.globalAlpha = Math.min(1, p.a + hot * .7);
        ctx.fillStyle = hot > .05 ? "#ff9e64" : (p.c ?? "#565f89");
        ctx.fillText(p.g, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }
    let t0 = 0;
    const loop = t => {
      raf = 0;
      if (!visible || !funOn() || still.matches || document.hidden) return;
      // About 30 frames a second is plenty for drifting text.
      if (t - t0 >= 32) { draw(Math.min(64, t - t0)); t0 = t; }
      raf = requestAnimationFrame(loop);
    };
    const go = () => { if (!raf && visible && funOn() && !still.matches) { t0 = performance.now(); raf = requestAnimationFrame(loop); } };
    new ResizeObserver(size).observe(head);
    new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); go(); }).observe(head);
    head.parentElement.addEventListener("pointermove", e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; go(); }, { passive: true });
    head.parentElement.addEventListener("pointerleave", () => { mx = my = -1e4; });
    document.addEventListener("visibilitychange", go);
  }
}

// ---------------------------------------------------------------- the board in ASCII
{
  const foot = document.querySelector(".colophon");
  if (foot) {
    fetch("assets/omar-keys.json").then(r => r.json()).then(data => {
      const U = 19.05 / 6, COLS = Math.ceil(data.case[0] / U) - 4;
      const rows = new Map();
      for (const [label, cx, cy, w, group] of data.keys) {
        const r = Math.round((cy - 9.53) / 19.05);
        if (!rows.has(r)) rows.set(r, []);
        rows.get(r).push({ label, x0: Math.round((cx - w / 2) / U), x1: Math.round((cx + w / 2) / U), group });
      }
      // The roller spans two rows, drawn as one ribbed block.
      const [rx, ry, rw, rh] = data.roller;
      // The rows whose key centers fall inside the roller's height.
      const r0 = Math.ceil((ry - 9.53) / 19.05), r1 = Math.floor((ry + rh - 9.53) / 19.05);
      for (let r = r0; r <= r1; r++) rows.get(r)?.push({ label: "", x0: Math.round(rx / U), x1: Math.round((rx + rw) / U), group: "roller", part: r === r0 ? "top" : r === r1 ? "bottom" : "middle" });
      const short = (s, n) => {
        let t = s.replace(/\s+/g, "");
        if (t.length > n) t = t[0] + t.slice(1).replace(/[aeiou]/g, "");
        return t.slice(0, n);
      };
      const lines = [];
      for (const r of [...rows.keys()].sort((a, b) => a - b)) {
        const keys = rows.get(r).sort((a, b) => a.x0 - b.x0);
        const top = [], mid = [], bot = [];
        let col = 0;
        for (const k of keys) {
          const w = Math.max(3, k.x1 - k.x0), gap = Math.max(0, k.x0 - col);
          const pad = " ".repeat(gap);
          const inner = w - 2, lab = short(k.label, inner);
          const g = k.group;
          // Plain ASCII, so every character comes from the page's own monospace font.
          const edge = "+" + "-".repeat(inner) + "+", rib = "|" + ":".repeat(inner) + "|";
          if (g === "roller") {
            const name = " roller ", mid0 = Math.max(0, Math.floor((inner - name.length) / 2));
            const named = "|" + (":".repeat(mid0) + name).padEnd(inner, ":").slice(0, inner) + "|";
            top.push([pad, null], [k.part === "top" ? edge : rib, g]);
            mid.push([pad, null], [k.part === "top" ? named : rib, g]);
            bot.push([pad, null], [k.part === "bottom" ? edge : rib, g]);
          } else {
            top.push([pad, null], [edge, g]);
            mid.push([pad, null], ["|" + lab.padEnd(inner, " ") + "|", g]);
            bot.push([pad, null], [edge, g]);
          }
          col = k.x0 + w;
        }
        lines.push(top, mid, bot);
      }
      const term = el("div", "ascii");
      term.setAttribute("aria-hidden", "true");
      const prompt = el("p", "ascii-prompt");
      prompt.innerHTML = '<span class="a-user">omar@omarchy</span> <span class="a-path">~</span> $ <span class="a-cmd"></span><span class="a-caret"></span>';
      const pre = el("pre", "ascii-board");
      lines.forEach((segs, i) => {
        const line = el("span", "a-line");
        line.style.setProperty("--i", i);
        for (const [txt, g] of segs) {
          if (!g) { line.append(txt); continue; }
          line.append(el("span", `a-${g}`, txt));
        }
        pre.append(line, "\n");
      });
      pre.style.setProperty("--cols", COLS);
      const sign = el("p", "ascii-sign", "92 controls, 90 lights, one roller. Drawn from omar-keys.json, the same coordinates as the plate.");
      term.append(prompt, pre, sign);
      foot.prepend(term);
      const cmd = prompt.querySelector(".a-cmd"), text = "omar --draw-board";
      const show = () => {
        if (term.classList.contains("run")) return;
        term.classList.add("run");
        if (still.matches || !funOn()) { cmd.textContent = text; term.classList.add("done"); return; }
        let i = 0;
        const type = () => {
          cmd.textContent = text.slice(0, ++i);
          if (i < text.length) setTimeout(type, 55 + Math.random() * 60);
          else setTimeout(() => term.classList.add("done"), 260);
        };
        type();
      };
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((es, io) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); show(); } }, { threshold: .3 }).observe(term);
      } else show();
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------- confetti
function confetti() {
  if (calm()) return;
  const layer = el("div", "confetti");
  layer.setAttribute("aria-hidden", "true");
  document.body.append(layer);
  const glyphs = [..."⌘⇧⌥⏎◆▲✦✧★♥λ{}<>"];
  for (let i = 0; i < 70; i++) {
    const g = el("i", "", pick(glyphs));
    g.style.cssText = `left:${Math.random() * 100}vw;color:${pick(TN)};font-size:${12 + Math.random() * 16}px`;
    layer.append(g);
    const fall = innerHeight + 80, drift = (Math.random() - .5) * 240, spin = (Math.random() - .5) * 720;
    g.animate([
      { transform: "translate(0, -40px) rotate(0deg)", opacity: 1 },
      { transform: `translate(${drift}px, ${fall}px) rotate(${spin}deg)`, opacity: .9 },
    ], { duration: 1600 + Math.random() * 1400, delay: Math.random() * 500, easing: "steps(18, end)", fill: "forwards" });
  }
  setTimeout(() => layer.remove(), 3800);
}

// ---------------------------------------------------------------- Omi
// A spare keycap in the corner. It has something to say about each part of the page, reacts to
// presses in Try it and opens the question panel when clicked.
const SPRITE = [
  "..oooooooo..",
  ".occcccccco.",
  "occcccccccco",
  "occcccccccco",
  "occcccccccco",
  "occcccccccco",
  "occcccccccco",
  "occcccccccco",
  "osssssssssso",
  ".osssssssso.",
  "..oooooooo..",
];
const FACE = {
  open: [[3, 3], [3, 4], [8, 3], [8, 4]],
  shut: [[2, 4], [3, 4], [8, 4], [9, 4]],
  happy: [[3, 3], [2, 4], [4, 4], [8, 3], [7, 4], [9, 4]],
  smile: [[4, 6], [5, 6], [6, 6], [7, 6], [3, 5], [8, 5]],
  o: [[5, 6], [6, 6], [5, 7], [6, 7]],
  flat: [[4, 6], [5, 6], [6, 6], [7, 6]],
};
const LINES = {
  hero: "Hi, I’m Omi, a spare keycap. Scroll down and I’ll point out the good bits.",
  grammar: "Super and a number, Super and an arrow. Omarchy’s shortcuts are a small language, and this board spells it out.",
  edges: "Three new edges: the left one launches, the top one travels and the right one rearranges.",
  desks: "Five desks, one key each. Desk 3 is my favourite. Don’t tell the others.",
  windows: "Hold Focus and tap an arrow. It steers windows like a joystick.",
  room: "The number row moved over so the desks could have the top edge.",
  touch: "Two dials and a roller. Volume on the left, brightness on the right, scrolling in the middle.",
  stock: "No custom bindings needed. It speaks stock Omarchy.",
  try: "Go on: Send & Stay, then Desk 3, then Desk 3 again. I’ll wait.",
  inside: "Five layers, and not one switch soldered in.",
  specs: "422.8 millimetres of keyboard, measured twice.",
  circuit: "4,744 copper traces and no rule errors. The green marks are the light data hopping under all 90 keys.",
  parts: "Five assembled boards for $277.81. The sockets are three cents each; the dials are the fancy parts.",
  roadmap: "Next stop: a tiny board for the USB-C socket.",
  configure: "Click any key to see what it really sends. Psst: try typing omarchy anywhere.",
};
const IDLE = [
  "I can answer questions about the board. Click me.",
  "Fun fact: every key has its own diode, so any combination of keys can be read.",
  "The controller has no flash of its own. It runs from the little chip next to it.",
  "Every key has a light, upside down under the board, shining up through a window.",
  "Psst: type omarchy anywhere on the page.",
];

function buildOmi() {
  const wrap = el("div", "omi");
  const btn = el("button", "omi-btn");
  btn.type = "button";
  btn.setAttribute("aria-label", "Omi: ask a question about the board");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "omi-ask");
  const svg = S("svg", { viewBox: "0 0 12 11", class: "omi-sprite", "shape-rendering": "crispEdges", "aria-hidden": "true" });
  SPRITE.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    svg.append(S("rect", { x, y, width: 1, height: 1, class: `p-${ch}` }));
  }));
  svg.append(S("rect", { x: 2, y: 1, width: 3, height: 1, class: "p-shine" }));
  for (const [name, px] of Object.entries(FACE)) {
    const g = S("g", { class: `f f-${name}` });
    for (const [x, y] of px) g.append(S("rect", { x, y, width: 1, height: 1, class: "p-e" }));
    svg.append(g);
  }
  btn.append(svg);
  const bubble = el("div", "omi-bubble");
  bubble.setAttribute("role", "status");
  const say = el("p", "omi-say");
  const close = el("button", "omi-hush", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Hide Omi’s message");
  bubble.append(say, close);
  wrap.append(bubble, btn);
  document.body.append(wrap);
  return { wrap, btn, svg, bubble, say, close };
}

const omi = buildOmi();
let face = "open", mouth = "smile";
function setFace(eyes = "open", m = "smile") {
  face = eyes; mouth = m;
  omi.svg.dataset.eyes = eyes;
  omi.svg.dataset.mouth = m;
}
setFace();
// Blinks now and then.
(function blink() {
  setTimeout(() => {
    if (face === "open" && funOn()) { setFace("shut", mouth); setTimeout(() => setFace("open", mouth), 140); }
    blink();
  }, 2600 + Math.random() * 3200);
})();

let sayTimer = 0, typeTimer = 0, lastLine = "";
function speak(text, { hold = 7000, eyes = "open", m = "smile", force = false } = {}) {
  if (!funOn() || (!force && text === lastLine)) return;
  if (!force && narrow.matches && !omi.wrap.classList.contains("ask-open")) {
    // On a phone the message waits behind a dot until Omi is tapped.
    omi.wrap.classList.add("has-news");
    omi.wrap.dataset.news = text;
    lastLine = text;
    return;
  }
  lastLine = text;
  clearTimeout(sayTimer); clearTimeout(typeTimer);
  setFace(eyes, m);
  omi.wrap.classList.add("talking");
  omi.wrap.classList.remove("has-news");
  if (still.matches) omi.say.textContent = text;
  else {
    let i = 0;
    omi.say.textContent = "";
    const step = () => { i = Math.min(text.length, i + 2); omi.say.textContent = text.slice(0, i); if (i < text.length) typeTimer = setTimeout(step, 22); };
    step();
  }
  sayTimer = setTimeout(hush, hold);
}
function hush() {
  omi.wrap.classList.remove("talking");
  setFace("open", "smile");
}
omi.close.addEventListener("click", hush);
omi.btn.addEventListener("pointerdown", () => { if (funOn()) burst(omi.btn, { color: "#e0af68", count: 8, spread: 22 }); });

// What Omi says about each part of the page, as it reaches the reading line.
{
  const targets = [];
  // The greeting waits for the first scroll: on the opening screen the bubble would sit
  // over the opening paragraph.
  const greet = () => {
    if (scrollY < innerHeight * .2) return;
    removeEventListener("scroll", greet);
    if (scrollY < innerHeight * .9) speak(LINES.hero);
  };
  addEventListener("scroll", greet, { passive: true });
  for (const id of Object.keys(LINES)) {
    if (id === "hero") continue;
    const h = document.getElementById(id);
    if (h) targets.push([h.closest(".step, .play-hold, .circuit-head, .parts, .roadmap, .cfg-head, section") ?? h, id]);
  }
  let shown = new Set();
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const id = e.target.dataset.omi;
        if (shown.has(id)) continue;
        shown.add(id);
        setTimeout(() => speak(LINES[id]), 400);
      }
    }, { rootMargin: "-20% 0px -45% 0px" });
    for (const [node, id] of targets) { node.dataset.omi = id; io.observe(node); }
  }
  // Something to say after a quiet minute.
  let quiet = 0;
  const poke = () => { quiet = 0; };
  addEventListener("scroll", poke, { passive: true });
  addEventListener("pointerdown", poke);
  setInterval(() => {
    quiet += 15;
    if (quiet >= 60 && !omi.wrap.classList.contains("talking") && !omi.wrap.classList.contains("ask-open")) { quiet = 0; speak(pick(IDLE), { eyes: "happy" }); }
  }, 15000);
}

// Presses in Try it get a reaction.
{
  const key = document.querySelector(".play-key"), chord = document.querySelector(".play-chord");
  if (key && "MutationObserver" in window) {
    let t = 0;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        const k = key.textContent.trim(), c = chord?.textContent.trim();
        if (!k || /^Press a key/.test(k)) return;
        const quips = ["Nice.", "Smooth.", "Omarchy approves.", "Again!", "That one’s my favourite."];
        speak(`${k}${c ? `: ${c}` : ""}. ${pick(quips)}`, { eyes: "happy", hold: 3800, force: true });
        if (funOn()) burst(omi.btn, { color: pick(TN), count: 6, spread: 18 });
      }, 120);
    }).observe(key, { childList: true, characterData: true, subtree: true });
  }
}

// Typing "omarchy" anywhere outside a text field.
{
  let buf = "";
  addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest?.("input, textarea, select, [contenteditable], .cfg-board, .play")) return;
    buf = (buf + e.key.toLowerCase()).slice(-7);
    if (buf === "omarchy") {
      buf = "";
      confetti();
      speak("Welcome home. That was the secret word.", { eyes: "happy", force: true });
    }
  });
}

// ---------------------------------------------------------------- Ask about the board
// Questions are answered from this page's own text. When the browser has a built-in language
// model (Chrome's Prompt API), it writes the answer from the closest passages; otherwise those
// passages are the answer.
const STOP = new Set("a an and are as at be but by can do does for from has have how i if in into is it its of on or so that the their them then there these they this to was what when where which who why will with you your about up out than also each just only".split(" "));
const stem = w => w.replace(/(ies)$/, "y").replace(/(ing|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
const words = t => t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9.+\- ]+/g, " ").split(/\s+/).map(w => w.replace(/^[.\-+]+|[.\-+]+$/g, "")).filter(w => w && !STOP.has(w)).map(stem);
let corpus = null;
// A heading's own words, without the sketch notes and icons added to it.
const headingText = h => [...h.childNodes].filter(n => !(n.classList?.contains("sketch-note") || n.classList?.contains("px-icon"))).map(n => n.textContent).join("").replace(/\s+/g, " ").trim();
function buildCorpus() {
  const out = [];
  const sel = ".story p, .story li, .story dd, .story .mcu-list div, .story .bom tbody tr:not(.bom-group), .story .needs div, .story .specs div, .story table.chords tr";
  for (const node of document.querySelectorAll(sel)) {
    if (node.closest(".cfg-work, .monitor, .omi, .ascii, .toc, .sketch-note, .route li li") || node.querySelector("p, li")) continue;
    if (node.matches(".mcu-list dd")) continue;
    // Table rows are read cell by cell, so "15" and "LED1" do not run together.
    const parts = node.cells ? [...node.cells] : node.querySelector(":scope > dt") ? [...node.children] : null;
    const raw = parts ? parts.map(c => c.textContent.replace(/\bShow\b/g, "").trim()).filter(Boolean).join(". ") : node.textContent;
    const text = raw.replace(/\s+/g, " ").trim();
    if (text.length < 24) continue;
    const sec = node.closest("section, header, footer");
    const h = sec?.querySelector("h2, h3") ?? node.closest(".story")?.querySelector("h1");
    const heading = h ? headingText(h) : "Omar-Keyboard";
    out.push({ node, text, heading, id: h?.id || "", toks: words(`${heading} ${text}`) });
  }
  const df = new Map();
  for (const d of out) for (const t of new Set(d.toks)) df.set(t, (df.get(t) || 0) + 1);
  const avg = out.reduce((s, d) => s + d.toks.length, 0) / Math.max(1, out.length);
  return { docs: out, df, avg, n: out.length };
}
function search(q, k = 4) {
  corpus ??= buildCorpus();
  const qt = [...new Set(words(q))];
  const { docs, df, avg, n } = corpus;
  const scored = docs.map(d => {
    let s = 0;
    const tf = new Map();
    for (const t of d.toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of qt) {
      const f = tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (n - df.get(t) + .5) / (df.get(t) + .5));
      s += idf * (f * 2.2) / (f + 1.2 * (.25 + .75 * d.toks.length / avg));
    }
    return { d, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  return scored.slice(0, k).map(x => x.d);
}

const LM = globalThis.LanguageModel;
const LM_OPTS = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
async function modelState() {
  if (!LM?.availability) return "none";
  try { return await LM.availability(LM_OPTS); } catch { return "none"; }
}
let session = null;
async function getSession(onProgress) {
  if (session) return session;
  session = await LM.create({
    ...LM_OPTS,
    initialPrompts: [{
      role: "system",
      content: "You answer questions about Omar-Keyboard, a keyboard designed for the Omarchy Linux desktop, using only the numbered passages from its web page that come with each question. Answer in at most three short sentences of plain text, no lists or markdown. If the passages do not answer the question, say that the page does not cover it. Never invent part numbers, measurements or prices.",
    }],
    monitor(m) { m.addEventListener("downloadprogress", e => onProgress?.(e.loaded)); },
  });
  return session;
}

const SUGGEST = [
  "Which pin sends the light data?",
  "What does the USB-C carrier need?",
  "How do I move a window to Desk 3?",
  "How bright can the backlight go?",
  "What is left before ordering boards?",
  "Why are the switches not soldered?",
];

function buildAsk() {
  const panel = el("section", "omi-ask");
  panel.id = "omi-ask";
  panel.hidden = true;
  panel.setAttribute("aria-labelledby", "omi-ask-title");
  panel.innerHTML = `
    <div class="ask-head"><h2 id="omi-ask-title">Ask about the board</h2><button type="button" class="ask-close" aria-label="Close the question panel">×</button></div>
    <form class="ask-form"><label class="visually-hidden" for="ask-q">Your question</label><input id="ask-q" class="ask-q" type="text" autocomplete="off" placeholder="What does the roller connect to?" maxlength="200"><button type="submit" class="ask-go">Ask</button></form>
    <div class="ask-chips" role="group" aria-label="Example questions"></div>
    <div class="ask-out" aria-live="polite"></div>
    <p class="ask-mode"></p>`;
  document.body.append(panel);
  const chips = panel.querySelector(".ask-chips");
  for (const s of SUGGEST) { const b = el("button", "ask-chip", s); b.type = "button"; chips.append(b); }
  return panel;
}
const ask = buildAsk();
const askQ = ask.querySelector(".ask-q"), askOut = ask.querySelector(".ask-out"), askMode = ask.querySelector(".ask-mode");
let mode = "none";
async function refreshMode() {
  mode = await modelState();
  const words = {
    available: "Answers are written by the language model built into this browser, from passages on this page. It runs on this computer.",
    downloadable: store.get("omar-ai") === "yes" ? "Answers are written by the browser’s built-in language model, which downloads once and runs on this computer." : "Answers are the closest passages on this page. This browser also has a built-in language model that can write them out, after a one-time download.",
    downloading: "The browser’s built-in model is downloading. Meanwhile the closest passages on this page are shown.",
    none: "Answers are the closest passages on this page. In a browser with a built-in language model, such as recent desktop Chrome, it would write them out.",
    unavailable: "Answers are the closest passages on this page. This browser’s built-in model is not available on this device.",
  };
  askMode.textContent = words[mode] ?? words.none;
}
function openAsk(focus = true) {
  ask.hidden = false;
  omi.wrap.classList.add("ask-open");
  omi.btn.setAttribute("aria-expanded", "true");
  hush();
  refreshMode();
  if (omi.wrap.dataset.news && narrow.matches) { speak(omi.wrap.dataset.news, { force: true }); delete omi.wrap.dataset.news; }
  if (focus) askQ.focus();
}
function closeAsk() {
  ask.hidden = true;
  omi.wrap.classList.remove("ask-open");
  omi.btn.setAttribute("aria-expanded", "false");
  omi.btn.focus({ preventScroll: true });
}
omi.btn.addEventListener("click", () => (ask.hidden ? openAsk() : closeAsk()));
ask.querySelector(".ask-close").addEventListener("click", closeAsk);
addEventListener("keydown", e => { if (e.key === "Escape" && !ask.hidden) closeAsk(); });
ask.querySelector(".ask-chips").addEventListener("click", e => {
  const b = e.target.closest(".ask-chip");
  if (!b) return;
  askQ.value = b.textContent;
  answer(b.textContent);
});
ask.querySelector(".ask-form").addEventListener("submit", e => {
  e.preventDefault();
  const q = askQ.value.trim();
  if (q) answer(q);
});

function jumpTo(d) {
  d.node.scrollIntoView({ behavior: still.matches ? "auto" : "smooth", block: "center" });
  d.node.classList.add("ask-hit");
  setTimeout(() => d.node.classList.remove("ask-hit"), 2600);
  if (funOn()) setTimeout(() => twinkle(d.node, { color: "#ff9e64", px: 3, duration: 700 }), 600);
}
function sources(list, { fullFirst = false } = {}) {
  const ol = el("ol", "ask-src");
  list.forEach((d, i) => {
    if (fullFirst && i === 0) {
      // Without a written answer, the best match is the answer, so it is shown whole.
      const li = el("li", "ask-best");
      const b = el("button", "ask-jump");
      b.type = "button";
      b.innerHTML = `<b>1</b> <span></span>`;
      b.querySelector("span").textContent = d.heading;
      b.addEventListener("click", () => jumpTo(d));
      li.append(b, el("p", "ask-text", d.text));
      ol.append(li);
      return;
    }
    const li = el("li");
    const b = el("button", "ask-jump");
    b.type = "button";
    b.innerHTML = `<b>${i + 1}</b> <span></span>`;
    b.querySelector("span").textContent = d.heading;
    b.addEventListener("click", () => jumpTo(d));
    const q = el("q", "", d.text.length > 180 ? d.text.slice(0, 177).replace(/\s\S*$/, "") + "…" : d.text);
    li.append(b, q);
    ol.append(li);
  });
  return ol;
}
let asking = 0;
async function answer(q) {
  const run = ++asking;
  const hits = search(q, 4);
  askOut.replaceChildren();
  setFace("happy", "o");
  if (!hits.length) {
    askOut.append(el("p", "ask-text", "Nothing on this page matches that. Try naming a part, a key or a section, such as the roller, Desk 3 or the USB carrier."));
    setFace("open", "flat");
    return;
  }
  const passages = (label) => askOut.replaceChildren(el("p", "ask-label", label), sources(hits, { fullFirst: true }));
  const textP = el("p", "ask-text");
  askOut.append(textP, el("p", "ask-label", "From these parts of the page"), sources(hits));
  const useModel = mode === "available" || ((mode === "downloadable" || mode === "downloading") && store.get("omar-ai") === "yes");
  if (!useModel) {
    passages("Closest passages on this page");
    setFace("open", "smile");
    // The browser's model is a large download, so it is only fetched when the reader asks for it.
    if (mode === "downloadable" || mode === "downloading") {
      const offer = el("div", "ask-offer");
      const b = el("button", "ask-go", "Write answers with the browser’s built-in model");
      b.type = "button";
      offer.append(b, el("p", "ask-mode", "The browser downloads its model once. It is large, and it runs on this computer, so questions never leave it."));
      b.addEventListener("click", () => { store.set("omar-ai", "yes"); answer(q); });
      askOut.append(offer);
    }
    return;
  }
  textP.classList.add("thinking");
  textP.textContent = mode === "available" ? "Thinking" : "Downloading the browser’s model";
  try {
    const s = await getSession(p => { if (run === asking) textP.textContent = `Downloading the browser’s model, ${Math.round(p * 100)}%`; });
    if (run !== asking) return;
    const prompt = hits.map((d, i) => `[${i + 1}] (${d.heading}) ${d.text}`).join("\n") + `\n\nQuestion: ${q}`;
    let out = "";
    textP.classList.remove("thinking");
    textP.textContent = "";
    const stream = s.promptStreaming(prompt);
    for await (const chunk of stream) {
      if (run !== asking) return;
      // Older builds send the whole answer so far, newer ones only the new text.
      out = chunk.startsWith(out) ? chunk : out + chunk;
      textP.textContent = out;
    }
    // A stub or broken model can echo the prompt back or say nothing; then the page answers.
    if (!out.trim() || /Question:|\[1\] \(/.test(out) || out.includes(hits[0].text.slice(0, 40))) throw new Error("no answer");
    setFace("open", "smile");
    refreshMode();
  } catch {
    if (run !== asking) return;
    passages("The browser’s model did not answer. Closest passages on this page");
    setFace("open", "flat");
  }
}
