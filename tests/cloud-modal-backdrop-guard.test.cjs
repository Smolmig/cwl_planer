"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const from=html.indexOf("function bindModalBackdropClose(id,onClose){");
const to=html.indexOf("function openLineupModal(day)",from);
assert.ok(from>=0&&to>from,"backdrop guard must exist");
const guard=html.slice(from,to);

test("all editable modal backdrops require an intentional click",()=>{
 for(const name of ["townHallPickerModal","whyModal","lineupModal","bulkModal","archiveModal"]){
  assert.match(html,new RegExp('bindModalBackdropClose\\("'+name+'",'));
 }
 assert.doesNotMatch(html,/\.onclick=e=>\{if\(e\.target\.id==="(?:townHallPickerModal|whyModal|lineupModal|bulkModal|archiveModal)"\)/);
});

test("dragging selection from inside a dialog onto backdrop must not dismiss",async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="overlay"><div id="dialog"><input id="text" value="mein clan"></div></div>');
  await page.addScriptTag({content:guard+'\nwindow.closed=0;bindModalBackdropClose("overlay",()=>window.closed++);'});
  await page.evaluate(()=>{
   document.getElementById("text").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));
   document.getElementById("overlay").dispatchEvent(new PointerEvent("pointerup",{bubbles:true}));
   document.getElementById("overlay").dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1}));
  });
  assert.equal(await page.evaluate(()=>window.closed),0);
  await page.evaluate(()=>{
   const el=document.getElementById("overlay");
   el.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));
   el.dispatchEvent(new PointerEvent("pointerup",{bubbles:true}));
   el.dispatchEvent(new MouseEvent("click",{bubbles:true,detail:1}));
  });
  assert.equal(await page.evaluate(()=>window.closed),1);
 }finally{await browser.close()}
});
