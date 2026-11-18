// The circuit board section: the routed Rev B.1 copper drawn from the KiCad board file, the signals
// that travel along it, the controller's pins and the schematic sheets. The drawings come from
// tools/build-site-pcb.py and tools/build-site-schematics.py and are themed by styles.css.
import { calm, twinkle } from "./fx.js";

const root = document.querySelector(".circuit");
const NS = "http://www.w3.org/2000/svg";
const SVG = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// ---------------------------------------------------------------- pan and zoom
// Moves an SVG's viewBox. The page keeps scrolling normally until the reader zooms in.
function panZoom(svg, host, { onChange, minScale = 1 / 30 } = {}) {
  const b = svg.viewBox.baseVal;
  const fit = { x: b.x, y: b.y, w: b.width, h: b.height };
  const aspect = fit.h / fit.w;
  let v = { ...fit }, anim = 0;

  const clamp = n => {
    const w = Math.min(fit.w, Math.max(fit.w * minScale, n.w)), h = w * aspect;
    const cx = Math.min(fit.x + fit.w, Math.max(fit.x, n.x + n.w / 2));
    const cy = Math.min(fit.y + fit.h, Math.max(fit.y, n.y + n.h / 2));
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  const zoomed = () => v.w < fit.w * 0.999;
  function set(n) {
    v = clamp(n);
    svg.setAttribute("viewBox", `${v.x.toFixed(3)} ${v.y.toFixed(3)} ${v.w.toFixed(3)} ${v.h.toFixed(3)}`);
    host.style.touchAction = zoomed() ? "none" : "pan-y";
    host.classList.toggle("zoomed", zoomed());
    onChange?.(v, zoomed());
  }
  function to(n, ms = 650) {
    cancelAnimationFrame(anim);
    const a = { ...v }, z = clamp(n);
    if (calm() || ms === 0) return set(z);
    const t0 = performance.now();
    const step = t => {
      const p = Math.min(1, (t - t0) / ms), e = p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      set({ x: a.x + (z.x - a.x) * e, y: a.y + (z.y - a.y) * e, w: a.w + (z.w - a.w) * e, h: a.h + (z.h - a.h) * e });
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  // A rectangle in drawing units, grown to the drawing's proportions and padded.
  function frame(r, pad = 0.18) {
    let w = r.w * (1 + pad * 2), h = r.h * (1 + pad * 2);
    if (h / w > aspect) w = h / aspect; else h = w * aspect;
    return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
  }
  const toSvg = (cx, cy) => {
    const m = svg.getScreenCTM();
    return m ? new DOMPoint(cx, cy).matrixTransform(m.inverse()) : { x: v.x + v.w / 2, y: v.y + v.h / 2 };
  };
  function zoomAt(f, cx, cy) {
    cancelAnimationFrame(anim);
    const r = svg.getBoundingClientRect();
    const p = cx == null ? { x: v.x + v.w / 2, y: v.y + v.h / 2 } : toSvg(cx, cy);
    const w = Math.min(fit.w, Math.max(fit.w * minScale, v.w / f)), k = w / v.w;
    set({ x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: w * aspect });
    return r;
  }

  const pts = new Map();
  let last = null;
  host.addEventListener("pointerdown", e => {
    if (e.button !== 0 || e.target.closest("button")) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!zoomed() && e.pointerType !== "mouse" && pts.size < 2) return;
    host.setPointerCapture(e.pointerId);
    host.classList.add("dragging");
    last = null;
  });
  host.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [p, q] = [...pts.values()];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (last) zoomAt(d / last, (p.x + q.x) / 2, (p.y + q.y) / 2);
      last = d;
      return;
    }
    if (!host.classList.contains("dragging") || !zoomed()) return;
    const m = svg.getScreenCTM();
    if (!m) return;
    cancelAnimationFrame(anim);
    set({ ...v, x: v.x - (e.clientX - prev.x) / m.a, y: v.y - (e.clientY - prev.y) / m.d });
  });
  const up = e => { pts.delete(e.pointerId); last = null; if (!pts.size) host.classList.remove("dragging"); };
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  host.addEventListener("wheel", e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
  }, { passive: false });
  host.addEventListener("dblclick", e => zoomAt(2, e.clientX, e.clientY));
  host.addEventListener("keydown", e => {
    const s = v.w * 0.12;
    const moves = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] };
    if (e.key === "+" || e.key === "=") zoomAt(1.5);
    else if (e.key === "-") zoomAt(1 / 1.5);
    else if (e.key === "0") to(fit);
    else if (moves[e.key] && zoomed()) set({ ...v, x: v.x + moves[e.key][0], y: v.y + moves[e.key][1] });
    else return;
    e.preventDefault();
  });
  set(fit);
  return { fit: () => to(fit), to, frame, zoomAt, get view() { return v; }, zoomed };
}

