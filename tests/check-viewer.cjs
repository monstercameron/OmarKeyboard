const {chromium}=require("playwright");
const {pathToFileURL}=require("node:url");
const path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
  const b=await chromium.launch({args:["--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"]});
  const c=await b.newContext({viewport:{width:1160,height:690},offline:true});
  const p=await c.newPage();
  const errors=[];p.on("pageerror",e=>errors.push(e.message));
  const urls=[];p.on("request",r=>{if(/^https?:/.test(r.url()))urls.push(r.url());});
  await p.goto(pathToFileURL(path.resolve("hardware/model/View-Omar-Keyboard.html")).href);
  await p.waitForFunction(()=>document.querySelector("model-viewer").loaded,{},{timeout:60000});
  await p.waitForFunction(()=>document.querySelector("output").textContent.includes("orbit"));
  const v=p.locator("model-viewer");
  const dims=await v.evaluate(v=>v.getDimensions());
  assert.ok(Math.abs(dims.x-.4228)<.0001);
  for(const view of ["top","roller","rear","overview"]){
    await p.locator('[data-view="'+view+'"]').click(); await v.evaluate(v=>v.jumpCameraToGoal());
    const orbit=await v.evaluate(v=>v.getCameraOrbit());
    assert.ok(orbit.radius>0 && Number.isFinite(orbit.phi));

  }
  await p.setViewportSize({width:390,height:720});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(urls,[]);assert.deepEqual(errors,[]);
  console.log("Offline viewer passed four camera presets and mobile width. Model bounds in metres: "+JSON.stringify(dims));
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
