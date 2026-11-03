"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const start=sync.indexOf("function manualRosterPending(){"),end=sync.indexOf("const currentSeason=",start);
assert.ok(start>=0&&end>start);
const enableCode=sync.slice(start,end);
function enableContext({role="owner",failed=true,pending=false,confirm=true,online=true}={}){
 const p={members:[],config:{slots:15,days:7},...(pending?{cocManualEmergency:{pending:true}}:{})};
 let writes=0,rerenders=0,confirmations=0;
 const enabled=[];
 const context={
  storage:{getProfile:()=>p,confirmAction:async()=>{confirmations++;return confirm},
   rerender:()=>{rerenders++},toast:()=>{}},
  role,rosterApiFailed:failed,clanId:"id",
  cloud:{active:true,hasApiClan:()=>true},
  navigator:{onLine:online},planIsLocked:()=>false,
  toggle:(id,v)=>enabled.push([id,v]),text:()=>{},
  ensureSaved:async()=>{writes++}
 };
 return {p,context,fn:vm.runInNewContext(enableCode+"\nenableRosterEmergency",context),
  stats:()=>({writes,rerenders,confirmations,enabled})};
}
test("emergency editing is explicit, confirmed, and survives a profile JSON roundtrip",async()=>{
 const a=enableContext();
 await a.fn();
 assert.equal(a.p.cocManualEmergency.pending,true);
 assert.ok(Number.isFinite(a.p.cocManualEmergency.since));
 assert.equal(a.stats().confirmations,1);
 assert.equal(a.stats().writes,1);
 assert.equal(a.stats().rerenders,1);
 assert.equal(JSON.parse(JSON.stringify(a.p)).cocManualEmergency.pending,true);
});
test("viewer, healthy API, offline Cloud or cancelled confirmation cannot start emergency editing",async()=>{
 for(const options of [{role:"viewer"},{failed:false},{online:false},{confirm:false}]){
  const a=enableContext(options);
  if(options.online===false)await assert.rejects(a.fn(),/Cloud ist offline/);
  else await a.fn();
  assert.equal(a.p.cocManualEmergency,undefined);
  assert.equal(a.stats().writes,0);
 }
});
test("manual emergency stays active until API comparison explicitly confirmed",async()=>{
 const p={members:[{id:"a",name:"Manual A",playerTag:"#AAA",participating:true,
  fixed:false,priority:0,statuses:Array(7).fill("auto"),townHall:17}],
  cocManualEmergency:{pending:true,since:123}};
 let approved=false,renders=0,saves=0;
 const context={
  role:"owner",roster:[{tag:"#AAA",name:"API A",townHallLevel:19}],
  rosterDiff:{critical:[],initialImport:false,departed:[]},
  document:{querySelectorAll:()=>[]},normalizeTag:x=>String(x||"").toUpperCase(),
  storage:{getProfile:()=>p,confirmAction:async()=>approved,
   newMember:()=>{throw Error("Unexpected add")},rerender:()=>{renders++}},
  ensureSaved:async()=>{saves++},
  refreshRosterEmergencyUI:()=>{},resetRoster:()=>{},toggle:()=>{},msg:()=>{},
  rosterApiFailed:false
 };
 const begin=sync.indexOf("async function applyRoster(){");
 const finish=sync.indexOf("async function audit(){",begin);
 const apply=vm.runInNewContext(sync.slice(begin,finish)+"\napplyRoster",context);
 await apply();
 assert.equal(p.members[0].name,"Manual A");
 assert.equal(p.members[0].townHall,17);
 assert.equal(p.cocManualEmergency.pending,true);
 assert.equal(renders,0);
 approved=true;await apply();
 assert.equal(p.members[0].name,"API A");
 assert.equal(p.members[0].townHall,19);
 assert.equal(p.cocManualEmergency,undefined);
 assert.equal(renders,1);
 assert.ok(saves>=2);
});
test("API mode blocks manual member tools and name/RH controls until emergency activated",()=>{
 for(const id of ["cloudEmergencyEnable","cloudEmergencyStatus","cloudManualMembers"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(sync,/manualRosterPending\(\)\|\|!\["owner","editor"\]\.includes\(role\)/);
 assert.match(sync,/rosterAutoBusy\|\|\(typeof manualRosterPending===/);
 assert.match(sync,/if\(p\.cocManualEmergency\?\.pending\)/);
 assert.match(sync,/toggle\("cloudManualMembers"/);
 assert.match(html,/\!window\.CWLCloud\?\.isEmergencyEditing\?\.\(\)/);
 assert.match(html,/member-api-th/);
 assert.match(html,/\$\{apiManaged\?""\:`<button class="btn small danger delete-member"/);
 assert.match(sync,/!cloud\.isEmergencyEditing\?\.\(\)/);
});
