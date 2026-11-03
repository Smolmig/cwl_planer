"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const start=sync.indexOf("function rosterPlanningState(");
const end=sync.indexOf("async function audit(){",start);
assert.ok(start>=0&&end>start,"Roster handler must remain testable");
const handler=sync.slice(start,end);

async function applyDecision(decision){
  const departed={id:"departed",name:"Benne",playerTag:"#2PYL",participating:true,fixed:true};
  const oldLock={locked:true,lineup:["departed"],snapshots:[]};
  const profile={members:[departed],locks:[oldLock,{locked:false,lineup:[]}]};
  let rerenders=0,saves=0;
  const context={
    role:"owner",
    roster:[],
    rosterDiff:{critical:[{member:departed,days:[1,2]}],initialImport:false},
    document:{querySelectorAll:()=>[{dataset:{playerId:"departed"},value:decision}]},
    ensureSaved:async()=>{saves++},
    normalizeTag:v=>String(v||"").toUpperCase(),
    storage:{getProfile:()=>profile,newMember:()=>{throw Error("unexpected new member")},rerender:()=>{rerenders++}},
    resetRoster:()=>{},
    toggle:()=>{},
    msg:()=>{}
  };
  const action=vm.runInNewContext(handler+"\napplyRoster",context);
  await action();
  return {departed,profile,oldLock,rerenders,saves};
}

test("Clan comparison offers two real CWL decisions, not a defer synonym",()=>{
  assert.match(sync,/new Option\("Weiterhin dabei","keep"\)/);
  assert.match(sync,/new Option\("Aus der CWL-Planung nehmen","remove"\)/);
  assert.doesNotMatch(sync,/new Option\("Vorerst nichts ändern","defer"\)/);
});

test("Keeping a departed CWL player preserves eligibility",async()=>{
  const {departed,oldLock,rerenders}=await applyDecision("keep");
  assert.equal(departed.participating,true);
  assert.equal(departed.cocSyncState,"kept");
  assert.deepEqual(oldLock.lineup,["departed"]);
  assert.equal(rerenders,1);
});

test("Removing a departed player excludes future wars but preserves locked history",async()=>{
  const {departed,profile,oldLock,rerenders,saves}=await applyDecision("remove");
  assert.equal(departed.participating,false);
  assert.equal(departed.cocSyncState,"former");
  assert.equal(profile.members.length,1,"preserve member record and player tag");
  assert.equal(departed.playerTag,"#2PYL");
  assert.deepEqual(oldLock.lineup,["departed"],"already played day remains unchanged");
  assert.equal(rerenders,1);
  assert.ok(saves>=2);
});

test("Undecided or obsolete values cannot silently pass the roster review",async()=>{
  await assert.rejects(applyDecision(""),/Bitte für alle Spieler/);
  await assert.rejects(applyDecision("defer"),/Bitte für alle Spieler/);
});

test("CWL error text distinguishes missing permissions and temporary war details",async()=>{
  const {cwlErrorMessage}=await import(pathToFileURL(path.join(root,"cwl-live.mjs")).href);
  assert.match(cwlErrorMessage("war_details_unavailable"),/Kriegsdetails/);
  assert.match(cwlErrorMessage("not_a_member"),/keinen Zugriff/);
  assert.match(cwlErrorMessage("upstream_unreachable"),/Plan bleibt erhalten/);
});
