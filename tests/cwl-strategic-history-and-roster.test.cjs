"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {planCwl}=require("../cwl-planning-core.js");
const adapter=import("../cwl-strategic-history-adapter.mjs");
const core=import("../cwl-strategic-experiment.mjs");
const now=Date.UTC(2026,10,26),day=86400000,iso=n=>new Date(n).toISOString();
const alphabet="0289PYLQGRJCUV";
const member=(i,extra={})=>({id:"p"+i,name:"P"+i,playerTag:"#P"+alphabet[Math.floor(i/13)]+alphabet[i%13],townHall:19,participating:true,participationIntent:"yes",...extra});
const war=(i,extra={})=>({clan_id:"local",formClanTag:"#2PYL",war_key:"#2PYL|war"+i,war_type:"normal",source:"api",started_at:iso(now-2*day),updated_at:iso(now-day),finalized:true,...extra});
const attack=(w,m,order=1,extra={})=>({clan_id:w.clan_id,war_key:w.war_key,attacker_tag:m.playerTag,attack_order:order,attacker_th:19,defender_th:19,stars:3,destruction:100,created_at:iso(now-day),...extra});
const miss=(w,m,count=1,extra={})=>({clan_id:w.clan_id,war_key:w.war_key,player_tag:m.playerTag,missed_count:count,created_at:iso(now-day),...extra});
function input(wars,attacks,missedEvents,members=[member(0)]){
 return {history:{wars,attacks,missedEvents,partial:true},members,selectedClanId:"local",authorizedClanIds:["local","linked"],asOf:now,snapshotAt:now};
}
test("current snapshot adapter: dedupe, explicit misses, incomplete coverage, unknown RH, selected roster only",async()=>{
 const {adaptStrategicHistory}=await adapter;const {buildStrategicEvidence}=await core;
 const m=member(0),w=war(1),l=war(2,{clan_id:"linked",formClanTag:"#9PYL",war_key:"#9PYL|war2",war_type:"cwl"});
 const a=attack(w,m);
 const data=input([w,l],[a,a,attack(l,m,1,{defender_th:null}),attack(w,member(1))],[miss(w,m)]);
 const frozen=JSON.stringify(data),result=adaptStrategicHistory(data);
 assert.equal(result.facts.length,1);assert.equal(result.obligations.length,3);assert.equal(result.audit.unknownTownHall,1);assert.equal(result.audit.sourcePartial,true);assert.equal(result.audit.strictHistoricalReplay,false);
 const e=buildStrategicEvidence({...result,members:[m]});assert.equal(e.profiles[0].n,1);assert.deepEqual(e.profiles[0].reliability,{performed:2,missed:1,verifiedSlots:3,observedRate:2/3});assert.equal(JSON.stringify(data),frozen);
});
test("adapter rejects cross-tenant data and retrospective cutoff; excludes incomplete/future/stale rows",async()=>{
 const {adaptStrategicHistory}=await adapter;const m=member(0),w=war(1),l=war(2,{finalized:false}),old=war(3,{started_at:iso(now-31*day)}),future=war(4,{updated_at:iso(now+1)});
 const data=input([w,l,old,future],[attack(w,m,1,{created_at:iso(now+1)}),attack(l,m),attack(old,m),attack(future,m)],[]);
 const a=adaptStrategicHistory(data);assert.equal(a.facts.length,0);assert.equal(a.audit.staleOrUnfinished,3);assert.equal(a.audit.invalidRows,1);
 assert.throws(()=>adaptStrategicHistory({...data,asOf:now-day}),/invalid_current_snapshot/);
 assert.throws(()=>adaptStrategicHistory(input([w],[attack(w,m,1,{clan_id:"foreign"})],[])),/history_scope_mismatch/);
 assert.throws(()=>adaptStrategicHistory(input([w],[attack(w,m,1,{clan_id:"linked"})],[])),/history_scope_mismatch/);
});
test("adapter does not invent missed slots; conflicting duplicate and impossible obligation count are excluded",async()=>{
 const {adaptStrategicHistory}=await adapter;const m=member(0),w=war(1),w2=war(2,{war_type:"cwl"}),w3=war(3),w4=war(4);
 const a=attack(w,m);const data=input([w,w2,w3,w4],[a,{...a,stars:2},attack(w2,m),attack(w3,m)], [miss(w2,m)]);
 const x=adaptStrategicHistory(data);assert.equal(x.audit.conflictingRows,1);assert.equal(x.audit.obligationConflicts,1);
 assert.equal(x.facts.length,2);assert.equal(x.obligations.length,1);assert.equal(x.obligations[0].result,"performed");assert.equal(x.obligations[0].playerTag,m.playerTag);
});
test("adapter never counts missing timestamp or war-start-outside-window as recent data",async()=>{
 const {adaptStrategicHistory}=await adapter;const m=member(0),w=war(1,{updated_at:null}),w2=war(2,{started_at:iso(now-31*day)}),w3=war(3);
 const x=adaptStrategicHistory(input([w,w2,w3],[attack(w,m),attack(w2,m),attack(w3,m,1,{created_at:null})],[]));
 assert.equal(x.facts.length,0);assert.equal(x.audit.invalidWars,1);assert.equal(x.audit.staleOrUnfinished,1);assert.equal(x.audit.invalidRows,1);
});
function scenario(extra={}){
 const members=Array.from({length:22},(_,i)=>member(i,i===0?{fixed:true}:i===21?{participationIntent:"unknown"}:{}));
 const facts=members.slice(0,21).flatMap((m,i)=>Array.from({length:22},(_,j)=>({playerTag:m.playerTag,warKey:"w"+j,attackOrder:1,kind:"normal",attackerTh:19,defenderTh:19,stars:i<15?3:0,destruction:i<15?100:10,eventAt:now-day,observedAt:now-day})));
 return {members,facts,asOf:now,mode:"performance",slots:15,days:7,planStandard:planCwl,...extra};
}
test("compare roster sizes: actual smaller alternatives, same peer evidence, no automatic selection, reserve and unknown protected",async()=>{
 const {compareSeasonRosterSizes}=await core;const s=scenario(),frozen=JSON.stringify(s);
 const x=compareSeasonRosterSizes(s);assert.ok(x.ok);assert.ok(x.scenarios.length>1);assert.equal(x.recommendation,null);
 for(const p of x.scenarios.slice(1)){
  assert.ok(p.size<x.scenarios[0].size);assert.ok(p.requiresIndividualReview);assert.ok(p.metrics.minimumAvailableReserve>=1);
  assert.ok(p.excluded.every(id=>id!=="p0"&&id!=="p21"));assert.ok(p.plan.rows.every(r=>r.scenarioAppearances>=1));
  assert.equal(p.metrics.knownSlots,x.scenarios[0].metrics.knownSlots);
  assert.ok(p.metrics.comparableStarIndex>=x.scenarios[0].metrics.comparableStarIndex-1e-9);
  assert.deepEqual(p.plan.evidence,x.scenarios[0].plan.evidence);
 }
 assert.equal(JSON.stringify(s),frozen);assert.deepEqual(x,compareSeasonRosterSizes(s));
});
test("equal/unknown form never gets smaller-roster statistical exclusion; conditional reserve separate",async()=>{
 const {compareSeasonRosterSizes}=await core;const s=scenario({facts:[],mode:"balanced"});
 const x=compareSeasonRosterSizes(s);assert.equal(x.scenarios.length,1);assert.equal(x.scenarios[0].metrics.minimumAvailableReserve,7);assert.equal(x.scenarios[0].metrics.minimumConfirmedReserve,6);
});
test("no forced candidate exclusion if everyone is needed, hard target, or confirmed capacity missing",async()=>{
 const {compareSeasonRosterSizes}=await core;const s=scenario();
 const full=s.members.slice(0,15);assert.equal(compareSeasonRosterSizes({...s,members:full}).scenarios.length,1);
 assert.equal(compareSeasonRosterSizes({...s,members:full.slice(0,14)}).ok,false);
 const protectedRoster=s.members.map((m,i)=>i>=15&&i<21?{...m,targetDays:2}:m);
 const x=compareSeasonRosterSizes({...s,members:protectedRoster});assert.ok(x.ok);assert.equal(x.scenarios.length,1);
});

test("smaller roster review requires advantage surviving a whole-war removal",async()=>{
 const {buildStrategicEvidence,compareSeasonRosterSizes}=await core;
 const s=scenario(),p=buildStrategicEvidence(s).profiles.find(p=>p.id==="p15");
 assert.equal(p.sensitivity.wars,22);assert.ok(p.sensitivity.high>=p.score&&p.sensitivity.low<=p.score);
 const correlated=s.facts.map(f=>({...f,warKey:"one-war",attackOrder:Number(f.warKey.slice(1))}));
 const x=compareSeasonRosterSizes({...s,facts:correlated});assert.equal(x.scenarios.length,1);
 const steady=compareSeasonRosterSizes(s);assert.ok(steady.scenarios.length>1);
 assert.ok(steady.scenarios.slice(1).every(s=>s.sensitivityChecked===true));
});
