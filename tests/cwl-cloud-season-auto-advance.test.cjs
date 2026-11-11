"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const live=fs.readFileSync(path.join(__dirname,"..","cwl-live.mjs"),"utf8");
const sync=fs.readFileSync(path.join(__dirname,"..","cloud-sync.mjs"),"utf8");
const begin=html.indexOf("archivePreviousCwlForRollover:");
const finish=html.indexOf("getPlanningState:",begin);
assert.ok(begin>0&&finish>begin);
const source="this.methods=({"+html.slice(begin,finish)+"});";

const make=(played=6,{owner=true,online=true,clanTag="#2PYL",throws=false,switchClan=false,
 existing=false}={})=>{
 const saved={season:"2026-11",clanTag:"#2PYL",rounds:
  Array.from({length:7},(_,i)=>({warTag:"#P9QL"+i,state:i<played?"warEnded":"inWar"}))};
 const profile={config:{days:7},cwlLive:saved,archives:existing?[{
  sourceSeason:"2026-11",complete:false,id:"previous"
 }]:[],locks:Array.from({length:7},(_,i)=>({
  locked:i<played,source:i<played?"coc-api":undefined,
  warTag:"#P9QL"+i,season:"2026-11"
 }))};
 const events={archives:0,saves:0,displays:0,resets:0,cycles:0,renderAll:0};
 const cloud={active:true,isOwner:()=>owner,hasApiClan:()=>true,
  getActiveClanId:()=>switchClan&&events.cycles?"clan-two":"clan-one",
  openNewCycle:async()=>{events.cycles++;if(throws)throw Error("Cloud conflict")}};
 const context={
  state:profile,window:{CWLCloud:cloud},navigator:{onLine:online},
  archiveCurrentCwl:()=>{events.archives++;return {
   sourceSeason:"2026-11",playedCount:played,complete:played===7,
   lineups:Array.from({length:played},(_,i)=>({day:i+1})),id:"season"
  }},
  renderArchives:()=>{events.displays++},
  saveApp:()=>{events.saves++},
  resetPlanningData:()=>{events.resets++;profile.locks=[];delete profile.cwlLive},
  renderAll:()=>{events.renderAll++}
 };
 vm.runInNewContext(source,context);
 return {...context,events,cloud,methods:context.methods};
};

test("A new official CWL automatically archives a six-day season as incomplete and restarts the planner",async()=>{
 const x=make(6);
 assert.equal(x.methods.archivePreviousCwlForRollover("2026-11","2026-12","#2PYL"),true);
 assert.equal(x.state.archives.length,1);
 assert.equal(x.state.archives[0].complete,false);
 assert.equal(x.state.archives[0].playedCount,6);
 assert.equal(x.events.saves,1);
 assert.equal(await x.methods.autoAdvanceCwl("2026-11","2026-12","#2PYL"),true);
 assert.equal(x.events.cycles,1);
 assert.equal(x.events.resets,1);
 assert.equal(x.events.renderAll,1);
 assert.equal(x.state.archives.length,1);
});
test("Seven same-war final locks are marked complete; unverified final remains incomplete",()=>{
 const full=make(7),unverified=make(7);
 unverified.state.cwlLive.rounds[6].state="inWar";
 assert.equal(full.methods.archivePreviousCwlForRollover("2026-11","2026-12","#2PYL"),true);
 assert.equal(full.state.archives[0].complete,true);
 assert.equal(unverified.methods.archivePreviousCwlForRollover("2026-11","2026-12","#2PYL"),true);
 assert.equal(unverified.state.archives[0].complete,false);
});
test("Repeat polling is idempotent and never duplicates an existing season archive",async()=>{
 const x=make(6,{existing:true});
 assert.equal(x.methods.archivePreviousCwlForRollover("2026-11","2026-12","#2PYL"),true);
 assert.equal(x.state.archives.length,1);
 assert.equal(x.events.archives,0);
 assert.equal(await x.methods.autoAdvanceCwl("2026-11","2026-12","#2PYL"),true);
 assert.equal(x.events.resets,1);
});
test("Wrong clan, older season, offline or viewer cannot automatically reset a Cloud plan",async()=>{
 for(const [options,prev,next,tag] of [
  [{owner:false},"2026-11","2026-12","#2PYL"],
  [{online:false},"2026-11","2026-12","#2PYL"],
  [{clanTag:"#2PYL"},"2026-11","2026-12","#8PYL"],
  [{},"2026-11","2026-10","#2PYL"],
  [{},"2026-11","2026-11","#2PYL"]
 ]){
  const x=make(6,options);
  assert.equal(x.methods.archivePreviousCwlForRollover(prev,next,tag),false);
  assert.equal(await x.methods.autoAdvanceCwl(prev,next,tag),false);
  assert.equal(x.events.resets,0);
  assert.equal(x.state.archives.length,0);
 }
});
test("Cloud RPC rejection or clan switch leaves the old played days intact",async()=>{
 for(const options of [{throws:true},{switchClan:true}]){
  const x=make(6,options);
  assert.equal(x.methods.archivePreviousCwlForRollover("2026-11","2026-12","#2PYL"),true);
  if(options.throws)
   await assert.rejects(x.methods.autoAdvanceCwl("2026-11","2026-12","#2PYL"));
  else
   assert.equal(await x.methods.autoAdvanceCwl("2026-11","2026-12","#2PYL"),false);
  assert.equal(x.events.resets,0);
  assert.equal(x.state.locks.filter(l=>l.locked).length,6);
  assert.equal(x.state.archives[0].playedCount,6);
 }
});
test("Connected Cloud removes the manual restart and uses API lifecycle, offline remains manual",()=>{
 assert.match(html,/manage\.hidden=!!window\.CWLCloud\?\.active&&!!window\.CWLCloud\.hasApiClan\?\.\(\)/);
 assert.match(html,/if\(cloud\?\.active&&cloud\.hasApiClan\?\.\(\)\)/);
 assert.match(sync,/manualNewSeason\.hidden=cloudCwlIsAutomatic/);
 assert.match(live,/archivePreviousCwlForRollover\?\.\(/);
 assert.match(live,/await storage\.autoAdvanceCwl\?\.\(/);
 assert.doesNotMatch(live,/old\.canAutoArchive&&storage\.archiveConfirmedCwl/);
});
