"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");
const start=html.indexOf("function renderSummary(){");
const end=html.indexOf("function archiveCurrentCwl(",start);
assert.ok(start>0&&end>start,"real Einsätze renderer available");
const setup="\nwindow.CWLCloud={active:false};\nlet summarySearch=\"\",summaryFilter=\"all\",summaryOpenMemberId=null;\nconst state={id:\"demo\",name:\"Test\",members:[\n {id:\"alpha\",name:\"Alpha Spielername mit viel Text\",playerTag:\"#AAA\",townHall:18,\n  fixed:true,participating:true,statuses:Array(7).fill(\"auto\")},\n {id:\"beta\",name:\"Beta\",playerTag:\"#BBB\",townHall:17,\n  fixed:false,participating:true,statuses:Array(7).fill(\"auto\")}\n ],locks:Array.from({length:7},()=>({locked:false})),config:{days:7}};\nconst lastPlan={ok:true,notices:[],counts:{alpha:3,beta:2},\n playedCounts:{alpha:1,beta:0},\n dayPlans:Array.from({length:7},(_,i)=>({\n  day:i+1,locked:false,\n  lineup:i===0?[\"alpha\",\"beta\"]:i===1?[\"alpha\",\"beta\"]:i===2?[\"alpha\"]:[]\n }))};\nfunction memberById(id){return state.members.find(m=>m.id===id)}\nfunction normalizePlayerTag(tag){return String(tag??\"\").trim().toUpperCase()}\nfunction displayMemberName(m){return m.name}\nfunction rotationWeightLabel(){return \"Ausgewogen\"}\nfunction effectiveStatus(){return \"auto\"}\nfunction rotationStats(){return {min:2,max:3,spread:1}}\nfunction esc(v){return String(v??\"\").replace(/[&<>\"']/g,c=>({\n \"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"\n}[c]))}\n"+html.slice(start,end)+"\nconst root=document.getElementById(\"summaryList\");\nroot.addEventListener(\"click\",event=>{\n const trigger=event.target.closest(\".summary-player-toggle\");if(!trigger)return;\n const id=trigger.dataset.memberId;\n summaryOpenMemberId=summaryOpenMemberId===id?null:id;\n renderSummary();\n});\nwindow.testSummary={\n render:renderSummary,\n snapshot:()=>JSON.stringify({state,lastPlan}),\n filter:mode=>{summaryFilter=mode;renderSummary()}\n};\n";

test("Einsätze player toggles accurately describe open/closed state, target their days and stay touchable",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],
    [600,"arena"],[699,"dark"],[768,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    await page.setContent(markup,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:setup});
    const initial=await page.evaluate(theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelector("#view-plan")?.classList.remove("active");
     document.querySelector("#view-summary").classList.add("active");
     window.testSummary.render();
     const b=document.querySelector('.summary-player-toggle[data-member-id="alpha"]');
     return {label:b.getAttribute("aria-label"),title:b.title,
      expanded:b.getAttribute("aria-expanded"),controls:b.getAttribute("aria-controls"),
      target:b.getBoundingClientRect().height,
      snapshot:window.testSummary.snapshot(),
      count:document.querySelectorAll(".summary-player-toggle").length};
    },theme);
    const note=JSON.stringify({width,theme,initial});
    assert.equal(initial.count,2,note);
    assert.equal(initial.expanded,"false",note);
    assert.equal(initial.label,"Einsatztage für Alpha Spielername mit viel Text anzeigen",note);
    assert.equal(initial.title,initial.label,note);
    assert.equal(initial.controls,null,note);
    if(width<=699)assert.ok(initial.target>=44,note);
    await page.locator('.summary-player-toggle[data-member-id="alpha"]').click();
    const opened=await page.evaluate(()=>{
     const b=document.querySelector('.summary-player-toggle[data-member-id="alpha"]');
     const id=b.getAttribute("aria-controls");
     return {label:b.getAttribute("aria-label"),title:b.title,
      expanded:b.getAttribute("aria-expanded"),controls:id,
      panel:id?document.getElementById(id)?.textContent:null,
      focus:document.activeElement===b,
      target:b.getBoundingClientRect().height,
      snapshot:window.testSummary.snapshot(),
      overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.equal(opened.expanded,"true",note);
    assert.equal(opened.label,"Einsatztage für Alpha Spielername mit viel Text schließen",note);
    assert.equal(opened.title,opened.label,note);
    assert.equal(opened.controls,"summary-days-alpha",note);
    assert.ok(opened.panel?.includes("Tag 1")&&opened.panel?.includes("Tag 2"),note);
    assert.equal(opened.focus,true,note);
    assert.equal(opened.snapshot,initial.snapshot,"disclosure must not alter plan");
    assert.ok(opened.overflow<=3,note);
    if(width<=699)assert.ok(opened.target>=44,note);
    await page.locator('.summary-player-toggle[data-member-id="alpha"]').press("Enter");
    const closed=await page.evaluate(()=>{
     const b=document.querySelector('.summary-player-toggle[data-member-id="alpha"]');
     return {label:b.getAttribute("aria-label"),expanded:b.getAttribute("aria-expanded"),
      controls:b.getAttribute("aria-controls"),panel:!!document.getElementById("summary-days-alpha"),
      focus:document.activeElement===b,snapshot:window.testSummary.snapshot()};
    });
    assert.equal(closed.expanded,"false",note);
    assert.equal(closed.label,initial.label,note);
    assert.equal(closed.controls,null,note);
    assert.equal(closed.panel,false,note);
    assert.equal(closed.focus,true,note);
    assert.equal(closed.snapshot,initial.snapshot,note);
    await page.evaluate(()=>window.testSummary.filter("fixed"));
    const filtered=await page.evaluate(()=>({
      ids:[...document.querySelectorAll(".summary-player-toggle")].map(b=>b.dataset.memberId),
      label:document.querySelector(".summary-player-toggle")?.getAttribute("aria-label")}));
    assert.deepEqual(filtered.ids,["alpha"],note);
    assert.equal(filtered.label,initial.label,note);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});

test("Production click handler only toggles disclosure state",()=>{
 assert.match(html,/document\.getElementById\("summaryList"\)\.addEventListener\("click"/);
 assert.match(html,/summaryOpenMemberId=summaryOpenMemberId===id\?null:id/);
 assert.match(html,/const DATA_VERSION=9/);
});
