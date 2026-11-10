"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(__dirname,"..","clan-management-core.js"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const a=html.indexOf("/* #183: do not reuse the roster import path");
const b=html.indexOf('document.querySelector(".more-menu").addEventListener("click"',a);
assert.ok(a>0&&b>a);
const manager=html.slice(a,b);
const fakeCloud=[
 'let clanId="alpha",owner=true,revision=null,savedRules=null,saveCalls=0;',
 'const tenure={player_tag:"#2PYL",confirmed_seconds:14*86400,last_observed_at:new Date(Date.now()-1000).toISOString(),is_present:true,observed_visits:1};',
 'window.CWLCloud={active:true,isOwner:()=>owner,hasApiClan:()=>true,getActiveClanId:()=>clanId,',
 'fetchManagementRoster:()=>Promise.resolve({clanId,members:[{tag:"#2PYL",name:"Member",role:"member",donations:5}],',
 'checkedAt:Date.now(),tenure:[tenure],rules:savedRules||window.CWLClanManagement.DEFAULT_RULES,',
 'ruleRevision:revision,evidence:[{player_tag:"#2PYL",attack_count:10,three_star_count:8,relevant_wars:9}]}),',
 'saveManagementRules:async(input,expectedRevision)=>{',
 'if(expectedRevision!==revision)throw Error("CAS conflict");',
 'saveCalls++;revision=(revision||0)+1;savedRules=input;return {rules:input,revision};}};',
 'function showPlannerView(target){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-"+target));}'
].join("\n");
test("Owner saves criteria and refreshes manual preview without hiding controls on mobile",{
 timeout:110000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1280]){
   const page=await browser.newPage({viewport:{width,height:820}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent(markup,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:core});
    await page.addScriptTag({content:fakeCloud});
    await page.addScriptTag({content:manager});
    await page.evaluate(()=>window.CWLClanManagementView.open());
    await page.waitForFunction(()=>document.getElementById("clanManagementStatus").textContent.includes("Clash-Stand"));
    assert.match(await page.locator("#clanManagementList").innerText(),/Beförderung prüfen/);
    await page.locator("#clanManagementCriteria > summary").click();
    await page.locator("#clanRuleDays").fill("15");
    assert.equal(await page.locator("#clanRulesSave").isEnabled(),true);
    await page.locator("#clanRulesSave").click();
    await page.waitForFunction(()=>saveCalls===1);
    await page.waitForFunction(()=>document.getElementById("clanManagementList").innerText.includes("15 Tage"));
    assert.equal(await page.locator("#clanManagementCriteria").evaluate(x=>x.open),true);
    assert.doesNotMatch(await page.locator("#clanManagementList").innerText(),/Beförderung prüfen/);
    const layout=await page.evaluate(()=>({
      w:document.documentElement.scrollWidth,viewport:innerWidth
    }));
    assert.ok(layout.w<=layout.viewport+3,JSON.stringify({width,layout}));
    assert.deepEqual(errors,[]);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});