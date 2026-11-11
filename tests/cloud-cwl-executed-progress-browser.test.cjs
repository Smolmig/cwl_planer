"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
function between(from,to){
 const a=html.indexOf(from),b=html.indexOf(to,a);
 assert.ok(a>=0&&b>a,"missing "+from);
 return html.slice(a,b);
}
const progress=between("function currentCwlDisplayProgress(","function memberPerformance(");
const chip=between("function planLineupPlayerChip(","function renderPlan(");
const summary=between("function renderSummary(){","function archiveCurrentCwl(");
const setup="\nlet summarySearch=\"\",summaryFilter=\"all\",summaryOpenMemberId=null;\nconst summaryAdvanced={group:\"all\",progress:\"all\",medal:\"all\",sort:\"default\"};\nfunction resetSummaryAdvanced(){summaryAdvanced.group=\"all\";summaryAdvanced.progress=\"all\";summaryAdvanced.medal=\"all\";summaryAdvanced.sort=\"default\"}\nconst STRENGTH_SHORT={};\nconst m={id:\"mishix\",name:\"mishix\",playerTag:\"#2PYL\",townHall:18,participating:true,fixed:false,statuses:Array(7).fill(\"auto\")};\nconst b={id:\"beta\",name:\"Beta\",playerTag:\"#JRC\",townHall:18,participating:true,fixed:false,statuses:Array(7).fill(\"auto\")};\nconst state={id:\"one\",name:\"United Fighters\",members:[m,b],archivedMembers:[],\n config:{days:7},locks:Array.from({length:7},(_,i)=>({locked:i<3,lineup:i<3?[\"mishix\"]:[]}))};\nconst lastPlan={ok:true,notices:[],counts:{mishix:4,beta:1},playedCounts:{mishix:3,beta:0},\n dayPlans:Array.from({length:7},(_,i)=>({day:i+1,locked:i<4,\n  lineup:i<3?[\"mishix\"]:i===3?[\"mishix\",\"beta\"]:[]}))};\nwindow.results={\n 1:{\"#2PYL\":{stars:3,percent:100,state:\"warEnded\",warTag:\"#PPQ\"}},\n 2:{\"#2PYL\":{stars:3,percent:100,state:\"warEnded\",warTag:\"#PPJ\"}},\n 3:{\"#2PYL\":{stars:2,percent:89.75,state:\"warEnded\",warTag:\"#PPR\"}}\n};\nwindow.CWLCloud={\n active:true,getActiveClanId:()=>\"one\",\n getPlayedAttackResults:()=>window.results,\n getMedalOverview:()=>({fresh:false,partial:true,assessment:{\n  rows:[{playerTag:\"#2PYL\",status:\"reached\",stars:8,attackCount:3,futureAttacks:1,unknown:false}],\n  reached:1,notReachable:0\n }})\n};\nfunction allKnownMembers(){return state.members}\nfunction memberById(id){return state.members.find(m=>m.id===id)}\nfunction normalizePlayerTag(tag){return String(tag||\"\").trim().toUpperCase()}\nfunction displayMemberName(m){return m.name}\nfunction memberTownHallMarkup(){return \"\"}\nfunction isDuplicateMember(){return false}\nfunction rotationWeightLabel(){return \"Ausgewogen\"}\nfunction effectiveStatus(){return \"auto\"}\nfunction rotationStats(){return {min:1,max:4,spread:3}}\nfunction esc(s){return String(s??\"\").replace(/[&<>\"']/g,c=>({\n \"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\",\"'\":\"&#39;\"\n}[c]))}\n"+chip+progress+summary+"\ndocument.getElementById(\"summaryList\").addEventListener(\"click\",event=>{\n const button=event.target.closest(\".summary-player-toggle\");if(!button)return;\n summaryOpenMemberId=summaryOpenMemberId===button.dataset.memberId?null:button.dataset.memberId;\n renderSummary();\n});\nwindow.check={\n render:renderSummary,\n view:id=>{\n  const p=currentCwlDisplayProgress().get(id);\n  const member=state.members.find(m=>m.id===id);\n  const row=[...document.querySelectorAll(\".summary-compact-row\")].find(r=>r.dataset.memberId===id);\n  return {p,chip:planLineupPlayerChip(member,currentCwlDisplayProgress()),\n   line:row?.textContent||\"\",numbers:row?.querySelector(\".summary-compact-numbers\")?.textContent||\"\",\n   days:row?.querySelector(\".summary-player-days\")?.textContent||\"\",\n   bar:row?.querySelector(\".summary-progress-played\")?.style.width||\"\",\n   state:JSON.stringify({locks:state.locks,counts:lastPlan.counts,playedCounts:lastPlan.playedCounts})};\n },\n fourth:()=>{\n  window.results[4]={\"#2PYL\":{stars:3,percent:99.5,state:\"inWar\",warTag:\"#PPU\"}};\n  renderSummary();\n },\n zero:()=>{\n  window.results[4][\"#JRC\"]={stars:0,percent:45.5,state:\"inWar\",warTag:\"#PPU\"};\n  renderSummary();\n },\n end:()=>{\n  state.locks[3]={locked:true,lineup:[\"mishix\",\"beta\"]};\n  lastPlan.playedCounts.mishix=4;\n  for(const result of Object.values(window.results[4]))result.state=\"warEnded\";\n  renderSummary();\n },\n unknown:()=>{delete window.results[3];renderSummary()},\n switchClan:()=>{\n  state.id=\"two\";summaryOpenMemberId=null;\n  window.CWLCloud.getActiveClanId=()=>\"two\";\n  window.CWLCloud.getPlayedAttackResults=()=>({});\n  renderSummary();\n }\n};\n";
test("Verified in-war attack updates plan tile, Einsatz counts/bars and current CWL rates",{
 timeout:150000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent(markup,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:setup});
    await page.evaluate(theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.getElementById("view-plan").classList.remove("active");
     document.getElementById("view-summary").classList.add("active");
     window.check.render();
    },theme);
    const first=await page.evaluate(()=>window.check.view("mishix"));
    const note=JSON.stringify({width,theme,first});
    assert.equal(first.p.executed,3,note);
    assert.equal(first.p.open,1,note);
    assert.equal(first.p.completed,3,note);
    assert.match(first.line,/CWL bisher · 3★-Quote: 67 % \(2\/3 AG\) · Ø 2,67 ★/,note);
    assert.match(first.chip,/3 ausgeführt · 1 offen/,note);
    const unchanged=first.state;
    await page.locator('.summary-player-toggle[data-member-id="mishix"]').click();
    const running=await page.evaluate(()=>{window.check.fourth();return window.check.view("mishix")});
    assert.equal(running.p.executed,4,note);
    assert.equal(running.p.open,0,note);
    assert.equal(running.p.completed,3,note);
    assert.equal(running.p.running,1,note);
    assert.match(running.chip,/4 ausgeführt · 0 offen/,note);
    assert.match(running.numbers,/Ausgeführt 4\s+Offen 0/,note);
    assert.match(running.line,/3★-Quote: 75 % \(3\/4 AG\) · Ø 2,75 ★/,note);
    assert.match(running.line,/CWL: 8\/8 ★/,note);
    assert.match(running.days,/Tag 4 · in Clash fix · Angriff erfolgt: 3★ \(99.5 %\)/,note);
    assert.equal(running.bar,"57.1429%",note);
    assert.equal(running.state,unchanged,"read-only progress must not change a planner lock");
    assert.equal(await page.locator('.summary-player-toggle[data-member-id="mishix"]').getAttribute("aria-expanded"),"true");
    const beta=await page.evaluate(()=>window.check.view("beta"));
    assert.equal(beta.p.executed,0,note);
    assert.equal(beta.p.open,1,note);
    assert.match(beta.line,/noch keine Angriffe belegt/,note);
    assert.doesNotMatch(beta.line,/3★-Quote: 0 %/,note);
    const zero=await page.evaluate(()=>{window.check.zero();return window.check.view("beta")});
    assert.equal(zero.p.executed,1,note);
    assert.equal(zero.p.open,0,note);
    assert.match(zero.line,/3★-Quote: 0 % \(0\/1 AG\) · Ø 0,00 ★/,note);
    const ended=await page.evaluate(()=>{window.check.end();return window.check.view("mishix")});
    assert.equal(ended.p.executed,4,note);
    assert.equal(ended.p.open,0,note);
    assert.match(ended.days,/Tag 4 · gespielt · Angriff erfolgt: 3★/,note);
    const unknown=await page.evaluate(()=>{window.check.unknown();return window.check.view("mishix")});
    assert.equal(unknown.p.executed,3,note);
    assert.equal(unknown.p.unknown,1,note);
    assert.equal(unknown.p.open,0,note);
    assert.match(unknown.chip,/1 ungeklärt/,note);
    const fresh=await page.evaluate(()=>{window.check.switchClan();return window.check.view("mishix")});
    assert.equal(fresh.p.executed,0,note);
    assert.equal(fresh.p.unknown,4,note);
    assert.doesNotMatch(fresh.line,/75 %/,note);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=3,note);
    assert.deepEqual(errors,[],note);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
