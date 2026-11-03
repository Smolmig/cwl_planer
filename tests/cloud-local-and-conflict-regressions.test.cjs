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
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
function makeServer(){
 return http.createServer((req,res)=>{
  const key=new URL(req.url||"/","http://localhost").pathname;
  if(key==="/cloud-app.html"){res.writeHead(200,{"content-type":"text/html"});res.end(html);return}
  if(key==="/cwl-planning-core.js"){res.writeHead(200,{"content-type":"text/javascript"});res.end(core);return}
  if(key==="/cloud-sync.mjs"){res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return}
  res.writeHead(404);res.end("");
 });
}
test("real guest UI: bulk members, new and renamed local profiles, and all days work without rewriting Cloud data",{timeout:150000},async()=>{
 const server=makeServer();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  try{
   await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
   assert.equal(await page.locator("#headerClanName").isVisible(),false,"hidden clan control cannot become an empty pill");
   await page.locator('.navbtn[data-view="members"]').click();
   await page.locator("#guestMembersTools summary").click();
   await page.locator("#guestManualMany").click();
   await page.locator("#bulkNames").fill("Test\nTest\nTest\nTest");
   assert.match(await page.locator("#bulkDetectedCount").textContent(),/4 Namen erkannt/);
   await page.locator("#bulkSave").click();
   assert.equal(await page.locator("#bulkModal.open").count(),0,"bulk dialog closes after a successful import");
   assert.equal(await page.locator('#memberList .member').count(),4,"all four duplicate-name entries must be retained");
   const saved=await page.evaluate(()=>{
    const p=JSON.parse(localStorage.getItem("cwl_planer_mobile_v9")).profiles[0];
    return {memberCount:p.members.length,names:p.members.map(m=>m.name)};
   });
   assert.equal(saved.memberCount,4);
   assert.deepEqual(saved.names,["Test","Test","Test","Test"]);
   await page.locator("#settingsOpen").click();
   await page.locator("#newProfileBtn").click();
   assert.equal(await page.locator("#inlineActionPanel.open").count(),1);
   const visibleOnTop=await page.evaluate(()=>{
    const p=document.getElementById("inlineActionPanel");
    const r=p.getBoundingClientRect();
    return {panelZ:getComputedStyle(p).zIndex,
      settingsZ:getComputedStyle(document.getElementById("view-settings")).zIndex,
      onTop:p.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};
   });
   assert.equal(visibleOnTop.onTop,true,"profile dialog must sit in front of settings");
   assert.ok(Number(visibleOnTop.panelZ)>Number(visibleOnTop.settingsZ),"profile dialog stacking order");
   await page.locator("#inlineActionInput").fill("Zweiter Clan");
   await page.locator("#inlineActionButtons .primary").click();
   assert.match(await page.locator("#activeProfileName").textContent(),/Zweiter Clan/);
   await page.locator("#renameProfileBtn").click();
   assert.equal(await page.locator("#inlineActionPanel.open").count(),1);
   await page.locator("#inlineActionInput").fill("Testprofil");
   await page.locator("#inlineActionButtons .primary").click();
   assert.equal(await page.locator("#activeProfileName").textContent(),"Testprofil");
   const profiles=await page.evaluate(()=>JSON.parse(localStorage.getItem("cwl_planer_mobile_v9")).profiles.map(p=>p.name));
   assert.deepEqual(profiles,["Neuer Clan","Testprofil"]);
   await page.locator("#settingsClose").click();
   await page.locator('.navbtn[data-view="plan"]').click();
   assert.deepEqual(errors,[],"guest interactions must not throw runtime exceptions");
  }finally{await page.close()}
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
});
test("desktop local day switch renders seven days with All days and one day with Single day",{timeout:120000},async()=>{
 const server=makeServer();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
  try{
   assert.equal(await page.locator("#planDays .day-card").count(),7);
   await page.locator("#singleDayMode").click();
   assert.equal(await page.locator("#planDays .day-card:visible").count(),1);
   await page.locator("#allDaysMode").click();
   assert.equal(await page.locator("#planDays .day-card:visible").count(),7);
   assert.equal(await page.locator("#planDays .day-card.mobile-day-hidden").count(),0);
  }finally{await page.close()}
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
});
test("mobile remote change notice keeps a full-width message and accessible action buttons",{timeout:90000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390]){
   const page=await browser.newPage({viewport:{width,height:844}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    const measure=await page.evaluate(()=>{
     const box=document.getElementById("cloudChangeNotice");
     box.hidden=false;
     document.getElementById("cloudChangeTitle").textContent="Gemeinsame Änderung prüfen";
     document.getElementById("cloudChangeText").textContent=
       "Der Clanplan wurde auf einem anderen Gerät geändert · Deine offenen Änderungen bleiben geschützt. Revision 126 · CWL-Kriegs- und Gegnerdaten synchronisiert.";
     document.getElementById("cloudChangeReload").hidden=false;
     const body=box.querySelector(".cloud-change-content").getBoundingClientRect();
     const title=box.querySelector("strong").getBoundingClientRect();
     const notice=box.getBoundingClientRect();
     const actions=[...box.querySelectorAll(".cloud-change-actions button")].map(x=>x.getBoundingClientRect());
     const css=getComputedStyle(box);
     return {boxWidth:notice.width,contentWidth:body.width,titleWidth:title.width,contentMin:body.width,
       actionsMin:Math.min(...actions.map(x=>x.width)),bodyScroll:document.documentElement.scrollWidth,
       viewport:innerWidth,display:css.display};
    });
    assert.equal(measure.display,"grid");
    assert.ok(measure.contentWidth>width-60,"message must not collapse into a thin column: "+JSON.stringify(measure));
    assert.ok(measure.actionsMin>=38,"buttons remain usable: "+JSON.stringify(measure));
    assert.ok(measure.bodyScroll<=width+3,"no horizontal overflow");
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
test("plan warnings are day-specific and avoid repeating a complete seven-day conflict list in every card",()=>{
 const start=html.indexOf("function renderPlanDayWarnings(dp){");
 const end=html.indexOf("function renderPlan(){",start);
 assert.ok(start>0&&end>start);
 const renderer=new Function("esc",html.slice(start,end)+";return renderPlanDayWarnings")(
  x=>String(x).replaceAll("&","&amp;").replaceAll("<","&lt;"));
 const examples=["Tag 1: Nur 1 von 15 Spielern verfügbar.",
  "Tag 2: Nur 0 von 15 Spielern verfügbar.","Tag 5: Nur 0 von 15 Spielern verfügbar.",
  "Test: Ziel 4 nicht erreichbar – nur 3 Einsätze möglich."];
 const day1=renderer({day:1,warnings:examples});
 const day2=renderer({day:2,warnings:examples});
 assert.match(day1,/Tag 1:/);
 assert.doesNotMatch(day1,/Tag 2:|Tag 5:/);
 assert.match(day1,/Test: Ziel 4/);
 assert.match(day2,/Tag 2:/);
 assert.doesNotMatch(day2,/Tag 1:|Tag 5:|Test: Ziel 4/);
});
