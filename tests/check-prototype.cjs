const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const {pathToFileURL} = require("node:url");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({ viewport:{width:1180,height:780},deviceScaleFactor:2,colorScheme:"light" });
  const errors = [];
  page.on("pageerror", e=>errors.push(e.message));
  const url = pathToFileURL(path.resolve("docs/prototype/OMAR-KEYBOARD-PROTOTYPE.html")).href;
  const key = name=>page.locator('[data-key="'+name+'"]').first();
  const click = (name,options)=>key(name).click(options);
  const status = async pattern=>assert.match(await page.locator(".oe-result").innerText(),pattern);
  const desk = async n=>assert.equal(await page.locator(".oe-current").innerText(),"Desk "+n);
  const press = name=>page.keyboard.press(name);
  await page.goto(url);
  await page.clock.install();
  assert.equal(await page.locator(".oe-case .cap").count(),92);
  if (process.argv.includes("--update-keymap")) await page.locator(".oe-case").screenshot({path:"docs/assets/omar-keymap.png"});
  await click("Focus");await click("→");await status(/Ordinary arrow/);
  await click("Swap");await click("←");await status(/Ordinary arrow/);
  for (const [name,dir,expected] of [["Focus","ArrowRight",/Focused Browser/],["Swap","ArrowLeft",/Swapped tiles/]]) {
    await key(name).focus();await page.keyboard.down("Space");await press(dir);await status(expected);await page.keyboard.up("Space");
    assert.equal(await page.locator(".cap.ready").count(),0);
  }
  await click("Send & Stay");await click("Desk 3");await desk(1);
  await click("Desk 3");assert.match(await page.locator(".oe-tile.current").innerText(),/Browser/);
  await click("Move & Go");await click("Desk 1");await desk(1);
  await click("Send & Stay");await click("Last Desk");await desk(3);
  assert.equal(await page.locator(".oe-tile").count(),0);
  await click("Last Desk");await desk(1);
  await click("Move & Go");await click("←");await status(/Ordinary arrow/);
  await click("Move & Go");await press("x");await status(/Ordinary typing/);
  await click("Send & Stay");await click("Send & Stay");await status(/Canceled/);
  await click("Send & Stay");await press("Escape");await status(/Canceled/);
  await click("Send & Stay");await page.clock.fastForward(3100);await status(/expired/);
  assert.equal(await page.locator(".cap.ready").count(),0);
  await click("Desk 2");await desk(2);assert.equal(await page.locator(".oe-tile").count(),0);
  await click("Last Desk");await desk(1);await click("Terminal");
  await click("Next Window");await status(/Focused Editor/);
  await click("Next Window",{modifiers:["Shift"]});await status(/Focused Terminal/);
  await page.keyboard.down("CapsLock");await click("Next Window");await status(/Returned to Editor/);
  for(const [k,target] of [["←","Home"],["→","End"],["↑","PgUp"],["↓","PgDn"],["Delete","Insert"]]){
    await click(k);await status(new RegExp("^"+target+" "));
  }
  const text=()=>page.locator(".oe-result").innerText();
  const ready=()=>page.locator(".cap.ready").count();
  for(const [k,code] of [..."1234567890"].map(d=>[d,d]).concat([["-","Minus"],["=","Equal"]])){
    await press(code);assert.equal(await text(),k+" · Ordinary typing.");
  }
  assert.equal(await page.locator(".cap small.fn").count(),7);
  assert.equal(await page.locator(".cap small.sup").count(),3);
  assert.match(await key("Caps").innerText(),/^Caps\s+Fn$/);
  assert.equal(await page.locator(".cap",{hasText:/^F\d+$/}).count(),0);
  await page.keyboard.up("CapsLock");
  await page.keyboard.down("ControlRight");await status(/Right Ctrl held/);
  await press("b");await status(/Ctrl \+ b · sent to the focused application/);
  await press("ArrowLeft");await status(/Ctrl \+ left arrow · sent to the focused application/);
  assert.equal(await key("Alt").count(),0);
  assert.equal(await key("Right Ctrl").getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator("[data-key=Focus]").getAttribute("aria-pressed"),"false");
  await page.keyboard.up("ControlRight");await status(/Right Ctrl released/);
  assert.equal(await ready(),0);
  await click("Send & Stay");assert.equal(await ready(),5);
  await page.keyboard.down("CapsLock");await page.keyboard.up("CapsLock");assert.equal(await ready(),5);
  await page.keyboard.down("ControlRight");await page.keyboard.up("ControlRight");assert.equal(await ready(),5);
  await key("Layout").focus();await press("ArrowUp");await status(/brightness up/i);assert.equal(await ready(),5);
  await page.locator(".oe-roll-input").focus();await press("ArrowDown");assert.equal(await ready(),5);
  await click("Left Super");await status(/pending transfer stays/);assert.equal(await ready(),5);
  await click("Desk 4");await status(/moved to desk 4/);assert.equal(await ready(),0);
  await page.keyboard.down("CapsLock");await click("Next Window");await status(/Returned to|No previous/);await page.keyboard.up("CapsLock");
  await click("Menu",{modifiers:["Shift"]});await status(/app grid/);
  await click("Mute");await status(/Speakers muted/);await click("Mic Mute");await status(/Microphone muted/);
  await key("Layout").focus();await press("ArrowUp");await status(/brightness up/i);
  await page.keyboard.down("CapsLock");await press("ArrowDown");await status(/split boundary left/);
  await page.locator(".oe-roll-input").focus();await press("ArrowDown");await status(/Page Down/);
  await page.keyboard.up("CapsLock");await click("Screenshot");await press("ArrowRight");await press("Enter");await status(/Captured/);
  await click("Right Super");await click("7");await status(/no desk binding/);
  await click("Desk 5");await click("Right Super");await click("Tab");await desk(1);
  await click("Right Super");await click("Tab",{modifiers:["Shift"]});await desk(5);
  await click("Send & Stay");await page.evaluate(()=>dispatchEvent(new Event("blur")));
  assert.equal(await page.locator(".cap.ready").count(),0);
  await page.goto(url+"#guide");assert.equal(await page.locator("details").getAttribute("open"),"");
  await press("Escape");assert.equal(await page.locator("details").getAttribute("open"),null);
  await page.emulateMedia({media:"screen"});
  {
    const csvLines=fs.readFileSync(path.resolve("hardware/layout/omar-switches.csv"),"utf8").trim().split(/\r?\n/);
    const parseLine=l=>{const o=[];let cur="",q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q){if(ch==='"'){if(l[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}else if(ch==='"')q=true;else if(ch===","){o.push(cur);cur="";}else cur+=ch;}o.push(cur);return o;};
    const head=parseLine(csvLines[0]);
    const rows=csvLines.slice(1).map(l=>{const c=parseLine(l);return Object.fromEntries(head.map((h,i)=>[h,c[i]]));});
    assert.equal(rows.length,92);
    const caps=await page.locator(".oe-case .cap").evaluateAll(els=>els.map(e=>({key:e.dataset.key,x:parseFloat(e.style.getPropertyValue("--x"))*21.25/100,y:parseFloat(e.style.getPropertyValue("--y"))*6.25/100,w:parseFloat(e.style.getPropertyValue("--w"))*21.25/100+.055})));
    assert.equal(caps.length,92);
    const used=new Set();
    for(const c of caps){
      const cx=c.x+c.w/2,cy=c.y+.5;
      const match=rows.find(r=>!used.has(r.id)&&r.label===c.key&&Math.abs(Number(r.x_u)+Number(r.w_u)/2-cx)<=.01&&Math.abs(Number(r.y_u)+.5-cy)<=.01&&Math.abs(Number(r.w_u)-c.w)<=.01);
      assert.ok(match,"prototype cap "+c.key+" at centre ("+cx.toFixed(3)+","+cy.toFixed(3)+") width "+c.w.toFixed(3)+"u has no match in omar-switches.csv");
      used.add(match.id);
    }
    assert.equal(used.size,92);
  }
  await page.emulateMedia({media:"print"});
  await page.evaluate(()=>dispatchEvent(new Event("beforeprint")));
  const template=await page.locator(".oe-cut").evaluateAll(cuts=>cuts.map(c=>[c.clientWidth,c.firstElementChild.getBoundingClientRect().width,c.querySelectorAll(".cap").length,c.clientHeight,c.firstElementChild.getBoundingClientRect().height]));
  assert.equal(template.length,2);
  for(const [width,board,count,cutHeight,boardHeight] of template){assert.ok(width>750 && width<780);assert.ok(Math.abs(board-404.8125*96/25.4)<1);assert.equal(count,92);assert.ok(Math.abs(cutHeight-119.0625*96/25.4)<1);assert.ok(Math.abs(boardHeight-119.0625*96/25.4)<1);}
  await page.pdf({format:"A4",landscape:true,preferCSSPageSize:true,printBackground:true});
  await page.emulateMedia({media:"screen"});await page.setViewportSize({width:390,height:800});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  console.log("Verified keyboard count, key layer, hold/release, transfers, expiry, MRU, Fn legends, Right Ctrl hold, pending transfer survives dials and modifiers, four dial functions, capture, guide, mobile width, print geometry and the omar-switches.csv layout.");
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
