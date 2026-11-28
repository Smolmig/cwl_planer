"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../cwl-activity-ranked-evidence.mjs");
const playerTag="#8PYL",startTime="2026-11-20T00:00:00.000Z",endTime="2026-11-27T00:00:00.000Z";
const base={playerTag,startTime,endTime};
const attack=(battleTimestamp="20261120T000000.000Z",overrides={})=>({battleTimestamp,battleType:"RANKED",attack:true,stars:3,destructionPercentage:100,opponentPlayerTag:"#Q9QL",...overrides});
const obs=(items,extra={})=>({playerTag,verified:true,items,...extra});
test("Ranked: exact start included, end excluded, only own verified attacks and lower bounds",async()=>{
 const {evaluateRankedEvidence:e}=await load();
 const r=e({...base,observations:[obs([attack(),attack("20261126T230000.000Z",{stars:2,destructionPercentage:90}),attack("20261127T000000.000Z"),attack("20261119T230000.000Z"),attack("20261121T000000.000Z",{attack:false}),attack("20261122T000000.000Z",{battleType:"LEGEND"}),attack("20261123T000000.000Z",{battleType:"HOME_VILLAGE"})]),obs([attack()],{verified:false}),obs([attack()],{playerTag:"#2PYL"})]});
 assert.deepEqual(r.evidence.rankedAttacks,{value:2,coverage:"lower_bound"});
 assert.deepEqual(r.evidence.rankedStars,{value:5,coverage:"lower_bound"});
 assert.deepEqual(r.evidence.rankedTriples,{value:1,coverage:"lower_bound"});
 assert.equal(r.coverage.acceptedSnapshots,1);
 assert.equal(r.evidence.rankedParticipationPct.coverage,"unknown");
});
test("Ranked: overlapping logs and an omitted opponent tag cannot inflate scores",async()=>{
 const {evaluateRankedEvidence:e}=await load();
 const r=e({...base,observations:[obs([attack()]),obs([attack(undefined,{opponentPlayerTag:null}),attack()])]});
 assert.equal(r.evidence.rankedAttacks.value,1);
 assert.equal(r.evidence.rankedStars.value,3);
});
test("Ranked: conflicting scores or multiple opponents at one timestamp quarantine the whole bucket",async()=>{
 const {evaluateRankedEvidence:e}=await load();
 const second="20261122T000000.000Z";
 const r=e({...base,observations:[obs([attack(),attack(second)]),obs([attack(undefined,{stars:2}),attack(second,{opponentPlayerTag:"#2PYL"})]),obs([attack()])]});
 assert.equal(r.coverage.conflictingTimes,2);
 assert.deepEqual(r.evidence.rankedAttacks,{value:null,coverage:"unknown"});
});
test("Ranked: empty/malformed logs never imply zero participation or a complete tournament",async()=>{
 const {evaluateRankedEvidence:e}=await load();
 const r=e({...base,observations:[obs([]),obs([attack(undefined,{stars:4}),attack("20261131T000000.000Z")])]});
 assert.equal(r.coverage.rejectedEntries,2);
 assert.equal(r.evidence.rankedAttacks.coverage,"unknown");
 assert.equal(r.evidence.rankedCompletedTournaments.coverage,"unknown");
 assert.equal(r.evidence.rankedPromotions.coverage,"unknown");
 assert.throws(()=>e({...base,endTime:startTime}),/invalid_ranked_context/);
});
test("Ranked: only observed count threshold can be satisfied; insufficient lower bound stays open",async()=>{
 const {evaluateRankedEvidence:e}=await load();
 const {evaluateActivityRequirement:req}=await import("../cwl-activity-raffle-core.mjs");
 const {evidence}=e({...base,observations:[obs([attack()])]});
 assert.equal(req({metric:"rankedStars",minimum:3},evidence).status,"met");
 assert.equal(req({metric:"rankedStars",minimum:4},evidence).status,"unknown");
 assert.equal(req({metric:"rankedParticipationPct",minimum:50},evidence).status,"unknown");
});
