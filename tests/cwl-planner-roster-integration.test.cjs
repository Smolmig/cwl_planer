"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const {planCwl}=require(path.join(root,"cwl-planning-core.js"));
const m=(id,o={})=>({id,name:id,participating:true,fixed:false,targetDays:null,
 priority:0,rotationWeight:"balanced",statuses:Array(7).fill("auto"),...o});

test("both features share a compatible model and preserve saved return snapshots",()=>{
 const a=html.indexOf("function normalizeMember(m){");
 const b=html.indexOf("function normalizeArchive(",a);
 const norm=vm.runInNewContext(html.slice(a,b)+"\nnormalizeMember",{
  freshMember:()=>({}),uid:()=>"id",
  normalizePlayerTag:x=>String(x||""),STRENGTH_LABELS:{unknown:"unknown"}
 });
 const original={...m("A",{participating:false,cocSyncState:"former",rotationWeight:null,priority:4}),
  threeStar:"unknown",cocBeforeDeparture:{tag:"#ABC",before:{
  participating:true,targetDays:5,rotationWeight:null,priority:4,
  statuses:Array(7).fill("auto")},automatic:{participating:false},edited:{}}};
 original.playerTag="#ABC";
 const n=norm(original);
 assert.equal(n.priority,4);
 assert.equal(n.rotationWeight,null,"legacy weight must remain unconverted");
 assert.equal(n.cocBeforeDeparture.before.targetDays,5);
 assert.equal(n.cocBeforeDeparture.before.priority,4);
 assert.equal(n.cocSyncState,"former");
});
test("returned-player edit tracking and hard plan approval coexist",()=>{
 assert.match(html,/function markRosterAbsenceEdit\(m,field\)/);
 assert.match(html,/m\.cocBeforeDeparture\.edited\.rotationWeight=true/);
 assert.match(html,/markRosterAbsenceEdit\(m,"targetDays"\)/);
 assert.match(sync,/function restoreRosterReturn\(m\)/);
 assert.match(sync,/function assertPlanningReady\(profile\)/);
 assert.match(sync,/assertPlanningReady\(proposal\)/);
 assert.match(sync,/\["former","kept"\]\.includes\(current\.cocSyncState\)/);
});
test("a departed member cannot receive new slots, even with old target / priority",()=>{
 const members=[...Array.from({length:14},(_,i)=>m("fix"+i,{fixed:true})),
  m("A",{targetDays:5,rotationWeight:"preferred"}),
  m("B"),m("former",{participating:true,cocSyncState:"former",targetDays:4,priority:5,rotationWeight:null})];
 const p=planCwl({members,slots:15,days:7});
 assert.equal(p.ok,true,JSON.stringify(p.conflicts));
 assert.equal(p.counts.A,5);
 assert.equal(p.counts.B,2);
 assert.equal(p.counts.former,0);
});
