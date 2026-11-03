"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const start=sync.indexOf("function rosterPlanningState(");
const end=sync.indexOf("async function audit(){",start);
assert.ok(start>0&&end>start,"pure departure / return helpers are available");
const code=sync.slice(start,end);
const base=()=>({id:"old",name:"Original",playerTag:"#2PYL",participating:true,
 fixed:true,priority:4,rotationWeight:"preferred",targetDays:3,note:"Nur bei Bedarf",
 statuses:["must","auto","out","auto","auto","auto","auto"],townHall:18});
const profile=(member)=>({members:[member],locks:[{locked:true,lineup:[member.id],
 snapshots:{[member.id]:{id:member.id,name:"Historischer Name",townHall:17}}}]});
async function apply(p,roster=[],critical=[],values={}){
 let saves=0,rerenders=0;
 const ctx={
   role:"owner",roster,rosterDiff:{critical,initialImport:false},
   normalizeTag:tag=>String(tag||"").trim().toUpperCase(),
   ensureSaved:async()=>{saves++},
   document:{querySelectorAll:()=>Object.entries(values).map(([playerId,value])=>({dataset:{playerId},value}))},
   storage:{getProfile:()=>p,newMember:name=>({id:"new",name,participating:true}),
     rerender:()=>{rerenders++}},
   toggle:()=>{},msg:()=>{},resetRoster:()=>{}
 };
 const handler=vm.runInNewContext(code+"\napplyRoster",ctx);
 await handler();
 return {saves,rerenders};
}
const incoming=(name="API Name")=>[{tag:"#2PYL",name,townHallLevel:19}];
test("departure and return preserve the full last valid state, tag, ID and historical lineup",async()=>{
 const m=base(),p=profile(m),original=JSON.parse(JSON.stringify(m));
 await apply(p);
 assert.equal(m.cocSyncState,"former");
 assert.equal(m.participating,false);
 assert.equal(m.cocBeforeDeparture.before.participating,true);
 assert.equal(m.cocBeforeDeparture.before.priority,4);
 assert.equal(m.cocBeforeDeparture.before.note,"Nur bei Bedarf");
 assert.equal(m.cocBeforeDeparture.before.rotationWeight,"preferred");
 await apply(p,incoming("Renamed via API"));
 assert.equal(m.cocSyncState,undefined);
 assert.equal(m.cocBeforeDeparture,undefined);
 assert.equal(m.id,"old");assert.equal(m.playerTag,original.playerTag);
 assert.equal(m.name,"Renamed via API");assert.equal(m.townHall,19);
 for(const key of ["participating","fixed","priority","rotationWeight","targetDays","note"])
   assert.equal(m[key],original[key],key);
 assert.equal(JSON.stringify(m.statuses),JSON.stringify(original.statuses));
 assert.equal(p.members.length,1);
 assert.equal(p.locks[0].lineup[0],"old");
 assert.equal(p.locks[0].snapshots.old.name,"Historischer Name");
});
test("a paused player remains paused when returning",async()=>{
 const m=base(),p=profile(m);m.participating=false;
 await apply(p);
 assert.equal(m.cocBeforeDeparture.before.participating,false);
 await apply(p,incoming());
 assert.equal(m.participating,false);
});
test("user edits while absent survive, including intentionally staying paused",async()=>{
 const m=base(),p=profile(m);
 await apply(p);
 m.cocBeforeDeparture.edited.participating=true; // user deliberately chose Pause, same as auto value
 m.cocBeforeDeparture.edited["statuses.0"]=true;
 m.statuses[0]="out";m.fixed=false;m.targetDays=2;m.rotationWeight="less";m.priority=1;m.note="Neue Notiz";
 await apply(p,incoming());
 assert.equal(m.participating,false);
 assert.equal(m.statuses[0],"out");
 assert.equal(m.fixed,false);assert.equal(m.targetDays,2);assert.equal(m.rotationWeight,"less");
 assert.equal(m.priority,1);assert.equal(m.note,"Neue Notiz");
});
test("repeated roster comparisons never overwrite changes while a player is already absent",async()=>{
 const m=base(),p=profile(m);await apply(p);
 const previous=JSON.stringify(m.cocBeforeDeparture);
 m.fixed=false;m.note="Während Abwesenheit";
 await apply(p,[]);assert.equal(m.fixed,false);
 assert.equal(m.note,"Während Abwesenheit");
 assert.equal(JSON.stringify(m.cocBeforeDeparture),previous);
});
test("a second leave/rejoin cycle captures the newly restored/current state",async()=>{
 const m=base(),p=profile(m);
 await apply(p);await apply(p,incoming());
 m.fixed=false;m.targetDays=2;m.note="Für nächste CWL";
 await apply(p);
 assert.equal(m.cocBeforeDeparture.before.fixed,false);
 assert.equal(m.cocBeforeDeparture.before.targetDays,2);
 await apply(p,incoming());
 assert.equal(m.fixed,false);assert.equal(m.targetDays,2);assert.equal(m.note,"Für nächste CWL");
});
test("explicit keep and old former records without a snapshot are not unexpectedly reactivated",async()=>{
 const m=base(),p=profile(m);
 await apply(p,[],[{member:m,days:[1]}],{old:"keep"});
 assert.equal(m.cocSyncState,"kept");assert.equal(m.participating,true);
 await apply(p,incoming());assert.equal(m.participating,true);
 const old=base(),q=profile(old);
 old.participating=false;old.cocSyncState="former";
 await apply(q,incoming());assert.equal(old.participating,false);
});
test("manual edits are explicitly marked in the cloud member controls",()=>{
 assert.match(html,/function markRosterAbsenceEdit\(m,field\)/);
 for(const field of ["participating","fixed","targetDays","statuses\."])
   assert.ok(html.includes('markRosterAbsenceEdit(m,"'+field.replace("\\","")),"edit marker: "+field);
 assert.match(sync,/if\(m\.cocSyncState==="kept"\|\|m\.cocSyncState==="former"\)continue/);
 assert.match(html,/m\.cocBeforeDeparture\.edited\.rotationWeight=true/);
});

test("a new CWL clears absent-player day rules and exact targets without reviving old ones",async()=>{
 const m=base(),p=profile(m);
 await apply(p);
 assert.equal(m.cocBeforeDeparture.before.targetDays,3);
 const a=html.indexOf("function resetPlanningData(){");
 const b=html.indexOf("async function handleCwlManage",a);
 assert.ok(a>0&&b>a);
 const reset=vm.runInNewContext(html.slice(a,b)+"\nresetPlanningData",{
  state:p,emptyDayGoal:()=>({townHall:{},strength:{}}),
  mobileSelectedDay:null,mobileLineupsExpanded:false
 });
 reset();
 assert.equal(m.targetDays,null);
 assert.equal(m.cocBeforeDeparture.before.targetDays,null);
 assert.ok(m.cocBeforeDeparture.before.statuses.every(x=>x==="auto"));
 await apply(p,incoming());
 assert.equal(m.targetDays,null);
 assert.ok(m.statuses.every(x=>x==="auto"));
 assert.equal(m.participating,true,"participation from before departure still restored");
});
test("snapshot is never applied if its stored tag differs from returning player tag",async()=>{
 const m=base(),p=profile(m);await apply(p);
 m.cocBeforeDeparture.tag="#WRONG";
 await apply(p,incoming());
 assert.equal(m.participating,false);
 assert.equal(m.cocBeforeDeparture,undefined);
});

test("kept players are also detected as returned members without API name/RH changes",()=>{
 const detection=sync.slice(sync.indexOf("const updated=[...rosterMap.values()]"),sync.indexOf("roster=incoming;"));
 assert.match(detection,/\["former","kept"\]\.includes\(current\.cocSyncState\)/);
});
test("roster snapshot is deep-cloned when a profile is copied",()=>{
 const from=html.indexOf("function cloneProfile(p,newName){"),to=html.indexOf("function resetProfileCompletely(){",from);
 assert.ok(from>0&&to>from);
 const clone=vm.runInNewContext(html.slice(from,to)+"\ncloneProfile",{
  uid:(()=>{let n=0;return()=>String(++n)})(),
  cloneGoal:()=>({}),normalizeProfile:p=>p,structuredClone
 });
 const m=base(),p=profile(m);
 m.cocBeforeDeparture={tag:m.playerTag,before:{participating:true,statuses:["must"]},
  automatic:{participating:false,statuses:["must"]},edited:{}};
 p.dayGoals=[];p.archives=[];p.config={days:7,slots:15};
 const copy=clone(p,"Kopie"),other=copy.members[0];
 assert.notEqual(copy.id,p.id);
 assert.notEqual(other.id,m.id);
 assert.notStrictEqual(other.cocBeforeDeparture,m.cocBeforeDeparture);
 other.cocBeforeDeparture.before.statuses[0]="out";
 assert.equal(m.cocBeforeDeparture.before.statuses[0],"must");
 assert.equal(copy.locks[0].snapshots[other.id].name,"Historischer Name");
});
test("backup-supplied malformed snapshot values are normalized before restoring",async()=>{
 const m=base(),p=profile(m);await apply(p);
 m.cocBeforeDeparture.before.priority=999;
 m.cocBeforeDeparture.before.statuses[0]="invalid-html";
 await apply(p,incoming());
 assert.equal(m.priority,5);
 assert.equal(m.statuses[0],"auto");
});
test("bulk changes while absent register deliberate overrides",()=>{
 assert.match(html,/function applyBulkValue\(field,value\)/);
 assert.match(html,/markRosterAbsenceEdit\(m,field\);m\[field\]=value/);
});
