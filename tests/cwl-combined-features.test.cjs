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
const normStart=html.indexOf("function normalizeMember("),normEnd=html.indexOf("function normalizeArchive(",normStart);
const normalize=vm.runInNewContext(html.slice(normStart,normEnd)+"\nnormalizeMember",{
 uid:()=> "id",freshMember:()=>({}),normalizePlayerTag:s=>String(s||"").trim().toUpperCase(),STRENGTH_LABELS:{unknown:"Unbekannt"}
});
const rosterStart=sync.indexOf("function rosterPlanningState(");
const rosterEnd=sync.indexOf("async function audit(){",rosterStart);
assert.ok(rosterStart>0&&rosterEnd>rosterStart);
const rosterCode=sync.slice(rosterStart,rosterEnd);
const mk=(id,opts={})=>({id,name:id,playerTag:"",participating:true,fixed:false,priority:0,
 rotationWeight:"balanced",targetDays:null,statuses:Array(7).fill("auto"),note:"",...opts});
const setup=()=>{
 const fix=Array.from({length:14},(_,i)=>mk("fix"+i,{fixed:true}));
 const a=mk("A",{playerTag:"#AAA",targetDays:5,rotationWeight:"preferred",note:"Vor der CWL"});
 const b=mk("B",{playerTag:"#BBB",rotationWeight:"less"});
 const members=[...fix,a,b],lockedLineup=[...fix.map(m=>m.id),"A"];
 const locks=[{locked:true,lineup:lockedLineup,snapshots:{A:{name:"Historischer Spieler",townHall:17}}}];
 return {members,archivedMembers:[],config:{slots:15,days:7},locks,a,b};
};
async function syncRoster(p,remote){
 const ctx={
  role:"owner",roster:remote,rosterDiff:{critical:[],initialImport:false},ensureSaved:async()=>{},
  document:{querySelectorAll:()=>[]},normalizeTag:x=>String(x||"").toUpperCase(),
  storage:{getProfile:()=>p,newMember:()=>{throw Error("Unexpected duplicate")},rerender:()=>{}},
  resetRoster:()=>{},toggle:()=>{},msg:()=>{}
 };
 const apply=vm.runInNewContext(rosterCode+"\napplyRoster",ctx);
 await apply();
}
const roster=(withA)=>[...(withA?[{tag:"#AAA",name:"API Renamed",townHallLevel:19}]:[]),
 {tag:"#BBB",name:"B",townHallLevel:19}];

test("exact targets, locked history and restored status survive a full leave/rejoin roundtrip",async()=>{
 const p=setup(),before=JSON.stringify(p.locks);
 assert.equal(planCwl({members:p.members,locks:p.locks,slots:15,days:7}).counts.A,5);
 await syncRoster(p,roster(false));
 assert.equal(p.a.participating,false);
 assert.equal(p.a.cocSyncState,"former");
 assert.equal(p.a.cocBeforeDeparture.before.rotationWeight,"preferred");
 assert.equal(p.a.cocBeforeDeparture.before.note,"Vor der CWL");
 await syncRoster(p,roster(true));
 assert.equal(p.a.participating,true);
 assert.equal(p.a.cocSyncState,undefined);
 assert.equal(p.a.rotationWeight,"preferred");
 assert.equal(p.a.note,"Vor der CWL");
 assert.equal(p.a.name,"API Renamed");
 assert.equal(p.a.townHall,19);
 const normalized=normalize(p.a);
 assert.equal(normalized.targetDays,5);
 assert.equal(normalized.note,"Vor der CWL");
 assert.equal(normalized.rotationWeight,"preferred");
 assert.equal(JSON.stringify(p.locks),before);
 const result=planCwl({members:p.members,locks:p.locks,slots:15,days:7});
 assert.equal(result.ok,true,JSON.stringify(result.conflicts));
 assert.equal(result.counts.A,5);
 assert.equal(result.counts.B,2);
 assert.equal(result.playedCounts.A,1);
});
test("editing note and rotation while absent does not get silently reverted",async()=>{
 const p=setup();
 await syncRoster(p,roster(false));
 p.a.cocBeforeDeparture.edited.note=true;
 p.a.cocBeforeDeparture.edited.rotationWeight=true;
 p.a.note='<script>alert("x")</script>';
 p.a.rotationWeight="less";
 await syncRoster(p,roster(true));
 assert.equal(p.a.note,'<script>alert("x")</script>');
 assert.equal(p.a.rotationWeight,"less");
 const esc=vm.runInNewContext(html.slice(html.indexOf("function esc("),html.indexOf("function emptyDayGoal("))+"\nesc");
 assert.equal(esc(p.a.note),"&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
 assert.match(html,/member-note-preview/);
 assert.match(html,/\$\{esc\(m\.note\)\}/);
});
test("editor rights, legacy rotation and notes coexist without mutating offline PWA",()=>{
 assert.match(html,/member-rotation-weight/);
 assert.match(html,/member-note-btn/);
 assert.match(html,/markRosterAbsenceEdit\(m,"note"\)/);
 assert.match(sync,/hasApiClan:\(\)=>!!clans\.find/);
 assert.match(sync,/assertPlanningReady\(proposal\)/);
 assert.match(sync,/assertPlanningReady\(proposed\.suggested_profile\)/);
 assert.match(sync,/unusuallyManyDeparted/);
 assert.match(fs.readFileSync(path.join(root,"index.html"),"utf8"),/const APP_VERSION="v1\.0\.2";/);
});
