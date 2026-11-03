"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const cloud=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const {planCwl}=require(path.join(root,"cwl-planning-core.js"));
const start=cloud.indexOf("function assertPlanningReady(profile){");
const end=cloud.indexOf("function suggestionChanges(",start);
assert.ok(start>=0&&end>start);
const member=(id,o={})=>({id,name:id,participating:true,fixed:false,priority:0,
 targetDays:null,statuses:Array(7).fill("auto"),...o});
const profile=(a={},b={})=>({config:{slots:15,days:7},archivedMembers:[],locks:[],
 members:[...Array.from({length:14},(_,i)=>member("fix"+i,{fixed:true})),
  member("A",a),member("B",b)]});
const build=(core)=>vm.runInNewContext(cloud.slice(start,end)+"\nassertPlanningReady",{
 window:{CWLPlanningCore:core?{planCwl}:{}}
});
test("Owner may approve an exactly feasible global plan",()=>{
 const approve=build(true),p=profile({targetDays:5});
 const before=JSON.stringify(p);
 const res=approve(p);
 assert.equal(res.ok,true);
 assert.equal(res.counts.A,5);
 assert.equal(res.counts.B,2);
 assert.equal(JSON.stringify(p),before,"approval checks must not mutate stored profile");
});
test("Owner cannot approve 5+5 target conflict, nor a plan with played 3 vs target 2",()=>{
 const approve=build(true);
 assert.throws(()=>approve(profile({targetDays:5},{targetDays:5})),/nicht freigabefähig/);
 const p=profile({targetDays:2});
 p.locks=Array.from({length:3},()=>({
  locked:true,lineup:[...p.members.filter(m=>m.fixed).map(m=>m.id),"A"]
 }));
 assert.throws(()=>approve(p),/Bereits 3 Einsätze gespielt/);
});
test("No approval when planner engine fails to load or profile is invalid",()=>{
 assert.throws(()=>build(false)(profile()),/nicht verfügbar/);
 assert.throws(()=>build(true)(null),/Keine gültige CWL-Planung/);
});
test("Owner lock, editor submission and owner acceptance all enforce validation",()=>{
 assert.match(cloud,/if\(lock\)assertPlanningReady\(storage\.getProfile\(\)\)/);
 assert.match(cloud,/assertPlanningReady\(proposal\)/);
 assert.match(cloud,/assertPlanningReady\(proposed\.suggested_profile\)/);
 assert.match(cloud,/toggleButton\.disabled=invalid/);
 assert.match(cloud,/submitButton\.disabled=!changedSerial\|\|storage\.getPlanningState/);
 assert.match(html,/getPlanningState:\(\)=>\(\{ok:lastPlan\?\.ok!==false/);
});