// Millimetres per screen pixel, so strokes that mark something keep a readable width at any zoom.
function trackScale(svg) {
  const update = () => {
    const m = svg.getScreenCTM();
    if (m && m.a) svg.style.setProperty("--k", (1 / m.a).toFixed(4));
  };
  new ResizeObserver(update).observe(svg);
  return update;
}

// ---------------------------------------------------------------- the board
const ABOUT = {
  U1: "The RP2040 at (342, 40)&nbsp;mm. It scans the 8 × 12 key matrix on GP0–GP19, reads both dials and the roller on GP20–GP25 and sends the light data on GP26, and switches the lights’ power on GP27 and GP28. Its 56 pins are 0.4&nbsp;mm apart.",
  U2: "A W25Q16JV, 2&nbsp;MB. The RP2040 has no flash of its own and runs QMK from this chip over a four-wire QSPI bus, so it sits right beside the controller.",
  Y1: "A 12&nbsp;MHz crystal with two 15&nbsp;pF capacitors. It clocks the controller and its USB, through a 1&nbsp;kΩ resistor that limits the drive.",
  U3: "An AP2112K turns the 5&nbsp;V from USB into 3.3&nbsp;V for the controller and the flash. The RP2040’s own regulator then makes its 1.1&nbsp;V core supply.",
  U4: "An SN74AHCT1G125. The lights expect 5&nbsp;V data and the controller speaks 3.3&nbsp;V, so this single gate lifts the signal and passes it, through a 330&nbsp;Ω resistor, to the first light.",
  J1: "Four pads for the harness from the USB-C carrier in the rear wall: power, D−, D+ and ground. D+ and D− each pass through a 27&nbsp;Ω resistor on 11.85 and 11.56&nbsp;mm of copper, with no vias.",
  J2: "Three pads for the roller’s encoder: A, common ground and B, read on GP24 and GP25.",
  "SW93 SW94": "BOOTSEL and RUN. Hold BOOTSEL and press RUN, and the board appears on the computer as a drive named RPI-RP2 that takes a new firmware file.",
  U5: "A TPS22919 load switch. GP27 turns on the 5&nbsp;V rail for the 90 lights only once the computer has set up the USB connection, and turns it off again during sleep, so the board stays under its 500&nbsp;mA budget.",
  "ENC1 ENC2": "Bourns PEC11R encoders in the top corners, 24 clicks a turn: volume on the left, brightness on the right. Pressing a dial closes an ordinary contact in the key matrix.",
  LED: "90 SK6812MINI-E lights, one under every key, mounted upside down on the bottom layer so they shine up through windows in the board. The data starts at Esc and snakes along each row in turn, ending at Files.",
};
const FLOWS_ABOUT = "The moving marks follow the signals. USB data comes in at the harness pads and runs through two resistors to the controller. The light data leaves the controller, is lifted to 5&nbsp;V and passes from light to light, 90 in all, Esc first and Files last.";

