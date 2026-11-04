"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const planner=fs.readFileSync(path.join(__dirname,"..","cwl-planning-core.js"),"utf8");

function serveApp(){
 return http.createServer((req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  if(pathname==="/cloud-app.html"){
   res.writeHead(200,{"content-type":"text/html"});res.end(html);return;
  }
  if(pathname==="/cwl-planning-core.js"){
   res.writeHead(200,{"content-type":"text/javascript"});res.end(planner);return;
  }
  if(pathname==="/cloud-sync.mjs"){
   res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;
  }
  res.writeHead(404);res.end("");
 });
}
test("Plan: expanded rotations survive automatic re-render without leaking to another clan",{
 timeout:120000
},async()=>{
 const server=serveApp();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:844}});
   try{
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{
     waitUntil:"domcontentloaded"
    });
    // The rotation comparison exists only for a linked Cloud clan, not a guest.
    // Stub the Cloud read-only capability: no live credentials or data writes.
    await page.evaluate(()=>{
     window.__fakeClanId="clan-a";
     window.CWLCloud={active:true,hasApiClan:()=>true,
      getActiveClanId:()=>window.__fakeClanId,renderLive:()=>{},
      onLocalChange:()=>{},afterRender:()=>{}};
     window.CWLLegacy.switchToCloud({...window.CWLLegacy.getProfile()});
     window.renderPlanDayWarnings=dp=>dp.day===1
      ?'<details class="day-warnings-more"><summary>Weitere Hinweise</summary><p>Konflikt prüfen</p></details>'
      :'';
     window.CWLLegacy.rerender();
     document.getElementById("allDaysMode").click(); // allow keyboard focus on day 2 on mobile
    });
    const selector="#day-card-1 .plan-rotation-backup";
    assert.equal(await page.locator(selector).count(),1);
    assert.equal(await page.locator("#day-card-0 .day-warnings-more").count(),1);
    // Open several independent day details and focus a summary like a real user.
    await page.evaluate(()=>{
     document.querySelector("#day-card-1 .plan-rotation-backup").open=true;
     document.querySelector("#day-card-2 .plan-rotation-backup").open=true;
     const warnings=document.querySelector("#day-card-0 .day-warnings-more");
     warnings.open=true;
     warnings.querySelector("summary").focus();
     window.CWLLegacy.switchToCloud({...window.CWLLegacy.getProfile()}); // actual same-clan Cloud refresh
    });
    const expanded=await page.evaluate(()=>({
     first:document.querySelector("#day-card-1 .plan-rotation-backup").open,
     second:document.querySelector("#day-card-2 .plan-rotation-backup").open,
     third:document.querySelector("#day-card-3 .plan-rotation-backup").open,
     warnings:document.querySelector("#day-card-0 .day-warnings-more").open,
     warningFocus:document.activeElement===document.querySelector("#day-card-0 .day-warnings-more summary")
    }));
    assert.deepEqual(expanded,{first:true,second:true,third:false,warnings:true,warningFocus:true},
     "an unrelated refresh must not close or open a rotation");
    // Changes to the same saved clan must keep the exact details states.
    await page.evaluate(()=>{
     window.CWLLegacy.getProfile().members.push(window.CWLLegacy.newMember("Tester"));
     window.CWLLegacy.rerender();
    });
    assert.equal(await page.locator(selector).evaluate(el=>el.open),true);
    assert.equal(await page.locator("#day-card-0 .day-warnings-more").evaluate(el=>el.open),true);
    // Check focus restoration on the rotation summary itself.
    const rotationFocus=await page.evaluate(()=>{
     const summary=document.querySelector("#day-card-1 .plan-rotation-backup summary");
     summary.focus();
     window.CWLLegacy.rerender();
     return document.activeElement===document.querySelector("#day-card-1 .plan-rotation-backup summary");
    });
    assert.equal(rotationFocus,true,"rotation keyboard focus survives refresh");
    // Summary rows must preserve focused member and expanded day list.
    const summaryState=await page.evaluate(()=>{
     window.showPlannerView("summary"); // focus requires its tab to be visible
     const member=window.CWLLegacy.newMember("Summary Test");
     window.CWLLegacy.getProfile().members.push(member);
     window.CWLLegacy.rerender();
     const button=document.querySelector("#summaryList .summary-player-toggle");
     if(!button)return {exists:false};
     button.click();
     const id=button.dataset.memberId;
     const selected=[...document.querySelectorAll("#summaryList .summary-player-toggle")]
      .find(el=>el.dataset.memberId===id);
     selected.focus();
     window.CWLLegacy.rerender();
     const restored=[...document.querySelectorAll("#summaryList .summary-player-toggle")]
      .find(el=>el.dataset.memberId===id);
     return {exists:!!restored,focused:document.activeElement===restored,
      expanded:restored?.getAttribute("aria-expanded")==="true"};
    });
    assert.deepEqual(summaryState,{exists:true,focused:true,expanded:true});
    // A Cloud Realtime profile replacement must preserve live member controls.
    const memberState=await page.evaluate(()=>{
     window.showPlannerView("members");
     const search=document.getElementById("memberSearch");
     search.value="Summary";
     search.dispatchEvent(new Event("input",{bubbles:true}));
     const filter=document.getElementById("memberFilter");
     filter.value="participating";
     filter.dispatchEvent(new Event("change",{bubbles:true}));
     const row=document.querySelector("#memberList .member");
     const toggle=row.querySelector(".member-edit-toggle");
     toggle.click();
     toggle.focus();
     const id=row.dataset.id;
     window.CWLLegacy.switchToCloud({...window.CWLLegacy.getProfile()});
     const newRow=[...document.querySelectorAll("#memberList .member")]
      .find(el=>el.dataset.id===id);
     return {search:search.value,filter:filter.value,rows:document.querySelectorAll("#memberList .member").length,
      expanded:!!newRow?.classList.contains("member-expanded"),
      focused:document.activeElement===newRow?.querySelector(".member-edit-toggle")};
    });
    assert.deepEqual(memberState,{search:"Summary",filter:"participating",rows:1,expanded:true,focused:true},
      "same-clan refresh preserves member search, filter, open details and keyboard focus");
    // Switching the profile is a deliberate context change.
    await page.evaluate(()=>{
     const old=window.CWLLegacy.getProfile();
     const next=window.CWLLegacy.normalize({...old,name:"Anderer Clan"});
     // Different Cloud clan with an accidentally identical profile ID must still reset.
     window.__fakeClanId="clan-b";
     window.CWLLegacy.switchToCloud(next);
    });
    assert.equal(await page.locator(selector).evaluate(el=>el.open),false,
     "new clan must not inherit another clan's disclosure state");
    assert.equal(await page.locator("#day-card-0 .day-warnings-more").evaluate(el=>el.open),false,
     "new clan must not inherit another clan's warnings");
    assert.equal(await page.locator("#summaryList .summary-player-toggle[aria-expanded='true']").count(),0,
     "member deployment disclosures reset on an actual clan change");
    const changedClanUI=await page.evaluate(()=>({
     search:document.getElementById("memberSearch").value,
     filter:document.getElementById("memberFilter").value,
     expanded:document.querySelectorAll("#memberList .member-expanded").length
    }));
    assert.deepEqual(changedClanUI,{search:"",filter:"all",expanded:0},
     "different clan does not inherit another clan's member UI");
    assert.deepEqual(errors,[],"no browser errors on rerenders at "+width+"px");
   }finally{await page.close();}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});