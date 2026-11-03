"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","cloud-sync.mjs"),"utf8");
const begin=source.indexOf("async function getRoster(");
const end=source.indexOf("function rosterPlanningState(",begin);
assert.ok(begin>=0&&end>begin);
const segment=source.slice(begin,end);
const make=(ids,serverMembers)=>{
 const members=ids.map(id=>({id,name:id,playerTag:"#"+id,participating:true, fixed:false,
   statuses:Array(7).fill("auto")}));
 let toastCount=0,renderCount=0;
 const elements=new Map();
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   textContent:"",style:{},hidden:false,
   classList:{remove(){},add(){}},replaceChildren(){},append(){},
   scrollIntoView(){}
  });
  return elements.get(id);
 };
 const ctx={
  clanId:"clan",role:"owner",changedSerial:null,saving:false,blocked:false,
  rosterAutoBusy:false,roster:null,rosterDiff:null,
  sb:{functions:{invoke:async()=>({data:{ok:true,members:serverMembers},error:null})}},
  storage:{getProfile:()=>({members}),getPlannedLineups:()=>[],
   toast:()=>{toastCount++;}},
  resetRoster:()=>{},ensureSaved:async()=>{},toggle:(id,value)=>{element(id).hidden=!value},
  text:(id,value)=>{element(id).textContent=value},$:(id)=>element(id),
  document:{createElement:()=>({textContent:"",style:{},append(){}})},
  normalizeTag:v=>String(v||"").toUpperCase(),
  console:{warn(){}},Date
 };
 const getRoster=vm.runInNewContext(segment+"\ngetRoster",ctx);
 return {ctx,members,getRoster,element,stats:()=>({toasts:toastCount,renders:renderCount})};
};
const from=(ids)=>ids.map(id=>({tag:"#"+id,name:id,townHallLevel:18}));
test("empty upstream roster cannot mark any existing player as departed",async()=>{
 const a=make(["ABC","DEF"],[]);
 const before=JSON.stringify(a.members);
 await assert.rejects(a.getRoster({automatic:true}),/unvollständige Mitgliederliste/);
 assert.equal(JSON.stringify(a.members),before);
 assert.equal(a.ctx.rosterDiff,null);
});
test("duplicate or malformed member tags never reach the departure comparison",async()=>{
 const cases=[
  [...from(["ABC"]),...from(["ABC"])],
  [...from(["ABC"]),{tag:"???",name:"broken"}],
  [...from(["ABC"]),null]
 ];
 for(const payload of cases){
  const a=make(["ABC","DEF"],payload);
  await assert.rejects(a.getRoster({automatic:true}),/unvollständige Mitgliederliste/);
  assert.equal(a.ctx.rosterDiff,null);
  assert.ok(a.members.every(m=>m.participating));
 }
});
test("abnormally large departures always require manual review, never auto-apply",async()=>{
 const original=Array.from({length:12},(_,i)=>"P"+i);
 const a=make(original,from(original.slice(0,6)));
 await a.getRoster({automatic:true});
 assert.equal(a.ctx.rosterDiff.unusuallyManyDeparted,true);
 assert.equal(a.ctx.rosterDiff.departed.length,6);
 assert.ok(a.members.every(m=>m.participating));
 assert.match(a.element("autoRosterStatus").textContent,/manuell prüfen/);
});
test("small valid roster changes retain automatic comparison behavior",async()=>{
 const original=Array.from({length:12},(_,i)=>"P"+i);
 const a=make(original,from(original));
 await a.getRoster({automatic:true});
 assert.equal(a.ctx.rosterDiff.unusuallyManyDeparted,false);
 assert.equal(a.ctx.rosterDiff.departed.length,0);
});
test("manual mass-departure confirmation can be cancelled before member mutation",async()=>{
 const start=source.indexOf("function rosterPlanningState(");
 const stop=source.indexOf("async function audit(){",start);
 const handler=source.slice(start,stop);
 const m={id:"a",name:"A",playerTag:"#ABC",participating:true,statuses:Array(7).fill("auto")};
 const p={members:[m]};let confirmations=0,renders=0;
 const context={
  role:"owner",roster:[],rosterDiff:{critical:[],departed:[m],unusuallyManyDeparted:true,initialImport:false},
  ensureSaved:async()=>{},
  document:{querySelectorAll:()=>[]},
  storage:{confirmAction:async()=>{confirmations++;return false},getProfile:()=>p,
   rerender:()=>{renders++}},
  normalizeTag:v=>String(v||"").toUpperCase(),resetRoster:()=>{},toggle:()=>{},msg:()=>{}
 };
 const fn=vm.runInNewContext(handler+"\napplyRoster",context);
 await fn();
 assert.equal(confirmations,1);
 assert.equal(renders,0);
 assert.equal(m.participating,true);
 assert.equal(m.cocSyncState,undefined);
});