async function board() {
  const view = root.querySelector(".pcb-view");
  const canvas = view.querySelector(".pcb-canvas");
  const about = root.querySelector(".pcb-about");
  const fitBtn = view.querySelector(".pcb-fit");
  let text, data;
  try {
    [text, data] = await Promise.all([
      fetch("assets/omar-mainboard.svg").then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
      fetch("assets/omar-mainboard.json").then(r => r.json()),
    ]);
  } catch {
    canvas.querySelector(".pcb-loading").textContent = "The board drawing could not be loaded. The schematic PDF below shows the same design.";
    return;
  }
  canvas.innerHTML = text;
  const svg = canvas.querySelector("svg");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("aria-label", "Rev B.1 main board copper, both layers, with the controller in the roller bay at the right");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const parts = Object.fromEntries(data.parts.map(p => [p.ref, p]));
  const home = parts.U1;

  // The copper spreads out from the controller the first time the board is seen.
  const tracks = [...svg.querySelectorAll(".trk")];
  let far = 1;
  const dist = tracks.map(t => {
    const m = /M\s*(-?[\d.]+)[ ,](-?[\d.]+)/.exec(t.getAttribute("d"));
    const d = m ? Math.hypot(+m[1] - home.x, +m[2] - home.y) : 0;
    far = Math.max(far, d);
    return d;
  });
  tracks.forEach((t, i) => {
    t.setAttribute("pathLength", "1");
    t.style.setProperty("--d", `${Math.round((dist[i] / far) * 1500)}ms`);
    // The real width, which the stylesheet keeps at least a pixel wide on screen.
    t.style.setProperty("--w", t.getAttribute("stroke-width") || ".2");
  });

  // Each signal gets a faint route and a train of marks travelling in its direction.
  for (const f of [...svg.querySelectorAll(".pcb-flow .flow")]) {
    const pulse = f.cloneNode();
    f.classList.add("flow-route");
    pulse.classList.add("flow-pulse");
    pulse.style.setProperty("--o", f.dataset.order ?? 0);
    f.after(pulse);
  }

  const rescale = trackScale(svg);
  const pz = panZoom(svg, canvas, {
    onChange: (v, zoomed) => { rescale(); fitBtn.disabled = !zoomed; },
  });

  if (calm() || !("IntersectionObserver" in window)) canvas.classList.add("drawn", "settled");
  else {
    new IntersectionObserver((entries, io) => {
      if (!entries.some(e => e.isIntersecting)) return;
      canvas.classList.add("drawn");
      io.disconnect();
      // After the reveal, layer and signal changes answer at once.
      setTimeout(() => canvas.classList.add("settled"), 3000);
      // A few stars over the controller once the copper has reached it.
      setTimeout(() => {
        const r = svg.querySelector('.part[data-ref="U1"]');
        [0, 160, 320].forEach((d, i) => twinkle(r, { color: ["#ff9e64", "#7dcfff", "#9ece6a"][i], delay: d, px: 2 }));
      }, 500);
    }, { threshold: 0.35 }).observe(canvas);
  }
  // The marks only move while the board is on screen.
  new IntersectionObserver(entries => {
    for (const e of entries) view.classList.toggle("live", e.isIntersecting);
  }).observe(canvas);

  // Copper layers.
  view.querySelector(".seg").addEventListener("click", e => {
    const b = e.target.closest("button[data-side]");
    if (!b) return;
    view.dataset.side = b.dataset.side;
    for (const x of view.querySelectorAll("button[data-side]")) x.setAttribute("aria-pressed", String(x === b));
  });
  // Signals.
  const flows = () => {
    for (const box of view.querySelectorAll("[data-flow]")) view.classList.toggle(`show-${box.dataset.flow}`, box.checked);
    view.classList.toggle("tracing", !!view.querySelector("[data-flow]:checked"));
  };
  view.querySelector(".pcb-flows").addEventListener("change", flows);
  flows();

  // Parts.
  const buttons = [...root.querySelectorAll(".pcb-picks button")];
  const idle = () => { about.innerHTML = FLOWS_ABOUT; };
  idle();
  function choose(btn) {
    const on = btn && btn.getAttribute("aria-pressed") !== "true";
    if (!on) {
      for (const b of buttons) b.setAttribute("aria-pressed", "false");
      for (const el of svg.querySelectorAll(".part.sel")) el.classList.remove("sel");
      pz.fit(); idle(); return;
    }
    show(btn.dataset.ref, ABOUT[btn.dataset.ref] ?? ABOUT[btn.dataset.ref.split(" ")[0]] ?? ABOUT.LED, btn);
  }
  // Zooms to a set of parts and outlines them. The parts list below the board uses this too.
  function show(refList, html, btn = null) {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b === btn));
    for (const el of svg.querySelectorAll(".part.sel")) el.classList.remove("sel");
    const refs = refList.split(" ");
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const ref of refs) {
      const p = parts[ref];
      if (!p) continue;
      x0 = Math.min(x0, p.bbox[0]); y0 = Math.min(y0, p.bbox[1]);
      x1 = Math.max(x1, p.bbox[2]); y1 = Math.max(y1, p.bbox[3]);
      svg.querySelector(`.part[data-ref="${ref}"]`)?.classList.add("sel");
    }
    // Small parts are shown with their neighbours, so the reader can see where they are.
    const minW = 34, w = Math.max(minW, x1 - x0), h = Math.max(minW * 0.3, y1 - y0);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    pz.to(pz.frame({ x: cx - w / 2, y: cy - h / 2, w, h }, refs.length > 2 ? 0.04 : 0.25));
    about.innerHTML = html;
  }
  root.querySelector(".pcb-picks").addEventListener("click", e => choose(e.target.closest("button")));
  fitBtn.addEventListener("click", () => {
    const sel = buttons.find(b => b.getAttribute("aria-pressed") === "true");
    if (sel) choose(sel); else { for (const el of svg.querySelectorAll(".part.sel")) el.classList.remove("sel"); pz.fit(); idle(); }
  });
  return {
    // From the parts list: the matching part button if there is one, otherwise the row's own text.
    show(refList, html) {
      const btn = buttons.find(b => b.dataset.ref === refList);
      show(refList, btn ? (ABOUT[refList] ?? ABOUT[refList.split(" ")[0]] ?? ABOUT.LED) : html, btn);
    },
  };
}

