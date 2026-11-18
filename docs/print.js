// The print model section. The high-detail model is 10.8 MB, so the section shows a still
// picture of it and fetches the model only when the reader presses the button. Plain wheel
// scrolling keeps moving the page; Ctrl and the wheel zoom, as on the circuit board.
const section = document.querySelector(".print");
if (section) {
  const stage = section.querySelector(".print-stage");
  const gate = section.querySelector(".print-gate");
  const load = section.querySelector(".print-load");
  const cost = section.querySelector(".print-cost");
  const bar = section.querySelector(".print-bar");
  const tools = section.querySelector(".print-tools");
  const cams = [...section.querySelectorAll("[data-cam]")];
  const MODEL = "assets/omar-print-model.glb";
  const DECODER = "vendor/meshopt_decoder.js";
  // Model coordinates are metres, centered on the case, with the typist toward +z.
  // The whole-board distances suit the wide frame; the taller phone frame needs to stand back.
  const far = () => (stage.clientWidth / stage.clientHeight < 1.6 ? 1.6 : 1);
  const VIEWS = {
    whole:   () => ({ orbit: `-16deg 56deg ${0.64 * far()}m`, target: "auto auto auto" }),
    top:     () => ({ orbit: `0deg 0deg ${0.6 * far()}m`,     target: "auto auto auto" }),
    legends: () => ({ orbit: "-8deg 38deg 0.16m",             target: "-0.13m 0.035m -0.02m" }),
    roller:  () => ({ orbit: "-24deg 50deg 0.21m",            target: "0.165m 0.032m -0.03m" }),
    front:   () => ({ orbit: `0deg 80deg ${0.78 * far()}m`,   target: "auto 0.02m auto" }),
  };
  let mv = null;
  // Where the camera is heading, so repeated zoom presses step from the goal, not mid-flight.
  let goal = null;

  function show(name) {
    if (!mv) return;
    const v = VIEWS[name]();
    mv.cameraTarget = v.target;
    mv.cameraOrbit = v.orbit;
    goal = null;
    cams.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cam === name)));
  }
  function zoom(f) {
    if (!mv) return;
    const o = goal ?? mv.getCameraOrbit();
    goal = { theta: o.theta, phi: o.phi, radius: Math.min(1.2, Math.max(0.04, o.radius * f)) };
    mv.cameraOrbit = `${goal.theta}rad ${goal.phi}rad ${goal.radius}m`;
  }
  function failed() {
    load.disabled = false;
    load.textContent = "Try loading again";
    cost.textContent = "The model didn’t load. Check your connection, then try again.";
    bar.hidden = true;
    mv?.remove();
    mv = null;
  }

  load.addEventListener("click", async () => {
    load.disabled = true;
    load.textContent = "Loading the print model";
    bar.hidden = false;
    bar.style.setProperty("--p", 0);
    await customElements.whenDefined("model-viewer");
    // The model is compressed with meshopt; model-viewer needs the decoder's location before loading.
    const MV = customElements.get("model-viewer");
    if (!MV.meshoptDecoderLocation) MV.meshoptDecoderLocation = new URL(DECODER, document.baseURI).href;
    mv = document.createElement("model-viewer");
    const attrs = {
      alt: "The high-detail print model of Omar-Keyboard, with every keycap legend modeled as raised geometry",
      "camera-controls": "", "touch-action": "pan-y", "interaction-prompt": "none",
      "camera-orbit": VIEWS.whole().orbit, "field-of-view": "22deg",
      "min-camera-orbit": "auto 0deg 0.04m", "max-camera-orbit": "auto 100deg 1.2m",
      "shadow-intensity": "0.6", "shadow-softness": "0.9", exposure: "1", "interpolation-decay": "90",
    };
    for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
    mv.addEventListener("progress", e => bar.style.setProperty("--p", e.detail.totalProgress));
    mv.addEventListener("load", () => {
      stage.classList.add("loaded");
      gate.hidden = true;
      tools.hidden = false;
      section.querySelector('[data-cam="whole"]').setAttribute("aria-pressed", "true");
    }, { once: true });
    mv.addEventListener("error", failed, { once: true });
    mv.addEventListener("camera-change", e => {
      if (e.detail.source !== "user-interaction") return;
      goal = null;
      cams.forEach(b => b.setAttribute("aria-pressed", "false"));
    });
    mv.src = MODEL;
    stage.prepend(mv);
  });

  // Let a plain wheel scroll the page past the viewer; Ctrl and the wheel zoom.
  stage.addEventListener("wheel", e => { if (!e.ctrlKey) e.stopPropagation(); }, { capture: true });
  cams.forEach(b => b.addEventListener("click", () => show(b.dataset.cam)));
  section.querySelectorAll("[data-zoom]").forEach(b =>
    b.addEventListener("click", () => zoom(b.dataset.zoom === "in" ? 0.75 : 1 / 0.75)));
}
