"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(__dirname,"..","clan-management-core.js"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");
const start=html.indexOf("/* #183: do not reuse the roster import path");
const end=html.indexOf('document.querySelector(".more-menu").addEventListener("click"',start);
assert.ok(start>0&&end>start);
const manager=html.slice(start,end);
const fakeCloud=[
 'let clanId="clan-a",owner=true,fetchCalls=0,saveCalls=0;',
 'const reviews={"clan-a":{},"clan-b":{}};',
 'const tenure=()=>({player_tag:"#2PYL",confirmed_seconds:15*86400,',
 'last_observed_at:new Date(Date.now()-3000).toISOString(),is_present:true,observed_visits:1});',
 'window.CWLCloud={active:true,isOwner:()=>owner,hasApiClan:()=>true,getActiveClanId:()=>clanId,',
 'fetchManagementRoster:async()=>{fetchCalls++;return {clanId,members:[{tag:"#2PYL",name:"Sample",role:"member",donations:90}],',
 'checkedAt:Date.now(),tenure:[tenure()],rules:window.CWLClanManagement.DEFAULT_RULES,',
 'ruleRevision:null,evidence:[{player_tag:"#2PYL",attack_count:10,three_star_count:8,relevant_wars:5}],',
 'loyalty:null,reviewDecisions:Object.values(reviews[clanId])};},',
 'saveManagementReview:async(tag,kind,state,fingerprint,revision)=>{',
 'if(!owner)throw Error("not owner");',
 'const key=tag+"|"+kind,existing=reviews[clanId][key];',
 'if((existing?.revision??null)!==revision)throw Error("Conflict");',
 'saveCalls++;const data={player_tag:tag,review_kind:kind,disposition:state,',
 'evidence_fingerprint:fingerprint,revision:(revision||0)+1};',
 'reviews[clanId][key]=data;return data;},',
 'saveManagementRules:async()=>{throw Error("Not needed")}};',
 'function showPlannerView(target){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+target));}'
].join("\n");

test("Owner acknowledges, reopens and exempts a specific evidence review without reload or overflow",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1280]){
   const page=await browser.newPage({viewport:{width,height:840}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent(markup,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:core});
    await page.addScriptTag({content:fakeCloud});
    await page.addScriptTag({content:manager});
    for(const theme of ["arena","dark","light"]){
     await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
     await page.evaluate(()=>window.CWLClanManagementView.open());
     await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 offene Prüfhinweise"));
     assert.match(await page.locator("#clanManagementList").innerText(),/Leistungsprüfung: Offen/);
     const calls=await page.evaluate(()=>fetchCalls);
     await page.getByRole("button",{name:"Leistungsprüfung für Sample: Quittieren"}).click();
     await page.waitForFunction(()=>saveCalls>=1);
     await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 quittiert"));
     assert.equal(await page.evaluate(()=>fetchCalls),calls,"single line update must not force Clash API refresh");
     await page.getByRole("button",{name:"Leistungsprüfung für Sample: Erneut öffnen"}).click();
     await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 offene Prüfhinweise"));
     await page.getByRole("button",{name:"Leistungsprüfung für Sample: Ausnahme",exact:true}).click();
     await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 Ausnahmen"));
     assert.match(await page.locator("#clanManagementList").innerText(),/Ausnahme aktiv/);
     await page.evaluate(()=>window.CWLClanManagementView.refresh());
     await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 Ausnahmen"));
     await page.getByRole("button",{name:"Leistungsprüfung für Sample: Ausnahme aufheben"}).click();
     await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 offene Prüfhinweise"));
     const layout=await page.evaluate(()=>({w:document.documentElement.scrollWidth,viewport:innerWidth}));
     assert.ok(layout.w<=layout.viewport+3,JSON.stringify({width,theme,layout}));
    }
    assert.deepEqual(errors,[]);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});

test("Cloud clan switch cannot reuse a different clan's private acknowledgment",{
 timeout:40000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage();
  try{
   await page.setContent(markup);await page.addScriptTag({content:core});
   await page.addScriptTag({content:fakeCloud});await page.addScriptTag({content:manager});
   await page.evaluate(()=>window.CWLClanManagementView.open());
   await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 offene Prüfhinweise"));
   await page.getByRole("button",{name:"Leistungsprüfung für Sample: Quittieren"}).click();
   await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 quittiert"));
   await page.evaluate(()=>{clanId="clan-b";window.CWLClanManagementView.open();});
   await page.waitForFunction(()=>document.getElementById("clanManagementSummary").textContent.includes("1 offene Prüfhinweise"));
   assert.doesNotMatch(await page.locator("#clanManagementSummary").innerText(),/quittiert/);
   await page.evaluate(()=>{owner=false;window.CWLClanManagementView.accessChanged(null);});
   assert.equal(await page.locator("#clanManagementList").innerText(),"");
  }finally{await page.close()}
 }finally{await browser.close()}
});
