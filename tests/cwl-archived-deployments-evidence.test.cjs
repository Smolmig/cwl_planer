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
test("archive capture and normalize paths retain metadata without modifying data version",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(html,/function normalizeArchiveDeploymentSnapshot\(value\)/);
 assert.match(html,/deploymentSnapshot:normalizeArchiveDeploymentSnapshot\(a.deploymentSnapshot\)/);
 assert.match(html,/const deploymentSnapshot=\{version:1,capturedAt:Date.now\(\)/);
 assert.match(html,/const DATA_VERSION=9/);
});
