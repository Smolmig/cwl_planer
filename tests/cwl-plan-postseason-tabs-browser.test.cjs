"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("cloud-app.html");
const live=read("cwl-live.mjs");
const season=read("cwl-season-view.mjs");
const css=(app.match(/<style[^>]*>[\s\S]*?<\/style>/gi)||[]).join("");
const markup=app.slice(app.indexOf('<section id="view-plan"'),
 app.indexOf('<section id="view-members"'));
const pageHTML='<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 css+'</head><body><main class="content">'+markup+'</main></body></html>';
const begin=live.indexOf("  const getLifecycle=()=>{");
const end=live.indexOf("\n  const effective=()=>{",begin);
assert.ok(begin>0&&end>begin);
const fragment=live.slice(begin,end);
const fixture=[
 'let activeClan="clan-a",confirmedNoCwl=true,lastKnownGroup=null;',
 'let current={active:false,currentWar:null};',
 'let model={mode:"postseason",season:"2026-11",verifiedSeven:false,',
 'savedDays:6,snapshot:{season:"2026-11",clanTag:"#2PYL",rounds:[]}};',
 'function context(){return {active:true,clanId:activeClan,clanTag:"#2PYL",hasClanTag:true,profile:{}}}',
 'function assessCwlLifecycle(){return model}',
 'function renderInlineCwlPostseason(profile,snapshot,group,lifecycle,tab){',
 'const selected=tab||"rounds";',
 'return \'<section class="plan-postseason-results"><h3>November 2026</h3>\'+',
 '\'<div class="plan-postseason-tabs" role="tablist">\'+',
 '["rounds","group","players"].map(function(k){return \'<button type="button" role="tab" data-postseason-tab="\'+k+',
 '\'" aria-selected="\'+(selected===k)+\'" tabindex="\'+(selected===k?0:-1)+\'">\'+k+\'</button>\'}).join("")+',
 '\'</div><div role="tabpanel">\'+selected+\'</div></section>\';}',
 fragment,
 'window.demo={refresh:renderPostseason,setWar:function(w){current.currentWar=w?{state:w}:null;renderPostseason()},',
 'newSeason:function(){model.mode="planning";renderPostseason()},',
 'otherClan:function(){activeClan="clan-b";renderPostseason()},',
 'mode:function(){return model.mode}};'
].join("\n");
test("After CWL: 3 tabs; on CW battle collapses recap only once; on preparation expands again",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent(pageHTML);
    await page.addScriptTag({content:fixture});
    await page.evaluate(()=>window.demo.refresh());
    const details=page.locator("#planCwlPostseason");
    assert.equal(await details.isVisible(),true);
    assert.equal(await details.evaluate(e=>e.open),true);
    assert.equal(await page.locator("[data-postseason-tab]").count(),3);
    await page.getByRole("tab",{name:"group"}).click();
    assert.equal(await page.getByRole("tab",{name:"group"}).getAttribute("aria-selected"),"true");
    await page.evaluate(()=>window.demo.refresh());
    assert.equal(await page.getByRole("tab",{name:"group"}).getAttribute("aria-selected"),"true",
      "Auto-refresh may not reset the selected CWL tab");
    await page.evaluate(()=>window.demo.setWar("inWar"));
    assert.equal(await details.evaluate(e=>e.open),false,
      "The previous season should fold when normal battle day begins");
    await details.locator("summary").click();
    assert.equal(await details.evaluate(e=>e.open),true);
    await page.evaluate(()=>window.demo.refresh());
    assert.equal(await details.evaluate(e=>e.open),true,
      "A manual open during battle must survive refresh");
    await page.evaluate(()=>window.demo.setWar("preparation"));
    assert.equal(await details.evaluate(e=>e.open),true);
    await page.evaluate(()=>window.demo.newSeason());
    assert.equal(await details.isVisible(),false,
      "The confirmed new CWL should restore the normal planner");
    assert.equal(await page.locator("#view-plan").evaluate(e=>e.classList.contains("plan-postseason-mode")),false);
    assert.deepEqual(errors,[]);
    for(const theme of ["arena","dark","light"]){
     await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
     const d=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
      viewport:innerWidth}));
     assert.ok(d.scroll<=d.viewport+3,JSON.stringify({width,theme,d}));
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
test("The true season renderer has only three purposeful tabs, not one long list",()=>{
 assert.match(season,/role="tablist"/);
 assert.match(season,/data-postseason-tab/);
 assert.match(season,/\["rounds","Kriegstage"\]/);
 assert.match(season,/\["group","Tabelle"\]/);
 assert.match(season,/\["players","Spieler"\]/);
 assert.match(app,/id="planCwlPostseason" class="plan-last-cwl"/);
});