// ---------------------------------------------------------------- the controller's pins
const GROUPS = [
  { key: "row", name: "Key rows", about: "GP0–GP7 connect to the eight rows of the key matrix." },
  { key: "col", name: "Key columns", about: "GP8–GP19 connect to the twelve columns. QMK drives each column in turn and reads the rows, with 5&nbsp;ms debounce." },
  { key: "enc", name: "Dials and roller", about: "GP20–GP25 read the volume dial, the brightness dial and the roller, two quadrature wires each." },
  { key: "light", name: "Lights", about: "GP26 sends the data for the 90 lights through the 5&nbsp;V buffer. GP27 switches the lights’ 5&nbsp;V supply on, and GP28 enables the buffer once that supply has settled." },
  { key: "usb", name: "USB", about: "D− and D+, each through a 27&nbsp;Ω resistor to the harness pads." },
  { key: "flash", name: "Flash", about: "Six QSPI pins to the 2&nbsp;MB flash chip that holds the firmware." },
  { key: "sys", name: "Clock and debug", about: "The crystal, the RUN reset line, the two debug pads and the test pin, which is tied to ground." },
  { key: "power", name: "Power", about: "3.3&nbsp;V supply pins, the internal regulator’s input and its 1.1&nbsp;V output, which feeds the core. The large pad underneath is ground." },
  { key: "spare", name: "Spare", about: "GP29 is left unconnected." },
];
function groupOf(pin) {
  const g = /^GPIO(\d+)/.exec(pin.name);
  if (g) {
    const n = +g[1];
    return n < 8 ? "row" : n < 20 ? "col" : n < 26 ? "enc" : n <= 28 ? "light" : "spare";
  }
  if (/^USB_D[MP]$/.test(pin.name)) return "usb";
  if (/^QSPI/.test(pin.name)) return "flash";
  if (/^(XIN|XOUT|RUN|SWCLK|SWD|TESTEN)$/.test(pin.name)) return "sys";
  return "power";
}

