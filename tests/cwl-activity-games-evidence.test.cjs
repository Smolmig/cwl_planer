"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../cwl-activity-games-evidence.mjs");
const playerTag="#8PYL",startTime="2026-11-22T00:00:00.000Z",endTime="2026-11-28T00:00:00.000Z";
const mid="2026-11-24T00:00:00.000Z",base={playerTag,startTime,endTime};
const obs=(observedAt,value)=>({verified:true,playerTag,observedAt,profile:{tag:playerTag,achievements:[{name:"Games Champion",value}]}});
test("Games achievement: deduplicated exact boundary snapshots are account-wide only",async()=>{
 const {evaluateGamesAchievement:e}=await load();
 const r=e({...base,observations:[obs(endTime,4500),obs(startTime,1000),obs(mid,3000),obs(mid,3000)]});
 assert.deepEqual(r.accountWideAchievementDelta,{value:3500,coverage:"lower_bound"});
 assert.equal(r.evidence.clanGamesPoints.coverage,"unknown");
 assert.equal(r.coverage.observedSnapshots,3);
 assert.equal(r.coverage.exactStart,true);
 assert.equal(r.coverage.exactEnd,true);
});
test("Games achievement: no baseline or foreign identity means unknown",async()=>{
 const {evaluateGamesAchievement:e}=await load();
 const other=obs(startTime,100);other.profile.tag="#2PYL";
 const r=e({...base,observations:[other,obs(mid,3000)]});
 assert.equal(r.accountWideAchievementDelta.coverage,"unknown");
});
test("Games achievement: resets, conflicting values, and malformed achievements fail closed",async()=>{
 const {evaluateGamesAchievement:e}=await load();
 for(const observations of [[obs(startTime,3000),obs(mid,100),obs(endTime,4000)],[obs(startTime,100),obs(mid,200),obs(mid,300),obs(endTime,500)],[obs(startTime,100),obs(mid,-5),obs(endTime,500)]]){
  assert.equal(e({...base,observations}).accountWideAchievementDelta.coverage,"unknown");
 }
});
test("Games achievement: outside-window samples cannot stand in for missing boundaries",async()=>{
 const {evaluateGamesAchievement:e}=await load();
 const r=e({...base,observations:[obs("2026-11-21T00:00:00.000Z",10),obs(mid,200),obs(endTime,500)]});
 assert.equal(r.accountWideAchievementDelta.value,300);
 assert.equal(r.coverage.exactStart,false);
 assert.equal(r.evidence.clanGamesPoints.coverage,"unknown");
});
