// The Contents drawer. Each link scrolls to where its section's first view is fully posed, not to
// the heading itself, because the board only settles once the reading line is inside a step.
import { pixelIcon, revealIcons } from "./fx.js";

const toggle = document.querySelector(".toc-toggle");
const toc = document.querySelector("#toc");
const backdrop = document.querySelector(".toc-backdrop");
const links = [...toc.querySelectorAll("a")];
const narrow = matchMedia("(max-width: 999px)");
const still = matchMedia("(prefers-reduced-motion: reduce)");

// A pixel icon for each section, in the menu and, assembling as it scrolls in, beside its heading.
links.forEach((a, n) => {
  const name = a.dataset.target === "hero" ? "hero" : a.hash.slice(1);
  a.insertAdjacentHTML("afterbegin", pixelIcon(name));
  a.parentElement.style.setProperty("--n", n);
  const h = name !== "hero" && document.getElementById(name);
  if (h) h.insertAdjacentHTML("afterbegin", pixelIcon(name, "reveal h-icon"));
});
revealIcons();

function anchor(a) {
  if (a.dataset.target === "hero") return null;
  const h = document.getElementById(a.hash.slice(1));
  const el = h?.closest(".cfg, .play-hold, [data-view]") ?? h;
  // The configurator opens on its workspace, which is sized to fill the window.
  return el?.matches(".cfg") ? el.querySelector(".cfg-work") : el;
}
// The scroll position that shows a section the way the story intends.
function targetY(a) {
  const el = anchor(a);
  if (!el) return 0;
  const top = el.getBoundingClientRect().top + scrollY;
  if (el.matches(".cfg-work")) return top;
  // The circuit board and roadmap sit on an opaque band; their headings go near the top.
  if (el.closest(".circuit")) return top - (narrow.matches ? 76 : 96);
  if (el.matches(".play-hold")) return top + innerHeight * 0.35;
  return top - innerHeight * (narrow.matches ? 0.48 : 0.14);
}

function open() {
  toc.hidden = backdrop.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  document.documentElement.classList.add("toc-open");
  spy();
  (toc.querySelector('[aria-current="true"]') ?? links[0]).focus({ preventScroll: true });
}
function close(refocus = true) {
  if (toc.hidden) return;
  toc.hidden = backdrop.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  document.documentElement.classList.remove("toc-open");
  if (refocus) toggle.focus({ preventScroll: true });
}
toggle.addEventListener("click", () => (toc.hidden ? open() : close()));
backdrop.addEventListener("click", () => close());
addEventListener("keydown", e => { if (e.key === "Escape" && !toc.hidden) close(); });
toc.addEventListener("focusout", e => {
  if (e.relatedTarget && !toc.contains(e.relatedTarget) && e.relatedTarget !== toggle) close(false);
});

function jump(a, smooth) {
  scrollTo({ top: Math.max(0, Math.round(targetY(a))), behavior: smooth && !still.matches ? "smooth" : "auto" });
  history.replaceState(null, "", a.hash || "#top");
}
toc.addEventListener("click", e => {
  const a = e.target.closest("a");
  if (!a) return;
  e.preventDefault();
  close(false);
  jump(a, true);
  // Keep keyboard focus with the section that was chosen.
  let h = a.dataset.target === "hero" ? document.querySelector(".hero h1") : document.getElementById(a.hash.slice(1));
  // Some headings are hidden on phones; their section takes focus instead.
  if (h && !h.getClientRects().length) h = h.closest("section");
  if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
});

// The section being read is the last one whose target has been reached.
function spy() {
  const y = scrollY + innerHeight * 0.2;
  let current = links[0];
  for (const a of links) if (targetY(a) <= y) current = a;
  for (const a of links) {
    if (a === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
  }
}
let queued = false;
addEventListener("scroll", () => {
  if (queued || toc.hidden) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; spy(); });
}, { passive: true });

// A link to a section from elsewhere lands on the same position as the menu would.
if (location.hash && location.hash !== "#top") {
  const a = links.find(x => x.hash === location.hash);
  if (a) addEventListener("load", () => requestAnimationFrame(() => jump(a, false)), { once: true });
}
