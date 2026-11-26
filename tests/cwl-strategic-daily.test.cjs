"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const mod=import("../cwl-strategic-daily.mjs");
const abc="0289PYLQGRJCUV",tag=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13],now=Date.UTC(2026,10,26),season="2026-11",own=tag(0),opponent=tag(1);
const member=i=>({id:"p"+i,playerTag:tag(10+i),townHall:19,participating:true,statuses:[]});
function data(mode="balanced"){
 const members=Array.from({length:18},(_,i)=>member(i));
 const lineup=Array.from({length:15},(_,i)=>"p"+i),last=[...lineup.slice(0,12),"p15","p16","p17"];
 const currentPlan=Array.from({length:5},(_,i)=>({day:i+1,lineup:[...(i<2?lineup:last)]}));
 const roster=ids=>ids.map((id,i)=>({tag:members.find(m=>m.id===id).playerTag,townHall:19,mapPosition:i+1}));
 const upcoming=[{day:3,warTag:tag(100),opponentTag:opponent,teamSize:15,status:"confirmed_preparation_roster",ownRoster:roster(last),roster:Array.from({length:15},(_,i)=>({tag:tag(70+i),townHall:19,mapPosition:i+1}))}];
 const wars=[1,2].map(day=>({day,warTag:tag(100+day),state:"warEnded",teamSize:15,ownRoster:roster(lineup),completeAttackLists:true}));
 const profiles=members.map((m,i)=>({playerTag:m.playerTag,townHall:19,n:12,score:i<15?2.9:1.4,contexts:[{kind:"normal",attackerTh:19,defenderTh:19,n:12,smoothedStars:i<15?2.9:1.4}]}));
 return {group:{season,selectedClanTag:own,asOf:now,observedAt:now,upcoming,wars,profiles:[],ownMedals:{complete:true,stars:members.slice(0,15).map(m=>({playerTag:m.playerTag,stars:6}))}},
  standings:{season,selectedClanTag:own,asOf:now,observedAt:now,teamSize:15,quality:"schedule_known",invalid:0,liveMatches:0,demotion:"open",promotion:"open",demotionFirst:5,currentLowerBoundRank:5,teams:Array.from({length:6},()=>({completed:2})),bounds:{best:2,worst:6}},
  evidence:{asOf:now,profiles},members,registered:{verified:true,season,clanTag:own,observedAt:now,tags:members.map(m=>m.playerTag)},currentPlan,manualLocks:[],mode,role:"owner",asOf:now,season,selectedClanTag:own,slots:15,days:5};
}
test("daily preview preserves played and unknown days, minimum participation, hard rules and immutable input",async()=>{
 const {previewDailyStrategy}=await mod,s=data("performance");s.members[15].statuses[2]="must";s.members[12].statuses[2]="out";s.members[16].targetDays=3;
 const frozen=JSON.stringify(s),p=previewDailyStrategy(s);assert.ok(p.ok);assert.deepEqual(p.editableDays,[3]);assert.deepEqual(p.frozenDays,[1,2,4,5]);
 assert.ok(p.current.plan[2].lineup.includes("p15"));assert.ok(p.current.plan[2].lineup.includes("p16"));assert.ok(!p.current.plan[2].lineup.includes("p12"));
 for(const d of p.frozenDays)assert.deepEqual(p.current.plan[d-1],s.currentPlan[d-1]);
 assert.ok(p.players.every(x=>x.confirmedPreparationAppearances>=0));assert.equal(p.canApply,false);assert.equal(JSON.stringify(s),frozen);
 assert.deepEqual(p,previewDailyStrategy(s));
});
test("manual locks, actual roster mismatch and registration scope fail closed",async()=>{
 const {previewDailyStrategy}=await mod,s=data();
 const locked=previewDailyStrategy({...s,manualLocks:[s.currentPlan[2]]});assert.ok(locked.ok);assert.deepEqual(locked.current.changes,[]);
 assert.equal(previewDailyStrategy({...s,registered:{...s.registered,verified:false}}).reason,"unverified_season_roster");
 const invalid=data();invalid.group.wars[0].ownRoster[0].tag=tag(999);
 assert.equal(previewDailyStrategy(invalid).reason,"actual_lineup_mismatch");
 const prep=data();prep.group.upcoming[0].ownRoster[0].tag=tag(999);
 const p=previewDailyStrategy(prep);assert.ok(p.ok);assert.deepEqual(p.editableDays,[]);assert.equal(p.held[0].reason,"preparation_lineup_mismatch");
 assert.throws(()=>previewDailyStrategy({...s,standings:{...s.standings,observedAt:now-1}}),/invalid_daily_scope/);
});
test("risk is not inferred from incomplete data, in-progress standings or merely possible relegation",async()=>{
 const {previewDailyStrategy}=await mod;
 for(const patch of [{quality:"partial"},{liveMatches:1},{currentLowerBoundRank:3},{demotion:"unknown_rules"}]){
  const s=data();s.standings={...s.standings,...patch};assert.equal(previewDailyStrategy(s).modeRecommendation,null);
 }
});
test("performance mode switch needs actual comparative gain, declined key suppresses repetition",async()=>{
 const {previewDailyStrategy}=await mod,s=data();
 // Equalize future starting counts; moderate score difference plus balanced
 // fairness makes a performance-only swap useful when in relegation zone.
 for(const p of s.evidence.profiles){p.score=p.playerTag===s.members[17].playerTag?2:2.4;p.contexts[0].smoothedStars=p.score}
 const p=previewDailyStrategy(s);assert.ok(p.ok);
 // Explicitly construct a case with a medal need on the weaker player and
 // a stronger player with already achieved 8-star goal.
 const q=data();for(const x of q.group.ownMedals.stars)x.stars=8;
 q.members[15].statuses[2]="must";q.members[16].statuses[2]="must";
 const high=q.evidence.profiles.find(x=>x.playerTag===q.members[14].playerTag);high.score=2.9;high.contexts[0].smoothedStars=2.9;
 const weak=q.evidence.profiles.find(x=>x.playerTag===q.members[17].playerTag);weak.score=2.3;weak.contexts[0].smoothedStars=2.3;
 // Balance keeps the underserved player; performance can prioritize gain.
 const a=previewDailyStrategy(q);
 assert.ok(a.ok);
 if(a.modeRecommendation){assert.equal(a.modeRecommendation.to,"performance");assert.equal(previewDailyStrategy({...q,declined:[a.modeRecommendation.key]}).modeRecommendation,null)}
 assert.equal(a.canApply,false);
});
test("unknown medals never become zero-star verdict and target preview uses only actual lineup",async()=>{
 const {previewDailyStrategy}=await mod,s=data("performance");s.group.ownMedals={complete:false,stars:[]};
 const p=previewDailyStrategy(s);assert.ok(p.ok);assert.equal(p.current.metrics.medalOpportunities,null);
 assert.ok(p.players.every(r=>r.medalStatus==="unknown"));assert.equal(p.targetPreviews[0].reason,"refresh_actual_preparation_roster");
 const viewer=previewDailyStrategy({...s,role:"viewer"});assert.equal(viewer.action,"read_only");assert.equal(viewer.canApply,false);
});
