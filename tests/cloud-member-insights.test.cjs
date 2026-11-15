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

test("Member sort switches from last-seven raw quote to CWL/CW form evidence",()=>{
 assert.match(html,/value="recent-stars"/);
 assert.match(html,/Formwert · letzte CWL\/CWs/);
 assert.match(html,/getMemberForm/);
 assert.match(html,/recentOption\.hidden=!window\.CWLCloud\?\.active/);
 assert.match(html,/member-form-summary/);
 assert.doesNotMatch(html,/3★-Quote · letzte 7 Angriffe/);
});
test("Member badge labels CWL or CW fallback and does not invent form for missing data",()=>{
 const start=html.indexOf("function memberPerformance(m){");
 const end=html.indexOf("window.CWLRefreshMembers",start);
 assert.ok(start>0&&end>start);
 const code=html.slice(start,end);
 const model={
  preferred:{formIndex:80,performanceIndex:70,hitRate:95,attacks:12,
             reliability:100},cwl:{attacks:12},cw:{attacks:3,formIndex:55}
 };
 const window={CWLCloud:{active:true},CWLCloudStats:{
   getMemberForm:()=>({...model,source:"cwl"})}};
 const render=vm.runInNewContext(code+"\nmemberPerformance({playerTag:'#PYYY',threeStar:'high'})",{
   window,esc:String,STRENGTH_SHORT:{}
 });
 assert.match(render,/CWL-Form 80\/100/);
 assert.match(render,/Zuverlässigkeit 100 %/);
 assert.match(render,/CW 55\/100/);
 window.CWLCloudStats.getMemberForm=()=>({...model,source:"cw-fallback",preferred:model.cw,cwl:{attacks:0},cw:model.cw});
 const fallback=vm.runInNewContext(code+"\nmemberPerformance({playerTag:'#PQLV'})",{
   window,esc:String,STRENGTH_SHORT:{}
 });
 assert.match(fallback,/CW-Form 55\/100/);
 assert.match(fallback,/CW statt CWL/);
 window.CWLCloudStats.getMemberForm=()=>({source:"none",preferred:null});
 assert.match(vm.runInNewContext(code+"\nmemberPerformance({playerTag:'#PQLV'})",{
   window,esc:String,STRENGTH_SHORT:{}
 }),/Keine belegten Einsätze/);
});
test("Member form sorting uses conservative scores and keeps missing evidence last",()=>{
 const start=html.indexOf("function getDisplayMembers(){");
 const end=html.indexOf("function availabilityLabel(",start);
 assert.ok(start>0&&end>start);
 const samples={
  "#A":{formIndex:55,attacks:1,averageStars:3},
  "#B":{formIndex:88,attacks:7,averageStars:2.8},
  "#C":{formIndex:72,attacks:7,averageStars:2.7},
  "#E":{formIndex:82,attacks:2,averageStars:3}
 };
 const state={config:{memberSort:"strength"},members:[
  {name:"A one",playerTag:"#A"},
  {name:"D no-data",playerTag:"#D"},
  {name:"C medium",playerTag:"#C"},
  {name:"E two",playerTag:"#E"},
  {name:"B seven",playerTag:"#B"}
 ]};
 const win={CWLCloud:{active:true},CWLCloudStats:{
  getMemberForm:tag=>samples[tag]?{preferred:samples[tag]}:null
 }};
 const sorted=vm.runInNewContext(html.slice(start,end)+"\ngetDisplayMembers()",{
  state,window:win,STRENGTH_RANK:{}
 });
 assert.deepEqual(Array.from(sorted,x=>x.name),[
  "B seven","E two","C medium","A one","D no-data"
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
 assert.match(html,/Neu in v1\.23\.1/);
});
