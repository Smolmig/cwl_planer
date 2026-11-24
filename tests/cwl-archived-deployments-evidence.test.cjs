"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const load=async file=>import(pathToFileURL(path.join(root,file)).href);
const clan="#2PYL",other="#2PYQ",season="2026-11";
const warTags=["#2PYR","#2PYG","#2PYC","#2PYV","#2PY0"];
const league=()=>({season,clanTag:clan,warCount:5,rounds:warTags.map((warTag,i)=>({
 day:i+1,matches:[{available:true,state:"warEnded",warTag,teamSize:1,
  clan:{tag:clan},opponent:{tag:other}}]
}))});
const plan=()=>({
 id:"a1",label:"November 2026",days:5,sourceSeason:season,
 players:[{id:"a",name:"Alte Spielerin",playerTag:"#2PY9"}],
 lineups:[{day:1,lineup:["a"],snapshots:{a:{name:"Alte Spielerin",playerTag:"#2PY9"}}},
  {day:2,lineup:["a"],snapshots:{a:{name:"Alte Spielerin",playerTag:"#2PY9"}}}],
 deploymentSnapshot:{version:1,capturedAt:1794500000000,
  players:[{id:"a",participating:true,fixed:false,targetDays:3}]},
 cwlLive:{season,clanTag:clan,rounds:[]}
});
const row=(day,star,playerTag="#2PY9",state="warEnded")=>({
 season,day,war_tag:warTags[day-1],state,team_size:1,
 lineup_json:{members:[{tag:playerTag,name:"Alte Spielerin",
  attacks:star===null?[]:[{stars:star,destructionPercentage:100}]}]}
});
test("plan counts and Clash evidence never become the same metric; historical goals are captured",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const data=summarizeArchivedDeployments({plan:plan(),group:league(),
  ownRows:[row(1,3),row(2,3),row(3,2)]});
 assert.equal(data.warCount,5);
 assert.equal(data.plannedDays,2);
 assert.equal(data.actualDays,3);
 assert.equal(data.endedDays,3);
 assert.equal(data.completeHistory,false);
 assert.equal(data.players.length,1);
 const p=data.players[0];
 assert.equal(p.planned,2);
 assert.equal(p.actual,3);
 assert.equal(p.completed,3);
 assert.equal(p.attacks,3);
 assert.equal(p.stars,8);
 assert.equal(p.goal8,"reached","eight stars are certain even with unobserved future days");
 assert.equal(p.role,"Rotation");
 assert.equal(p.goal,3);
 assert.equal(p.knownGoal,true);
 assert.equal(p.days[2].planned,false);
 assert.equal(p.days[2].actual,true);
});
test("old plans cannot infer goals, roles, played days or below-8 status from current members",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const old=plan();delete old.deploymentSnapshot;
 const data=summarizeArchivedDeployments({plan:old,group:league(),ownRows:[]});
 const p=data.players[0];
 assert.equal(p.goal,null);
 assert.equal(p.knownGoal,false);
 assert.equal(p.role,null);
 assert.equal(p.planned,2);
 assert.equal(p.actual,0);
 assert.equal(p.completed,0);
 assert.equal(p.goal8,"unknown");
 assert.equal(data.completeHistory,false);
});
test("in-progress Clash roster confirms lineup, not final attacks/stars/8-star goal",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const data=summarizeArchivedDeployments({plan:plan(),group:league(),
  ownRows:[row(1,3,"#2PY9","inWar")]});
 const p=data.players[0];
 assert.equal(p.actual,1);
 assert.equal(p.completed,0);
 assert.equal(p.attacks,0);
 assert.equal(p.stars,0);
 assert.equal(p.days[0].ended,false);
 assert.equal(p.goal8,"unknown");
});
test("complete final five-war evidence permits strictly proven below-eight status",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const data=summarizeArchivedDeployments({plan:plan(),group:league(),
  ownRows:warTags.map((_,i)=>row(i+1,1))});
 assert.equal(data.endedDays,5);
 assert.equal(data.completeHistory,true);
 assert.equal(data.players[0].stars,5);
 assert.equal(data.players[0].goal8,"below");
});
test("wrong war tag, season, size, wrong roster and duplicates do not impersonate own league day",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const forged=[
  {...row(1,3),war_tag:"#2PYP"},
  {...row(2,3),season:"2026-10"},
  {...row(3,3),team_size:15},
  {...row(4,3),lineup_json:{members:[{tag:"#2PY9",attacks:[]},{tag:"#2PY9",attacks:[]}]}}
 ];
 const data=summarizeArchivedDeployments({plan:plan(),group:league(),ownRows:forged});
 assert.equal(data.actualDays,0);
 assert.equal(data.players[0].stars,0);
 assert.equal(data.players[0].goal8,"unknown");
});
test("group-only season renders verified participants without a fake plan or targets",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const data=summarizeArchivedDeployments({group:league(),ownRows:[row(1,3)]});
 assert.equal(data.players.length,1);
 assert.equal(data.players[0].planned,0);
 assert.equal(data.players[0].actual,1);
 assert.equal(data.players[0].knownGoal,false);
});
test("archive detail UI displays historical evidence safely and no current membership dependence",async()=>{
 const before=global.document;
 const dom=new JSDOM('<section id="view-archive" class="active">'+
  '<button id="cwlGroupArchiveRefresh"></button><div id="cwlGroupArchiveContent"></div></section>',
  {url:"https://example.test"});
 global.document=dom.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const bad=plan();bad.players[0].name='<img src=x onerror=alert(1)>';
  const {createCwlGroupArchiveView:unused}=await load("cwl-group-archive.mjs");
  const view=createCwlGroupArchiveView({
   sb:{from(table){return{select(){return this},eq(){return this},order(){return this},
     async limit(){return{data:table==="cwl_group_archives"?[]:[],error:null}}}}},
   getClanId:()=>null,isConnected:()=>false,
   getProfile:()=>({archives:[bad]}),isViewer:()=>true
  });
  await view.open();
  const host=dom.window.document.getElementById("cwlGroupArchiveContent");
  host.querySelector('[data-unified-archive-tab="deployments"]').click();
  assert.match(host.textContent,/Plan und Clash/);
  assert.match(host.textContent,/2 Tage im damaligen Plan/);
  assert.match(host.textContent,/Rotation/);
  assert.match(host.textContent,/3 Tage/);
  assert.match(host.textContent,/nicht sicher belegt/);
  assert.doesNotMatch(host.innerHTML,/<img src=x onerror=alert\(1\)>/);
  assert.equal(host.querySelectorAll("[data-unified-delete-id]").length,0);
  const matrix=host.querySelector(".archive-evidence-day");
  assert.ok(matrix);
  matrix.open=true;
  assert.match(matrix.textContent,/Tag 5/);
 }finally{
  if(before===undefined)delete global.document;else global.document=before;
  dom.window.close();
 }
});
test("automatically assigned goals remain Automatisch rather than zero or a guessed day",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const archived=plan();archived.deploymentSnapshot.players[0].targetDays=null;
 const result=summarizeArchivedDeployments({plan:archived,group:league(),ownRows:[]});
 assert.equal(result.players[0].goal,null);
 assert.equal(result.players[0].knownGoal,true);
});
test("six of seven finished wars cannot conclusively report fewer than eight stars",async()=>{
 const {summarizeArchivedDeployments}=await load("cwl-archived-deployments-core.mjs");
 const p=plan();p.days=7;
 const extra=["#2PY8","#2PYP"];
 p.cwlLive.rounds=[...warTags,...extra].map((warTag,i)=>({
  day:i+1,available:true,state:"warEnded",warTag,teamSize:1,
  clan:{tag:clan,members:[{tag:"#2PY9",name:"Alte Spielerin",attacks:[{stars:1}]}]}
 }));
 const data=summarizeArchivedDeployments({plan:p});
 assert.equal(data.warCount,7);
 assert.equal(data.endedDays,7);
 assert.equal(data.completeHistory,true);
 // A missing final round is a data gap even when six ended wars are saved.
 p.cwlLive.rounds=p.cwlLive.rounds.slice(0,6);
 const incomplete=summarizeArchivedDeployments({plan:p});
 assert.equal(incomplete.endedDays,6);
 assert.equal(incomplete.players[0].stars,6);
 assert.equal(incomplete.players[0].goal8,"unknown");
});
test("deployment snapshot sanitizer retains old unknowns, does not fabricate invalid goals",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const start=html.indexOf("function normalizeArchiveDeploymentSnapshot(");
 const end=html.indexOf("function normalizeArchive(",start);
 assert.ok(start>0&&end>start);
 const normalize=new Function(html.slice(start,end)+"return normalizeArchiveDeploymentSnapshot;")();
 assert.equal(normalize(null),null);
 const snapshot=normalize({version:1,capturedAt:1794500000000,players:[
  {id:"old",fixed:false,participating:true,targetDays:3},
  {id:"bad",fixed:false,targetDays:9},
  {id:"auto",fixed:true,targetDays:null},
  {id:"old",targetDays:7}
 ]});
 assert.equal(snapshot.players.length,3);
 assert.equal(snapshot.players[0].targetDays,3);
 assert.equal(Object.hasOwn(snapshot.players[1],"targetDays"),false);
 assert.equal(snapshot.players[2].targetDays,null);
});
test("historical evidence and day matrix stay within iPhone 320px to desktop widths",{
 timeout:120000
},async()=>{
 const {chromium}=require("playwright");
 const before=global.document,dom=new JSDOM('<section id="view-archive" class="active">'+
  '<button id="cwlGroupArchiveRefresh"></button><div id="cwlGroupArchiveContent"></div></section>',
  {url:"https://example.test"});
 let fragment;
 global.document=dom.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const p=plan();
  p.players=Array.from({length:30},(_,i)=>({
   id:"p"+i,name:"Mitglied mit langem Namen "+i,playerTag:""
  }));
  p.lineups=[{day:1,lineup:p.players.map(x=>x.id),snapshots:{}}];
  const view=createCwlGroupArchiveView({
   sb:{from(){throw Error("offline should never fetch")}},
   getClanId:()=>null,isConnected:()=>false,getProfile:()=>({archives:[p]})
  });
  await view.open();
  const host=dom.window.document.getElementById("cwlGroupArchiveContent");
  host.querySelector('[data-unified-archive-tab="deployments"]').click();
  host.querySelector(".season-archive-item").open=true;
  host.querySelector(".archive-evidence-day").open=true;
  fragment=host.innerHTML;
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
  .replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:860}});
   try{
    await page.setContent(html,{waitUntil:"domcontentloaded"});
    const m=await page.evaluate(content=>{
     document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
     document.getElementById("view-archive").classList.add("active");
     document.getElementById("cwlGroupArchiveContent").innerHTML=content;
     return {viewport:innerWidth,body:document.documentElement.scrollWidth,
       table:document.querySelector(".archive-evidence-table").scrollWidth,
       wrapper:document.querySelector(".archive-evidence-scroll").clientWidth};
    },fragment);
    assert.ok(m.body<=width+3,JSON.stringify(m));
    assert.ok(m.table>=m.wrapper,JSON.stringify(m));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
test("archive capture and normalize paths retain metadata without modifying data version",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(html,/function normalizeArchiveDeploymentSnapshot\(value\)/);
 assert.match(html,/deploymentSnapshot:normalizeArchiveDeploymentSnapshot\(a.deploymentSnapshot\)/);
 assert.match(html,/const deploymentSnapshot=\{version:1,capturedAt:Date.now\(\)/);
 assert.match(html,/const DATA_VERSION=9/);
});


test("offseason shortcut opens newest verified season and deployment panel; normal archive stays unchanged",async()=>{
 const before=global.document;
 const dom=new JSDOM('<section id="view-archive" class="active">'+
  '<button id="cwlGroupArchiveRefresh"></button><div id="cwlGroupArchiveContent"></div></section>');
 global.document=dom.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const latest=plan(),older={...plan(),id:"old",sourceSeason:"2026-10",
   cwlLive:{...plan().cwlLive,season:"2026-10"}};
  const unverified={...plan(),id:"manual",sourceSeason:null,cwlLive:null,createdAt:Date.now()};
  const view=createCwlGroupArchiveView({
   sb:{from(){throw Error("offline should not fetch")}},
   getClanId:()=>null,isConnected:()=>false,getClanTag:()=>clan,
   getProfile:()=>({archives:[older,unverified,latest]}),isViewer:()=>true
  });
  const host=dom.window.document.getElementById("cwlGroupArchiveContent");
  await view.open();
  assert.equal(host.querySelector(".season-archive-item").open,false);
  assert.equal(host.querySelector("[data-unified-panel]").dataset.unifiedPanel,"rounds");
  await view.openLatestDeployments();
  const boxes=[...host.querySelectorAll(".season-archive-item")];
  assert.equal(boxes.length,3);
  assert.equal(boxes[0].dataset.archiveKey,"season:"+season+"|"+clan);
  assert.equal(boxes[0].open,true);
  assert.equal(boxes[0].querySelector("[data-unified-panel]").dataset.unifiedPanel,"deployments");
  assert.equal(boxes[0].querySelector('[data-unified-archive-tab="deployments"]').getAttribute("aria-selected"),"true");
  assert.match(boxes[0].textContent,/Plan und Clash/);
  assert.equal(boxes[1].open,false);
  assert.equal(boxes[2].open,false);
  assert.equal(host.querySelectorAll("[data-unified-delete-id]").length,0);
 }finally{
  if(before===undefined)delete global.document;else global.document=before;
  dom.window.close();
 }
});
test("latest deployment shortcut tolerates empty archive and discards late prior-clan response",async()=>{
 const before=global.document;
 const dom=new JSDOM('<section id="view-archive" class="active">'+
  '<div id="cwlGroupArchiveContent"></div></section>');
 global.document=dom.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  let id=null,resolve;
  const view=createCwlGroupArchiveView({
   sb:{from(){return{select(){return this},eq(){return this},order(){return this},
    limit(){return new Promise(r=>{resolve=r})}}}},
   getClanId:()=>id,isConnected:()=>!!id,getClanTag:()=>clan,
   getProfile:()=>({archives:[]})
  });
  const host=dom.window.document.getElementById("cwlGroupArchiveContent");
  await view.openLatestDeployments();
  assert.match(host.textContent,/Noch keine CWL archiviert/);
  id="old-clan";
  const pending=view.openLatestDeployments();
  id="new-clan";
  dom.window.document.getElementById("view-archive").classList.remove("active");
  view.invalidate();
  resolve({data:[{season,group_json:league()}],error:null});
  await pending;
  assert.equal(host.querySelector(".season-archive-item"),null);
  assert.equal(host.querySelector('[data-unified-panel="deployments"]'),null);
 }finally{
  if(before===undefined)delete global.document;else global.document=before;
  dom.window.close();
 }
});