test("CWL progress uses only verified results; no solver or data format mutation",()=>{
 assert.match(html,/function currentCwlDisplayProgress/);
 assert.match(html,/const result=dayResults\[dp\.day\]\?\.\[playerTag\]\|\|null/);
 assert.match(html,/refreshSummary:\(\)=>\{if\(window\.CWLCloud\?\.active&&lastPlan\)\{renderKpis\(\);renderPlan\(\)\}renderSummary\(\)\}/);
 assert.match(html,/const DATA_VERSION=9/);
});

test("Actual browser Einsatzliste: automatic Jamie and Pro_Gamer 3/4 appear under Ziel offen",{
 timeout:60000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.setContent(markup,{waitUntil:"domcontentloaded"});
   await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,"..","cwl-deployment-filters.js"),"utf8")});
   await page.addScriptTag({content:setup});
   const actual=await page.evaluate(()=>{
    document.body.classList.add("cloud-mode");
    document.querySelector("#view-plan").classList.remove("active");
    document.getElementById("view-summary").classList.add("active");
    state.members[0].name="Jamie";state.members[1].name="Pro_Gamer";
    state.members[0].targetDays=null;state.members[1].targetDays=null;
    lastPlan.counts.beta=4;
    for(let d=0;d<3;d++)lastPlan.dayPlans[d].lineup.push("beta");
    for(let d=1;d<=3;d++)
     window.results[d]["#JRC"]={stars:2,percent:83,state:"warEnded",warTag:"#P"+d};
    summaryAdvanced.progress="target-open";
    renderSummary();
    const open=[...document.querySelectorAll(".summary-compact-row")].map(x=>x.textContent);
    const progress=[state.members[0],state.members[1]].map(member=>{
     const p=currentCwlDisplayProgress().get(member.id);
     return {name:member.name,executed:p.executed,total:p.total,open:p.open};
    });
    window.results[4]={
     "#2PYL":{stars:3,percent:100,state:"inWar",warTag:"#P4"},
     "#JRC":{stars:3,percent:100,state:"inWar",warTag:"#P4"}
    };
    renderSummary();
    const noLongerOpen=document.querySelectorAll(".summary-compact-row").length;
    summaryAdvanced.progress="target-met";renderSummary();
    const reached=[...document.querySelectorAll(".summary-compact-row")].map(x=>x.textContent);
    return {progress,open,noLongerOpen,reached,html:document.getElementById("summaryCloudFilters").hidden};
   });
   assert.deepEqual(actual.progress,[
    {name:"Jamie",executed:3,total:4,open:1},
    {name:"Pro_Gamer",executed:3,total:4,open:1}
   ]);
   assert.equal(actual.open.length,2);
   assert.ok(actual.open.some(x=>x.includes("Jamie")));
   assert.ok(actual.open.some(x=>x.includes("Pro_Gamer")));
   assert.equal(actual.noLongerOpen,0);
   assert.equal(actual.reached.length,2);
   assert.equal(actual.html,false,"cloud-filter UI visible with actual source");
   assert.deepEqual(errors,[]);
  }finally{await page.close()}
 }finally{await browser.close()}
});
