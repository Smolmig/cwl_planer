"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");

test("Cloud member sort uses the evidence-based form and documented reliability",()=>{
 assert.match(html,/value="recent-stars"/);
 assert.match(html,/getMemberFormSummary/);
 assert.match(html,/recentOption\.hidden=!window\.CWLCloud\?\.active/);
 assert.match(html,/Zuverlässigkeit \(belegt\)/);
 assert.match(html,/Formwert · letzte CWL \/ 5 CWs/);
});
test("Historical 7-attack sample remains independently accurate for plan cards",async()=>{
 const {computeRecentAttackStats}=await import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")).href);
 const wars=[{war_key:"old",started_at:"2026-10-01T00:00:00Z",source:"import"},
             {war_key:"new",started_at:"2026-11-01T00:00:00Z",source:"api",finalized:true}];
 const rows=[
  ...Array.from({length:5},(_,i)=>({war_key:"old",attacker_tag:"#2PYL",stars:0,attack_order:i+1})),
  ...Array.from({length:5},(_,i)=>({war_key:"new",attacker_tag:"#2PYL",stars:i%2?2:3,attack_order:i+1}))
 ];
 const recent=computeRecentAttackStats(wars,rows,7).get("#2PYL");
 assert.equal(recent.attacks,7);
 assert.equal(recent.averageStars,Math.round((3+2+3+2+3)/7*100)/100);
 assert.equal(recent.hitRate,Math.round(3/7*100));
 assert.match(html,/function memberCompactPerformance/);
});
test("Cloud roster form sort uses scores, sample tie-breakers, and missing-last positions",()=>{
 const start=html.indexOf("function getDisplayMembers(){");
 const end=html.indexOf("function availabilityLabel(",start);
 assert.ok(start>0&&end>start);
 const stats={
  "#A":{score:60,comparable:1,reliability:100,performed:1},
  "#B":{score:87,comparable:7,reliability:80,performed:7},
  "#C":{score:55,comparable:7,reliability:null,performed:7},
  "#E":{score:75,comparable:2,reliability:70,performed:2}
 };
 const state={config:{memberSort:"strength"},members:[
  {name:"A one",playerTag:"#A"},
  {name:"D no-data",playerTag:"#D"},
  {name:"C medium",playerTag:"#C"},
  {name:"E two",playerTag:"#E"},
  {name:"B seven",playerTag:"#B"}
 ]};
 const win={CWLCloud:{active:true},CWLCloudStats:{getMemberFormSummary:tag=>stats[tag]||null}};
 const sorted=vm.runInNewContext(html.slice(start,end)+"\ngetDisplayMembers()",{
  state,window:win,STRENGTH_RANK:{}
 });
 assert.deepEqual(Array.from(sorted,m=>m.name),[
  "B seven","E two","A one","C medium","D no-data"
 ]);
 assert.equal(state.config.memberSort,"strength");
});
test("Overview player opens day membership with played/planned status",()=>{
 assert.match(html,/summary-player-toggle/);
 assert.match(html,/summaryOpenMemberId===x\.m\.id/);
 assert.match(html,/lastPlan\.dayPlans\.filter\(dp=>dp\.lineup\.includes\(x\.m\.id\)\)/);
 assert.match(html,/summary-day-chip/);
});
test("Plan rebuild immediately re-attaches live CWL war cards",()=>{
 assert.match(html,/renderMobileDays\(\);window\.CWLCloud\?\.renderLive\?\.\(\)/);
 assert.match(sync,/renderLive\(\)\{if\(this\.active\)live\.render\(\)\}/);
 assert.match(live,/expandedDays\.has\(round\?\.day\)/);
});
test("Desktop theme and version notes are stacked while mobile remains unchanged",()=>{
 assert.match(html,/@media \(min-width:700px\)\{[\s\S]*?#view-settings \.settings-row:has\(#themeSelect\)/);
 assert.match(html,/Neu in v1\.23\.0/);
});
