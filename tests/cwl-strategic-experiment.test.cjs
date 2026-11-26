"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {planCwl}=require("../cwl-planning-core.js");
const mod=import("../cwl-strategic-experiment.mjs");
const now=Date.UTC(2026,10,26),day=86400000;
const alphabet="0289PYLQGRJCUV";
const member=(i,extra={})=>({id:"p"+i,name:"P"+i,playerTag:"#P"+alphabet[Math.floor(i/13)]+alphabet[i%13],townHall:19,participating:true,participationIntent:"yes",...extra});
const fact=(m,i,stars=3,extra={})=>({playerTag:m.playerTag,warKey:"war"+i,attackOrder:1,kind:"normal",attackerTh:19,defenderTh:19,stars,destruction:stars===3?100:80,eventAt:now-day,observedAt:now-day,...extra});
test("30-day rolling window excludes future-known facts, older RH and conflicts, deduplicates",async()=>{
 const {buildStrategicEvidence}=await mod;const m=member(0);
 const f=fact(m,1),conf=fact(m,2);
 const e=buildStrategicEvidence({members:[m],asOf:now,facts:[f,f,conf,{...conf,stars:2},fact(m,3,3,{eventAt:now-31*day,observedAt:now-31*day}),fact(m,4,3,{observedAt:now+1}),fact(m,5,3,{attackerTh:18}),fact(m,6,3,{defenderTh:18}),fact(m,7,3,{eventAt:now-30*day,observedAt:now-30*day})]});
 assert.equal(e.profiles[0].n,2);assert.equal(e.audit.duplicates,1);assert.equal(e.audit.conflicting,1);assert.equal(e.audit.outsideWindow,1);assert.equal(e.audit.unavailableAtCutoff,1);assert.equal(e.audit.olderTownHall,1);
 assert.equal(e.profiles[0].contexts.length,2);assert.equal(e.calibrated,false);
});
test("single triple is not stronger evidence than many triples; unknown is not zero",async()=>{
 const {buildStrategicEvidence}=await mod;const members=[member(0),member(1),member(2),member(3),member(4)];
 const facts=[fact(members[0],0),...Array.from({length:22},(_,i)=>fact(members[1],i,i===21?2:3)),...members.slice(2,4).flatMap(m=>Array.from({length:10},(_,i)=>fact(m,i,i%2?2:3)))];
 const {profiles}=buildStrategicEvidence({members,facts,asOf:now});
 assert.ok(profiles[0].score<profiles[1].score);assert.equal(profiles[0].evidence,"limited");assert.equal(profiles[4].score,null);assert.equal(profiles[4].evidence,"unknown");
 assert.equal(profiles[0].contexts[0].prior,"peer");
});
test("CW/CWL and matchup contexts separate, verified missed separate from attack stars",async()=>{
 const {buildStrategicEvidence}=await mod;const m=member(0);
 const obligation=(slotKey,result,extra={})=>({playerTag:m.playerTag,slotKey,result,eventAt:now-day,observedAt:now-day,verified:true,...extra});
 const {profiles:[p]}=buildStrategicEvidence({members:[m],asOf:now,facts:[fact(m,1,3),fact(m,2,2,{kind:"cwl"}),fact(m,3,3,{defenderTh:18})],obligations:[obligation("1","performed"),obligation("1","performed"),obligation("2","missed"),obligation("3","missed",{verified:false}),obligation("4","missed"),obligation("4","performed")]});
 assert.equal(p.n,2);assert.equal(p.contexts.length,3);assert.deepEqual(p.reliability,{performed:1,missed:1,verifiedSlots:2,observedRate:.5});assert.equal(p.contexts.find(c=>c.kind==="cwl").stars,2);
});
function scenario(extra={}){
 const members=Array.from({length:20},(_,i)=>member(i,i===0?{fixed:true}:i===1?{targetDays:4,statuses:["out","must"]}:i===19?{participationIntent:"unknown"}:{}));
 const facts=members.slice(0,19).flatMap((m,i)=>Array.from({length:20},(_,j)=>fact(m,j,i<12?3:i<17?2:1)));
 return {members,facts,asOf:now,slots:15,days:7,planStandard:planCwl,...extra};
}
test("three modes deterministic; no zero exclusions, fixed/must/out/exact, unknown protected, immutable input",async()=>{
 const {previewSeasonCandidates}=await mod;const s=scenario();const snap=JSON.stringify(s);
 const results=["performance","balanced","development"].map(mode=>previewSeasonCandidates({...s,mode}));
 for(const p of results){
  assert.ok(p.ok);assert.deepEqual(p,previewSeasonCandidates({...s,mode:p.mode}));
  assert.equal(p.rows.find(r=>r.id==="p1").scenarioAppearances,4);
  assert.ok(p.preview.every(d=>d.lineup.includes("p0")&&d.lineup.length===15&&new Set(d.lineup).size===15));
  assert.ok(!p.preview[0].lineup.includes("p1"));assert.ok(p.preview[1].lineup.includes("p1"));
  assert.ok(p.rows.every(r=>r.scenarioAppearances>=1));
  const unknown=p.rows.find(r=>r.id==="p19");assert.equal(unknown.recommendation,"manual_review");assert.equal(unknown.scenarioAppearances,unknown.standardAppearances);assert.deepEqual(p.conditional,["p19"]);
 }
 assert.ok(results[0].rows.find(r=>r.id==="p17").scenarioAppearances<=results[2].rows.find(r=>r.id==="p17").scenarioAppearances);
 assert.equal(JSON.stringify(s),snap);
});
test("close strength and single two-star do not radically reduce appearances",async()=>{
 const {previewSeasonCandidates}=await mod;const members=Array.from({length:20},(_,i)=>member(i));
 const facts=members.flatMap((m,i)=>Array.from({length:20},(_,j)=>fact(m,j,i===0&&j===0?2:3)));
 const p=previewSeasonCandidates({members,facts,asOf:now,mode:"performance",planStandard:planCwl});
 assert.ok(p.rows.find(r=>r.id==="p0").scenarioAppearances>=4);
});
test("no data uses standard; unavailable and former excluded, unknown is conditional",async()=>{
 const {previewSeasonCandidates}=await mod;const members=Array.from({length:18},(_,i)=>member(i,i===16?{participationIntent:"no"}:i===17?{cocSyncState:"former"}:i===15?{participationIntent:"unknown"}:{}));
 const p=previewSeasonCandidates({members,asOf:now,mode:"performance",planStandard:planCwl});
 assert.ok(p.ok);assert.deepEqual(p.standard,p.preview);assert.deepEqual(p.conditional,["p15"]);assert.equal(p.rows[16].scenarioAppearances,null);assert.equal(p.rows[17].scenarioAppearances,null);
});
test("5-day / 30-player format, insufficient capacity and duplicate tags",async()=>{
 const {previewSeasonCandidates}=await mod;const members=Array.from({length:35},(_,i)=>member(i));
 const p=previewSeasonCandidates({members,asOf:now,mode:"balanced",slots:30,days:5,planStandard:planCwl});
 assert.ok(p.ok);assert.equal(p.preview.length,5);assert.ok(p.preview.every(d=>d.lineup.length===30));
 const failed=previewSeasonCandidates({members:members.slice(0,14),asOf:now,mode:"balanced",planStandard:planCwl});
 assert.equal(failed.ok,false);assert.equal(failed.changes.length,0);
 assert.throws(()=>previewSeasonCandidates({members:[members[0],{...members[1],playerTag:members[0].playerTag}],asOf:now,mode:"balanced",planStandard:planCwl}),/invalid_member_identity/);
});
test("different town halls are never traded on equal-TH score alone; malformed mode fails closed",async()=>{
 const {previewSeasonCandidates}=await mod;const members=Array.from({length:20},(_,i)=>member(i,{townHall:i<10?18:19}));
 const facts=members.flatMap((m,i)=>Array.from({length:12},(_,j)=>fact(m,j,i<10?3:1,{attackerTh:m.townHall,defenderTh:m.townHall})));
 const p=previewSeasonCandidates({members,facts,asOf:now,mode:"performance",planStandard:planCwl});
 const ths=ids=>ids.filter(id=>Number(id.slice(1))<10).length;
 assert.ok(p.preview.every((d,i)=>ths(d.lineup)===ths(p.standard[i].lineup)));
 assert.throws(()=>previewSeasonCandidates({members,asOf:now,mode:"toString",planStandard:planCwl}),/invalid_scenario/);
});
