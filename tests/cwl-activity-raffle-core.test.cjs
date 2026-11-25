"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../cwl-activity-raffle-core.mjs");
const player="#2PYL";
const battle=(mode="RANKED",timestamp="20261125T183001.000Z",extra={})=>({battleType:mode,battleTimestamp:timestamp,attack:true,stars:3,destructionPercentage:100,opponentPlayerTag:"#8PYL",...extra});
test("Battle modes stay distinct; replay and defense cannot add attacks",async()=>{
 const {normalizeBattleLog}=await load();
 const result=normalizeBattleLog(player,[battle(),battle(),battle("HOME_VILLAGE"),battle("LEGEND"),battle("RANKED","20261125T183002.000Z",{attack:false}),battle("UNKNOWN"),battle("RANKED","20261131T183001.000Z")]);
 assert.equal(result.records.length,3);assert.equal(result.defenses,1);assert.equal(result.rejected,2);assert.equal(result.coverage,"unknown");
 assert.deepEqual(result.records.map(x=>x.mode),["HOME_VILLAGE","LEGEND","RANKED"]);
 assert.ok(result.records.every(x=>x.timestamp==="2026-11-25T18:30:01.000Z"));
});
test("Contradictory records and malformed attacks are not counted",async()=>{
 const {normalizeBattleLog}=await load();
 const result=normalizeBattleLog(player,[battle(),battle("RANKED","20261125T183001.000Z",{stars:2}),battle(),
  battle("RANKED","20261125T183002.000Z",{attack:undefined}),battle("HOME_VILLAGE","2026-11-25T18:31:00Z",{opponentPlayerTag:null,stars:0,destructionPercentage:0})]);
 assert.equal(result.records.length,1);assert.equal(result.records[0].stars,0);assert.equal(result.ambiguous,1);assert.equal(result.rejected,1);
});
test("Incomplete counts qualify only when their proven lower bound meets the rule",async()=>{
 const {evaluateActivityRequirement:check}=await load();
 const r={metric:"donations",minimum:3500};
 assert.equal(check(r,{donations:{value:3600,coverage:"lower_bound"}}).status,"met");
 assert.equal(check(r,{donations:{value:3000,coverage:"lower_bound"}}).status,"unknown");
 assert.equal(check(r,{donations:{value:3000,coverage:"complete"}}).status,"unmet");
 assert.equal(check(r,{}).status,"unknown");
 assert.equal(check({metric:"rankedParticipationPct",minimum:90},{rankedParticipationPct:{value:100,coverage:"lower_bound"}}).status,"unknown");
});
test("Manual participation is independent of Discord membership and unknown stays unknown",async()=>{
 const {evaluateActivityEligibility:check}=await load();
 const rules=[{metric:"cwStars",minimum:28},{metric:"discord",minimum:true},{metric:"voted",minimum:true}];
 const evidence={cwStars:{value:29,coverage:"complete"}};
 assert.equal(check(rules,evidence,{discord:true}).status,"unknown");
 assert.equal(check(rules,evidence,{discord:true,voted:false}).status,"unmet");
 assert.equal(check(rules,evidence,{discord:false,voted:true}).status,"unmet");
 assert.deepEqual(check(rules,evidence,{discord:true,voted:true}).tickets,1);
 assert.equal(check(rules,evidence,{discord:true,voted:true,organizer:true}).status,"excluded");
 assert.throws(()=>check([{metric:"cwStars",minimum:28},{metric:"cwStars",minimum:1}],evidence));
});
