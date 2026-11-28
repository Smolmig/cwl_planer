"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{planCwl,strategicRuleKey,resolvePublishedStrategicPlan}=require("../cwl-planning-core.js");
function fixture(){
 const members=[{id:"a",name:"A",playerTag:"#P02",targetDays:2},{id:"b",name:"B",playerTag:"#P08",targetDays:3}].map(m=>({...m,participating:true,statuses:Array(5).fill("auto"),townHall:19}));
 const profile={members,config:{slots:1,days:5,strategicMode:"performance"},locks:[],cwlLive:{season:"2026-11",clanTag:"#P09",rounds:[{available:true,warTag:"#PQQ",state:"preparation"}]}};
 const standard=planCwl({members,slots:1,days:5}),lineups=["a","b","a","b","b"];
 profile.strategicPlan={version:1,clanId:"clan",season:"2026-11",clanTag:"#P09",anchorWarTag:"#PQQ",ruleKey:strategicRuleKey(profile),registeredTags:members.map(m=>m.playerTag),plan:lineups.map((id,i)=>({day:i+1,lineup:[id]}))};
 return {profile,clanId:"clan",locks:[],standard};
}
test("published assignment deterministic for all roles, no mutation, counts and rotations consistent",()=>{
 const x=fixture(),before=JSON.stringify(x),p=resolvePublishedStrategicPlan(x);
 assert.equal(p.status,"published");assert.deepEqual(p.plan.dayPlans.map(d=>d.lineup[0]),["a","b","a","b","b"]);assert.equal(p.plan.counts.a,2);assert.deepEqual(p.plan.dayPlans[1].rein,["b"]);assert.deepEqual(p.plan.dayPlans[1].raus,["a"]);assert.equal(JSON.stringify(x),before);
});
test("scope, mode, rules, registration, exact goals and actual started lineup validated",()=>{
 for(const mutate of [x=>x.clanId="other",x=>x.profile.cwlLive.rounds[0].warTag="#PYY",x=>x.profile.config.strategicMode="balanced",x=>x.profile.members[0].statuses[0]="out",x=>x.profile.strategicPlan.registeredTags=["#P08"],x=>x.profile.strategicPlan.plan[0].lineup=["b"],x=>x.profile.cwlLive.rounds[0].state="inWar"]){
  const x=fixture();mutate(x);const p=resolvePublishedStrategicPlan(x);assert.equal(p.status,"stale");assert.equal(p.plan,x.standard);
 }
 const x=fixture();x.profile.cwlLive.rounds[0].state="inWar";x.locks=[{locked:true,lineup:["a"]}];assert.equal(resolvePublishedStrategicPlan(x).status,"published");
 x.locks[0].lineup=["b"];assert.equal(resolvePublishedStrategicPlan(x).status,"stale");
});
test("hard FIX and MUSS cannot be bypassed even with recomputed fingerprint",()=>{
 const x=fixture();x.profile.members[0].statuses[1]="must";x.profile.strategicPlan.ruleKey=strategicRuleKey(x.profile);
 assert.equal(resolvePublishedStrategicPlan(x).status,"stale");
});