async function pins() {
  const box = root.querySelector(".mcu-chip");
  const readout = root.querySelector(".mcu-readout");
  const legend = root.querySelector(".mcu-groups");
  for (const gr of GROUPS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.group = gr.key;
    b.className = `g-${gr.key}`;
    b.setAttribute("aria-pressed", "false");
    b.textContent = gr.name;
    legend.append(b);
  }
  let list;
  try { list = await fetch("assets/schematic/mcu-pins.json").then(r => r.json()); } catch { return; }
  const byNum = new Map(list.map(p => [+p.number, p]));

  // QFN-56 seen from above: pins 1–14 down the left, 15–28 along the bottom, 29–42 up the right
  // and 43–56 back along the top. The labels are the nets each pin is wired to.
  const S = 360, c0 = 95, c1 = 265, side = c1 - c0, pitch = side / 15, len = 9;
  const svg = SVG("svg", { viewBox: `0 0 ${S} ${S}`, class: "mcu-svg", role: "img", "aria-label": "RP2040 pin map: every pin labelled with the net it connects to" });
  svg.append(SVG("rect", { class: "mcu-body", x: c0, y: c0, width: side, height: side, rx: 6 }));
  svg.append(SVG("rect", { class: "mcu-pad", x: S / 2 - 34, y: S / 2 - 34, width: 68, height: 68, rx: 3 }));
  svg.append(SVG("circle", { class: "mcu-dot", cx: c0 + 12, cy: c0 + 12, r: 4 }));
  const name = SVG("text", { class: "mcu-name", x: S / 2, y: S / 2 - 6, "text-anchor": "middle" });
  name.textContent = "RP2040";
  const sub = SVG("text", { class: "mcu-sub", x: S / 2, y: S / 2 + 12, "text-anchor": "middle" });
  sub.textContent = "pad 57: GND";
  svg.append(name, sub);

  const pinEls = [];
  for (let n = 1; n <= 56; n++) {
    const p = byNum.get(n);
    if (!p) continue;
    const s = Math.floor((n - 1) / 14), i = (n - 1) % 14, t = c0 + pitch * (i + 1);
    // Position along each edge, and the outward direction.
    const [x, y, dx, dy] = [
      [c0, t, -1, 0],
      [t, c1, 0, 1],
      [c1, c1 - pitch * (i + 1), 1, 0],
      [c1 - pitch * (i + 1), c0, 0, -1],
    ][s];
    const grp = groupOf(p);
    const g = SVG("g", { class: `mcu-pin g-${grp}`, "data-n": n });
    const w = dx ? len : pitch * 0.56, h = dy ? len : pitch * 0.56;
    g.append(SVG("rect", {
      class: "mcu-lead",
      x: dx < 0 ? x - len : dx > 0 ? x : x - w / 2,
      y: dy < 0 ? y - len : dy > 0 ? y : y - h / 2,
      width: w, height: h, rx: 1,
    }));
    const lx = x + dx * (len + 4), ly = y + dy * (len + 4);
    const label = SVG("text", {
      class: "mcu-net", x: lx, y: ly, "dominant-baseline": "central",
      "text-anchor": dx < 0 || dy > 0 ? "end" : "start",
      transform: dy ? `rotate(-90 ${lx} ${ly})` : "",
    });
    label.textContent = p.net && p.net !== "NC" ? p.net : "free";
    const num = SVG("text", {
      class: "mcu-num", x: x - dx * 8, y: y - dy * 8, "dominant-baseline": "central", "text-anchor": "middle",
    });
    num.textContent = n;
    const title = SVG("title");
    title.textContent = `Pin ${n}, ${p.name}: ${p.net && p.net !== "NC" ? p.net : "not connected"}`;
    g.append(label, num, title);
    svg.append(g);
    pinEls.push([g, p, grp]);
  }
  box.append(svg);
  // The same map as text, for screen readers and for the question panel.
  const dl = document.createElement("dl");
  dl.className = "mcu-list visually-hidden";
  for (const gr of GROUPS) {
    const mine = pinEls.filter(x => x[2] === gr.key).map(([, p]) => `pin ${p.number} ${p.name}${p.net && p.net !== "NC" ? ` to ${p.net}` : ""}`);
    if (!mine.length) continue;
    const d = document.createElement("div");
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = `Controller pins, ${gr.name.toLowerCase()}`;
    dd.innerHTML = `${gr.about} ${mine.join(", ")}.`;
    d.append(dt, dd);
    dl.append(d);
  }
  box.after(dl);

  const describe = (p, grp) => {
    const gr = GROUPS.find(x => x.key === grp);
    const net = p.net && p.net !== "NC" ? `<b>${p.net}</b>` : "nothing";
    return `Pin ${p.number}, <b>${p.name}</b>, goes to ${net}. ${gr.about}`;
  };
  let active = null;
  const show = key => {
    active = key;
    svg.classList.toggle("focus", !!key);
    for (const [g, , grp] of pinEls) g.classList.toggle("on", grp === key);
    for (const b of legend.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.group === key));
    const gr = GROUPS.find(x => x.key === key);
    readout.innerHTML = gr ? `<b>${gr.name}.</b> ${gr.about}` : "Point at a pin, or choose a group, to see where it goes.";
  };
  legend.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) show(active === b.dataset.group ? null : b.dataset.group);
  });
  svg.addEventListener("pointerover", e => {
    const g = e.target.closest(".mcu-pin");
    if (!g) return;
    const [, p, grp] = pinEls.find(x => x[0] === g);
    readout.innerHTML = describe(p, grp);
    for (const [x] of pinEls) x.classList.toggle("hover", x === g);
  });
  svg.addEventListener("pointerleave", () => { for (const [x] of pinEls) x.classList.remove("hover"); show(active); });
  show(null);
}

// ---------------------------------------------------------------- schematic sheets
const SHEETS = [
  { file: "controller.svg", focus: "U1", tab: "Controller", about: "The RP2040 with its flash chip, crystal, BOOTSEL and RUN buttons, the 27&nbsp;Ω USB resistors and the roller pads. The labels down the controller’s left side are the matrix rows and columns, the encoders and the light data." },
  { file: "power.svg", focus: "U3", tab: "Power", about: "The four harness pads from the USB-C carrier, the 3.3&nbsp;V regulator, and the bypass capacitors spread along the supply rails." },
  { file: "indicators.svg", focus: "U4", tab: "Light power", about: "The load switch that gives the lights their own 5&nbsp;V rail, and the buffer that lifts the light data to 5&nbsp;V. A pull-down keeps the first light’s input low while the buffer is off." },
  { file: "matrix-1.svg", focus: "first", tab: "Rows 0–1", about: "Matrix rows 0 and 1. Every key has a socket and a diode, cathode toward the row, so any combination of pressed keys can be read." },
  { file: "matrix-2.svg", focus: "first", tab: "Rows 2–3", about: "Matrix rows 2 and 3." },
  { file: "matrix-3.svg", focus: "first", tab: "Rows 4–5", about: "Matrix rows 4 and 5." },
  { file: "matrix-4.svg", focus: "first", tab: "Rows 6–7", about: "Matrix rows 6 and 7, including the two dial presses." },
  { file: "lights-1.svg", focus: "first", tab: "Lights 1–15", about: "The first 15 of the 90 lights, Esc along the top row. Each light has its own 100&nbsp;nF capacitor and passes the data on to the next." },
  { file: "lights-2.svg", focus: "first", tab: "Lights 16–30", about: "Lights 16 to 30." },
  { file: "lights-3.svg", focus: "first", tab: "Lights 31–45", about: "Lights 31 to 45." },
  { file: "lights-4.svg", focus: "first", tab: "Lights 46–60", about: "Lights 46 to 60." },
  { file: "lights-5.svg", focus: "first", tab: "Lights 61–75", about: "Lights 61 to 75." },
  { file: "lights-6.svg", focus: "first", tab: "Lights 76–90", about: "Lights 76 to 90, ending at Files and the test pad after it." },
];

