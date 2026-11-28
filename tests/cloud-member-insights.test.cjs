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

test("Member sort exposes explicit modes and personal preferences",()=>{
 for(const mode of ["form-cw","form-cwl","form-combined","recent-stars"])assert.ok(html.includes('value="'+mode+'"'));
 assert.match(html,/CW-Form · 30 Tage/);assert.match(html,/CWL-Form · letzte Liga/);
 assert.match(html,/Kombi-Form · 30 Tage/);assert.match(html,/member-form-summary/);
 assert.match(sync,/getMemberSortPreference/);assert.match(sync,/setMemberSortPreference/);
 assert.match(html,/setMemberSortPreference\?\.\(e\.target\.value\);renderMembers\(\);return/);
});
test("Member badge follows the selected metric and labels historical or missing evidence",()=>{
 const start=html.indexOf("function memberPerformance(m){"),end=html.indexOf("window.CWLRefreshMembers",start);
 const model={cwl:{formIndex:80,performanceIndex:70,hitRate:95,attacks:12,tier:0,season:"2026-11",currentReliability:100},
  cw:{attacks:3,formIndex:55,tier:1,currentReliability:80,currentMissedKnown:1},combined:{attacks:15,formIndex:70,averageStars:2.7,tier:0}};
 let mode="form-cwl";
 const window={CWLCloud:{active:true},CWLCloudStats:{getMemberFormV2:()=>model}};
 const render=()=>vm.runInNewContext(html.slice(start,end)+"\nmemberPerformance({playerTag:'#PYYY'})",{
 window,esc:String,STRENGTH_SHORT:{},memberViewSort:()=>mode,memberFormMode:m=>m==="form-cwl"?"cwl":m==="form-cw"?"cw":"combined"
 });
 assert.match(render(),/CWL-Form 80\/100/);assert.match(render(),/2026-11/);
 assert.match(render(),/Zuverlässigkeit im gewählten Zeitraum 100 %/);
 mode="form-cw";assert.match(render(),/CW-Form 55\/100/);assert.match(render(),/Kleine Stichprobe/);
 mode="form-combined";assert.match(render(),/Kombi-Form 70\/100/);
 mode="recent-stars";assert.match(render(),/Ø Sterne 2[,.]70/);
 mode="form-cw";model.cw={tier:3,historical:true,formIndex:99,attacks:4,newest:"2026-09-10",currentReliability:null};
 assert.match(render(),/Ältere Daten/);
 model.cw={tier:4,attacks:0};assert.match(render(),/Keine vergleichbaren Angriffe/);
});
test("Member help explains same-RH sample, verified missed attacks and Clash town hall",()=>{
 assert.match(html,/Rathausstufe \$\{m\.townHall\?\?"–"\} · aus Clash übernommen/);
 assert.match(html,/Formwerte in Mitglieder/);assert.match(html,/Zuverlässigkeit berücksichtigt alle belegten/);
 assert.match(html,/getMemberFormV2\?\.\(m\.playerTag\)/);
});
test("Member sort and displayed evidence use the same selected scope",async()=>{
 const {compareMemberFormV2}=await import("../cwl-stats-core.mjs");
 const start=html.indexOf("function memberViewSort(){"),end=html.indexOf("function availabilityLabel(",start);
 const samples={
 "#A":{cw:{tier:3,formIndex:99,attacks:3},cwl:{tier:0,formIndex:90,attacks:7}},
 "#B":{cw:{tier:0,formIndex:88,attacks:7},cwl:{tier:1,formIndex:60,attacks:2}},
 "#C":{cw:{tier:1,formIndex:72,attacks:3},cwl:{tier:4,attacks:0}}
 };
 const state={config:{memberSort:"strength"},members:["A","B","C","D"].map(x=>({name:x,playerTag:"#"+x}))};
 let mode="form-cw";
 const window={CWLCloud:{active:true,getMemberSortPreference:()=>mode},CWLCloudStats:{getMemberFormV2:tag=>samples[tag],compareMemberFormV2}};
 const sort=()=>Array.from(vm.runInNewContext(html.slice(start,end)+"\ngetDisplayMembers()",{state,window,STRENGTH_RANK:{}}),x=>x.name);
 assert.deepEqual(sort(),["B","C","A","D"]);mode="form-cwl";assert.deepEqual(sort(),["A","B","C","D"]);
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
 assert.match(html,/Neu in v1\.41\.0/);
});
