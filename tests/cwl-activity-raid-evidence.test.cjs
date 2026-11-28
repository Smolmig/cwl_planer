"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../cwl-activity-raid-evidence.mjs");
const clan="#2PYL",player="#8PYL";
const a={startTime:"20261106T070000.000Z",endTime:"20261109T070000.000Z"};
const b={startTime:"20261113T070000.000Z",endTime:"20261116T070000.000Z"};
const base={clanTag:clan,playerTag:player,startTime:a.startTime,endTime:b.endTime,expectedWeekends:[a,b],scheduleVerified:true};
const obs=(time,overrides={},state="ended",clanTag=clan)=>({clanTag,season:{...time,state,members:[{tag:player,attacks:5,attackLimit:5,bonusAttackLimit:0,capitalResourcesLooted:100,...overrides}]}});
test("completed raid weekends use individual limits, dedupe snapshots and include exact campaign boundaries",async()=>{
 const {evaluateRaidEvidence:e}=await load();
 const first=obs(a),second=obs(b,{attacks:3,bonusAttackLimit:1,capitalResourcesLooted:80});
 const r=e({...base,observations:[first,second,first]});
 assert.deepEqual(r.evidence.raidAttacks,{value:8,coverage:"complete"});
 assert.deepEqual(r.evidence.capitalGold,{value:180,coverage:"complete"});
 assert.equal(r.evidence.raidParticipationPct.value,800/11);
 assert.equal(r.coverage.observedWeekends,2);
});
test("missing member, ongoing weekend and foreign clan are not zeros or complete denominators",async()=>{
 const {evaluateRaidEvidence:e}=await load();
 const absent=obs(b);absent.season.members=[];
 const r=e({...base,observations:[obs(a),absent,obs(b,{},"ongoing"),obs(b,{},"ended","#Q9QL")]});
 assert.deepEqual(r.evidence.raidAttacks,{value:5,coverage:"lower_bound"});
 assert.deepEqual(r.evidence.raidParticipationPct,{value:null,coverage:"unknown"});
 assert.equal(r.coverage.observedWeekends,1);
});
test("conflicting duplicates and impossible attacks fail closed",async()=>{
 const {evaluateRaidEvidence:e}=await load();
 const r=e({...base,observations:[obs(a),obs(a,{attacks:4}),obs(b,{attacks:7})]});
 assert.equal(r.coverage.conflictingWeekends,2);
 assert.deepEqual(r.evidence.raidAttacks,{value:null,coverage:"unknown"});
});
test("unverified schedules, unexpected weekends and missing gold cannot imply complete coverage",async()=>{
 const {evaluateRaidEvidence:e}=await load();
 const missingGold=obs(b,{capitalResourcesLooted:undefined});
 const r=e({...base,observations:[obs(a),missingGold]});
 assert.equal(r.evidence.raidAttacks.coverage,"complete");
 assert.deepEqual(r.evidence.capitalGold,{value:100,coverage:"lower_bound"});
 assert.equal(e({...base,scheduleVerified:false,observations:[obs(a),obs(b)]}).evidence.raidParticipationPct.coverage,"unknown");
 const middle={startTime:"20261110T070000.000Z",endTime:"20261111T070000.000Z"};
 assert.equal(e({...base,observations:[obs(a),obs(b),obs(middle)]}).evidence.raidAttacks.coverage,"lower_bound");
});
test("partial window is excluded; no full expected weekends is unknown, not zero",async()=>{
 const {evaluateRaidEvidence:e}=await load();
 const r=e({...base,startTime:"20261107T070000.000Z",observations:[obs(a),obs(b)]});
 assert.equal(r.coverage.expectedWeekends,1);
 assert.equal(r.evidence.raidAttacks.value,5);
 assert.equal(e({...base,expectedWeekends:[],observations:[]}).evidence.raidAttacks.coverage,"unknown");
 assert.throws(()=>e({...base,expectedWeekends:[a,{...a,endTime:b.endTime}]}),/overlapping_raid_schedule/);
});
test("lower bound can establish a count threshold but never a participation percentage",async()=>{
 const {evaluateRaidEvidence:e}=await load();
 const {evaluateActivityRequirement:req}=await import("../cwl-activity-raffle-core.mjs");
 const {evidence}=e({...base,observations:[obs(a)]});
 assert.equal(req({metric:"raidAttacks",minimum:5},evidence).status,"met");
 assert.equal(req({metric:"raidAttacks",minimum:6},evidence).status,"unknown");
 assert.equal(req({metric:"raidParticipationPct",minimum:50},evidence).status,"unknown");
});

test("raid timestamps accept compact and ISO seconds/milliseconds but reject invalid calendar dates",async()=>{
 const {evaluateRaidEvidence:e}=await load();
 const r=e({...base,startTime:"2026-11-06T07:00:00Z",endTime:"2026-11-16T07:00:00.000Z",observations:[obs(a),obs(b)]});
 assert.equal(r.evidence.raidAttacks.value,10);
 assert.throws(()=>e({...base,startTime:"2026-11-31T07:00:00.000Z"}),/invalid_raid_window/);
});