function schematics() {
  const tabs = root.querySelector(".sch-tabs");
  const canvas = root.querySelector(".sch-canvas");
  const caption = root.querySelector(".sch-caption");
  const cache = new Map();
  let pz = null, current = null;

  SHEETS.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.id = `sch-tab-${i}`;
    b.setAttribute("aria-selected", "false");
    b.tabIndex = -1;
    b.textContent = s.tab;
    b.dataset.i = i;
    tabs.append(b);
  });
  async function open(i) {
    const s = SHEETS[i];
    current = i;
    for (const b of tabs.children) {
      const on = +b.dataset.i === i;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    canvas.setAttribute("aria-labelledby", `sch-tab-${i}`);
    caption.innerHTML = s.about;
    if (!cache.has(s.file)) cache.set(s.file, fetch(`assets/schematic/${s.file}`).then(r => { if (!r.ok) throw 0; return r.text(); }));
    let text;
    try { text = await cache.get(s.file); } catch { canvas.textContent = "This sheet could not be loaded. The schematic PDF has all eight sheets."; return; }
    if (current !== i) return;
    canvas.innerHTML = text;
    const svg = canvas.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    // The sheet's own title repeats the tab; trim it from the drawing and its frame.
    const head = svg.querySelector(".sch-heading");
    if (head) {
      const hb = head.getBBox(), vb = svg.viewBox.baseVal;
      head.remove();
      const top = hb.y + hb.height + 2;
      if (top > vb.y && top < vb.y + vb.height * 0.3) {
        const items = [...svg.children].filter(x => x.tagName !== "title");
        const minY = Math.min(...items.map(x => { try { return x.getBBox().y; } catch { return Infinity; } }));
        if (Number.isFinite(minY) && minY > vb.y) svg.setAttribute("viewBox", `${vb.x} ${minY - 4} ${vb.width} ${vb.y + vb.height - (minY - 4)}`);
      }
    }
    pz = panZoom(svg, canvas, { minScale: 1 / 12 });
    // The whole sheet is too small to read, so it opens on its main part at a readable size.
    const sym = s.focus === "first" ? svg.querySelector(".sch-symbol") : svg.querySelector(`.sch-symbol[data-ref="${s.focus}"]`);
    if (sym) {
      const r = sym.getBBox(), px = canvas.clientWidth || 600;
      const w = Math.max(r.width + 30, px / 7), h = w * (pz.view.h / pz.view.w);
      pz.to({ x: r.x + r.width / 2 - w / 2, y: Math.max(r.y - 12, r.y + r.height / 2 - h / 2) - 4, w, h }, 0);
    }
  }
  tabs.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) open(+b.dataset.i);
  });
  tabs.addEventListener("keydown", e => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    const i = (current + d + SHEETS.length) % SHEETS.length;
    open(i);
    tabs.children[i].focus();
    e.preventDefault();
  });
  root.querySelector(".sch-zoom").addEventListener("click", e => {
    const z = e.target.closest("button")?.dataset.zoom;
    if (!pz || !z) return;
    if (z === "fit") pz.fit(); else pz.zoomAt(z === "in" ? 1.6 : 1 / 1.6);
  });
  // The first sheet loads when the section comes near.
  const start = () => open(0);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries, io) => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: "600px 0px" }).observe(canvas);
  } else start();
}

