const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"] });
  try {
    const page = await browser.newPage({ offline: true, viewport: { width: 1100, height: 720 } });
    const errors = [], remote = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", req => { if (/^https?:/.test(req.url())) remote.push(req.url()); });
    const file = path.resolve(__dirname, "../hardware/model/internals/View-Internals.html");
    await page.goto(pathToFileURL(file).href);
    const viewer = page.locator("model-viewer");
    await page.waitForFunction(() => document.querySelector("output").textContent.startsWith("Caps,"), null, { timeout: 90000 });
    assert.equal(await viewer.evaluate(v => v.availableAnimations.length), 1);
    assert.ok(await viewer.evaluate(v => v.currentTime > 1.9));
    await page.getByRole("button", { name: "Assembled", exact: true }).click();
    assert.equal(await viewer.evaluate(v => v.currentTime), 0);
    await page.locator("#spacing").evaluate(slider => {
      slider.value="60";
      slider.dispatchEvent(new Event("input", { bubbles:true }));
    });
    assert.ok(await viewer.evaluate(v => v.currentTime > 1.19 && v.currentTime < 1.21));
    await page.getByRole("button", { name: "Main PCB" }).click();
    await page.waitForFunction(() => document.querySelector("output").textContent.startsWith("Component side"));
    assert.equal(await viewer.evaluate(v => v.availableAnimations.length), 0);
    assert.ok(await viewer.evaluate(v => Math.abs(v.getDimensions().x-.40581)<.001));
    assert.ok(await viewer.evaluate(v => v.getDimensions().y<.023));
    await page.getByRole("button", { name: "Rear USB-C" }).click();
    assert.ok(await viewer.evaluate(v => v.getCameraTarget().x < -.09));
    await page.getByRole("button", { name: "Under the roller" }).click();
    await page.waitForFunction(() => document.querySelector("output").textContent.startsWith("The RP2040"));
    assert.ok(await viewer.evaluate(v => v.getCameraTarget().x > .13 && v.getDimensions().y > .022));
    await page.getByRole("button", { name: "Socket side" }).click();
    await page.waitForFunction(() => document.querySelector("output").textContent.startsWith("The underside"));
    assert.ok(await viewer.evaluate(v => v.getCameraOrbit().phi > Math.PI/2));
    await page.getByRole("button", { name: "Exploded" }).click();
    await page.waitForFunction(() => document.querySelector("output").textContent.startsWith("Caps,"));
    await page.setViewportSize({ width: 390, height: 780 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log("Offline viewer verified in Chromium: assembled and exploded poses, slider, isolated PCB, USB and underside presets, mobile layout.");
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode=1; });
