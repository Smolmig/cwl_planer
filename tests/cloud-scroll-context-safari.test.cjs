"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(root,"cwl-planning-core.js"),"utf8");
const serve=()=>http.createServer((req,res)=>{
 const pathname=new URL(req.url||"/","http://localhost").pathname;
 if(pathname==="/cloud-app.html"){
  res.writeHead(200,{"content-type":"text/html"});res.end(html);return;
 }
 if(pathname==="/cwl-planning-core.js"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end(core);return;
 }
 if(pathname==="/cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;
 }
 res.writeHead(404);res.end("");
});

test("Realtime refresh preserves the visible player at 320, 390, 430 and desktop widths; settings modal preserves scroll",{
 timeout:120000
},async()=>{
 const server=serve();
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<700,isMobile:false});
   try{
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
    await page.evaluate(()=>{
     window.__refreshTestClan="clan-test-one";
     window.CWLCloud={
      active:true,hasApiClan:()=>false,
      getActiveClanId:()=>window.__refreshTestClan,
      onLocalChange:()=>{},afterRender:()=>{},renderLive:()=>{}
     };
     document.body.classList.add("cloud-mode");
     const profile=window.CWLLegacy.getProfile();
     const members=Array.from({length:76},(_,i)=>{
      const player=window.CWLLegacy.newMember("Spieler "+String(i).padStart(3,"0"));
      player.townHall=18;
      return player;
     });
     window.CWLLegacy.switchToCloud({...profile,members});
     window.showPlannerView("members");
    });
    // The real navigation intentionally uses smooth scroll, so finish it before measuring.
    await page.waitForTimeout(420);
    const result=await page.evaluate(()=>{
     const root=document.getElementById("memberList");
     const rows=[...root.querySelectorAll(".member")];
     const selected=rows[36];
     const scrollTo=window.scrollY+selected.getBoundingClientRect().top-180;
     window.scrollTo(0,scrollTo);
     const headerBottom=document.querySelector(".topbar").getBoundingClientRect().bottom;
     const box=root.getBoundingClientRect();
     const bottomLimit=window.innerHeight-(document.querySelector(".bottomnav")?.getBoundingClientRect().height||0);
     const y=Math.min(bottomLimit-12,Math.max(headerBottom+18,headerBottom+60));
     const x=Math.min(window.innerWidth-12,Math.max(12,box.left+24));
     const anchor=document.elementFromPoint(x,y)?.closest(".member");
     if(!anchor)return {anchorFound:false,atY:y,scrollY:window.scrollY,headerBottom};
     const anchorId=anchor.dataset.id,originalTop=anchor.getBoundingClientRect().top;
     const beforeScroll=window.scrollY;
     const previous=window.CWLLegacy.getProfile();
     const first=window.CWLLegacy.newMember("Neu am Listenanfang");
     first.townHall=18;
     window.CWLLegacy.switchToCloud({...previous,members:[first,...previous.members]});
     const replacement=[...root.querySelectorAll(".member")].find(row=>row.dataset.id===anchorId);
     const afterTop=replacement?.getBoundingClientRect().top;
     const afterScroll=window.scrollY;
     window.showPlannerView("settings");
     const settingsY=window.scrollY,settingsOpen=document.getElementById("view-settings").classList.contains("active");
     window.showPlannerView("members");
     const restoredY=window.scrollY;
     return {
      anchorFound:true,originalTop,afterTop,delta:afterTop-originalTop,
      beforeScroll,afterScroll,settingsY,restoredY,settingsOpen,
      rowCount:root.querySelectorAll(".member").length,
      horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+2
     };
    });
    assert.equal(result.anchorFound,true,"visible member must be anchored at "+width+"px: "+JSON.stringify(result));
    assert.equal(result.rowCount,77);
    assert.ok(result.beforeScroll>500,"the test must scroll into a long list: "+width);
    assert.ok(Math.abs(result.delta)<=3,"Realtime refresh must not jump over the visible member at "+width+"px: "+JSON.stringify(result));
    // Chrome also applies native scroll anchoring on some layouts, especially
    // single-column mobile rows. Preserve the visible player's coordinates,
    // not an assumed direction/magnitude of the document scroll offset.
    assert.ok(Number.isFinite(result.afterScroll),"scroll position stays valid at "+width);
    assert.equal(result.settingsOpen,true);
    assert.ok(Math.abs(result.settingsY-result.afterScroll)<=1,"settings open must not scroll the list at "+width);
    assert.ok(Math.abs(result.restoredY-result.afterScroll)<=1,"settings close must not scroll the list at "+width);
    assert.equal(result.horizontalOverflow,false,"no side scrolling at "+width);
    assert.deepEqual(errors,[],"browser errors at "+width+"px");
   }finally{await page.close();}
  }
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
});