// ---------------------------------------------------------------- the backlight
// The Rev B.1 key field lit the way rgb_matrix_indicators_user() in the rev_b keymap lights it:
// white at the current level everywhere, with the status colors scaled to the same level.
const LEVEL_STEP = 4, LEVEL_MAX = 16, LEVEL_START = 8;
const WHITE = "#ffffff";
const STATES = {
  desk: { color: "#00e1ff", keys: ["Desk 3"], say: "Desk 3, the active desk, is cyan" },
  move: { color: "#ff6400", keys: ["Desk 1", "Desk 2", "Desk 3", "Desk 4", "Desk 5", "Move & Go"], say: "Move & Go and the five desks are amber while the move waits for a desk" },
  caps: { color: "#3cff3c", keys: ["Caps"], say: "Caps is green" },
  mic: { color: "#ff2020", keys: ["Mic Mute"], say: "Mic Mute is red" },
  focus: { color: "#2f6bff", keys: ["Focus", "↑", "←", "↓", "→"], say: "Focus and the arrows are blue" },
};
// Estimated whole-board draw at white, from sheet 07B of the assembly specification.
const boardMa = level => Math.round(100 + 90 * (1 + 36 * level / 255));
const mix = (a, b, t) => {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};

async function backlight() {
  const host = root.querySelector(".lights-board");
  if (!host) return;
  const section = host.closest(".lights");
  let data;
  try { data = await fetch("assets/omar-keys.json").then(r => r.json()); } catch { return; }
  const keys = data.keys.map(([label, cx, cy, w, group]) => ({ label, cx, cy, w, group }));
  const H = 19.05, gap = 0.9;
  const x0 = Math.min(...keys.map(k => k.cx - k.w / 2)) - 5, x1 = Math.max(...keys.map(k => k.cx + k.w / 2)) + 5;
  const y0 = Math.min(...keys.map(k => k.cy - H / 2)) - 5, y1 = Math.max(...keys.map(k => k.cy + H / 2)) + 5;
  const svg = SVG("svg", { viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, class: "lk", role: "img" });
  // One soft spot gradient per light color, so a cap glows brightest over its LED and fades out.
  const colors = [WHITE, ...Object.values(STATES).map(st => st.color)];
  const spotId = c => `lk-spot-${c.slice(1)}`;
  svg.innerHTML = `<defs><filter id="lk-blur" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>${
    colors.map(c => `<radialGradient id="${spotId(c)}"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join("")}</defs>`;
  svg.append(SVG("rect", { class: "lk-case", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 4 }));
  const glowLayer = SVG("g", { class: "lk-glow", filter: "url(#lk-blur)" });
  const capLayer = SVG("g", { class: "lk-caps" });
  svg.append(glowLayer, capLayer);
  const lit = [];
  for (const k of keys) {
    const x = k.cx - k.w / 2 + gap, y = k.cy - H / 2 + gap, w = k.w - 2 * gap, h = H - 2 * gap;
    if (k.group === "dial") {
      // The dials carry no light of their own.
      capLayer.append(SVG("circle", { class: "lk-dial", cx: k.cx, cy: k.cy, r: 8 }));
      continue;
    }
    const glow = SVG("rect", { x: x - 0.6, y: y - 0.6, width: w + 1.2, height: h + 1.2, rx: 2.4 });
    glowLayer.append(glow);
    const g = SVG("g", { class: "lk-key" });
    g.append(SVG("rect", { class: "lk-cap", x, y, width: w, height: h, rx: 1.8 }));
    // The LED sits 5.08 mm behind the switch center, so the cap glows most toward its top edge.
    const spot = SVG("ellipse", { class: "lk-spot", cx: k.cx, cy: k.cy - 5.08, rx: Math.min(w / 2 - 0.5, 9), ry: 4.5 });
    // Long legends go on two lines, split at the space nearest the middle.
    let words = [k.label];
    if (k.label.length > 7 && k.label.includes(" ")) {
      const mid = k.label.length / 2;
      const cut = [...k.label.matchAll(/ /g)].map(m => m.index).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
      words = [k.label.slice(0, cut), k.label.slice(cut + 1)];
    }
    const size = k.label.length <= 2 ? 4.2 : words.length > 1 || k.label.length > 6 ? 2.5 : 3;
    const t = SVG("text", { class: "lk-legend", x: k.cx, y: k.cy + (words.length > 1 ? -0.6 : size * 0.36), "font-size": size });
    words.forEach((wd, i) => {
      const s = SVG("tspan", { x: k.cx, dy: i ? size * 1.15 : 0 });
      s.textContent = wd;
      t.append(s);
    });
    g.append(spot, t);
    capLayer.append(g);
    lit.push({ label: k.label, glow, spot, legend: t, node: g });
  }
  // The roller, ribbed and unlit.
  const [rx, ry, rw, rh] = data.roller;
  const roller = SVG("g", { class: "lk-roller" });
  roller.append(SVG("rect", { x: rx + 3, y: ry + 6, width: rw - 6, height: rh - 12, rx: 3 }));
  for (let i = 1; i < 18; i++) {
    const xx = rx + 3 + (rw - 6) * i / 18;
    roller.append(SVG("line", { x1: xx, x2: xx, y1: ry + 8, y2: ry + rh - 8 }));
  }
  capLayer.append(roller);
  host.append(svg);

  let level = LEVEL_START, on = true;
  const active = new Set(["desk"]);
  const readout = section.querySelector(".lights-readout");
  const btn = sel => section.querySelector(sel);
  const render = changed => {
    const t = on ? Math.sqrt(level / LEVEL_MAX) : 0;
    const colorOf = new Map();
    // Same order as the firmware: a waiting move replaces the active-desk color.
    for (const name of ["caps", active.has("move") ? "move" : "desk", "mic", "focus"]) {
      if (!active.has(name)) continue;
      for (const l of STATES[name].keys) colorOf.set(l, STATES[name].color);
    }
    for (const k of lit) {
      const c = colorOf.get(k.label) ?? WHITE;
      k.glow.setAttribute("fill", c);
      k.glow.style.opacity = (t * (c === WHITE ? 0.5 : 0.95)).toFixed(3);
      k.spot.setAttribute("fill", `url(#${spotId(c)})`);
      k.spot.style.opacity = (t * 0.28).toFixed(3);
      // Shine-through legends are the brightest part of a lit cap.
      k.legend.style.fill = t ? mix("#4a4f6a", c, Math.min(1, 0.4 + t * 0.75)) : "#4a4f6a";
      if (changed?.has(k.label) && t) twinkle(k.node, { color: c, px: 3 });
    }
    btn('[data-level="down"]').disabled = !on || level <= 0;
    btn('[data-level="up"]').disabled = !on || level >= LEVEL_MAX;
    const tg = btn('[data-level="toggle"]');
    tg.setAttribute("aria-pressed", String(on));
    tg.firstChild.textContent = on ? "Lights on " : "Lights off ";
    for (const b of section.querySelectorAll("[data-state]")) b.setAttribute("aria-pressed", String(active.has(b.dataset.state)));
    let text;
    if (!on) text = `The lights are off and the firmware has opened their power switch, so they draw nothing. The level stays at ${level} for when they come back on.`;
    else if (!level) text = "Level 0 of 255. With nothing to show, the firmware opens the lights’ power switch.";
    else {
      const shown = ["caps", active.has("move") ? "move" : "desk", "mic", "focus"].filter(n => active.has(n)).map(n => STATES[n].say);
      text = `Level ${level} of 255${level === LEVEL_START ? ", where the board starts" : level === LEVEL_MAX ? ", the firmware’s ceiling" : ""}. With every key white the whole board would draw about ${boardMa(level)} mA, inside the 450 mA target.`
        + (shown.length ? ` ${shown.join("; ").replace(/^./, c => c.toUpperCase())}.` : " Every key is white.");
    }
    readout.textContent = text;
    svg.setAttribute("aria-label", `The Rev B.1 key field, ${on && level ? `lit white at level ${level}` : "unlit"}.`);
  };
  section.querySelector(".lights-level").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.level === "toggle") on = !on;
    else level = Math.max(0, Math.min(LEVEL_MAX, level + (b.dataset.level === "up" ? LEVEL_STEP : -LEVEL_STEP)));
    render();
  });
  section.querySelector(".lights-states").addEventListener("click", e => {
    const b = e.target.closest("[data-state]");
    if (!b) return;
    const name = b.dataset.state;
    const turningOn = !active.has(name);
    turningOn ? active.add(name) : active.delete(name);
    render(turningOn ? new Set(STATES[name].keys) : null);
  });
  render();
}

// ---------------------------------------------------------------- start
// The board drawing is about 2.4 MB, so it loads when the section is near, and never competes
// with the 3D models at the top of the page. The pin list is small and shapes the layout, so it
// loads at once.
if (root) {
  let loading = null;
  const start = () => (loading ??= board());
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries, io) => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: "1500px 0px" }).observe(root);
  } else start();
  // A link straight to this section starts at once.
  if (/^#(circuit|lights|parts|roadmap)$/.test(location.hash)) start();
  pins();
  schematics();
  backlight();

  // "Show" in the parts list zooms the board above to those parts.
  root.querySelector(".bom")?.addEventListener("click", async e => {
    const b = e.target.closest(".bom-show");
    if (!b) return;
    const api = await start();
    if (!api) return;
    const row = b.closest("tr");
    const name = row.querySelector("th").textContent.trim();
    const what = row.cells[row.cells.length - 2].innerHTML;
    api.show(b.dataset.show, `<b>${name}.</b> ${what}`);
    const view = root.querySelector(".pcb-view");
    view.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "center" });
    view.querySelector(".pcb-canvas").focus({ preventScroll: true });
  });
}
