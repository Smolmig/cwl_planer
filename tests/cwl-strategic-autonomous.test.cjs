"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),core=require("../cwl-planning-core.js");
const mod=import("../supabase/functions/coc-stats-collector/collector-strategic-cycle.mjs");
const abc="0289PYLQGRJCUV",tag=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13],clanId="11111111-1111-1111-1111-111111111111",ownerId="22222222-2222-2222-2222-222222222222",now=Date.UTC(2026,11,2),season="2026-12",clanTag=tag(0);
function fixture(){
 const members=Array.from({length:18},(_,i)=>({id:"p"+i,name:"P"+i,playerTag:tag(i+10),townHall:19,participating:true,statuses:Array(5).fill("auto")}));
 members[0].fixed=true;members[1].statuses[2]="out";members[2].targetDays=3;
 const roster=members.slice(0,15).map(m=>({tag:m.playerTag,townHall:19}));
 const group={season,selectedClanTag:clanTag,observedAt:now-1000,wars:[],upcoming:[{day:1,warTag:tag(100),teamSize:15,status:"confirmed_preparation_roster",opponentTag:tag(1),roster:Array.from({length:15},(_,i)=>({tag:tag(i+50),townHall:19})),ownRoster:roster}],ownMedals:{complete:false,stars:[]}};
 const saved={revision:12,profile_json:{id:"p",members,archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]})),config:{slots:15,days:5,strategicMode:"balanced",strategicAuto:true},cwlLive:{season,clanTag,rounds:[]}}};
 return {saved,review:{cycle_id:"cycle",season,locked:false},clanId,clanTag,projection:{status:"preview_data",format:{teamSize:15,attacksPerMemberReported:true},group,registered:{verified:true,season,clanTag,observedAt:group.observedAt,tags:members.map(m=>m.playerTag)},quality:{validUntil:now+200000}},historyRows:{wars:[],attacks:[],missedEvents:[]},core,now};
}
test("server-only grants exact tenant, linked tag and owner; default off",async()=>{
 const {automaticGrant}=await mod,g=JSON.stringify([{clanId,clanTag,ownerId}]);
 assert.equal(automaticGrant(g,clanId,clanTag,ownerId),true);
 for(const x of [null,"*",g.replace(clanTag,tag(1)),g.replace(ownerId,clanId),JSON.stringify([{clanId,clanTag,ownerId},{clanId,clanTag,ownerId}])])assert.equal(automaticGrant(x,clanId,clanTag,ownerId),false);
});
test("autonomous solver creates shared candidate without browser, preserves rules and inputs",async()=>{
 const {buildAutomaticStrategicCandidate}=await mod;
 for(const mode of ["balanced","performance","development"]){
  const x=fixture();x.saved.profile_json.config.strategicMode=mode;const before=JSON.stringify(x);
  const a=buildAutomaticStrategicCandidate(x);assert.equal(a.ok,true,a.reason);assert.equal(a.changed,true);assert.equal(a.expectedRevision,12);
  assert.ok(a.next.plan.every(d=>d.lineup.length===15&&d.lineup.includes("p0")));assert.ok(!a.next.plan[2].lineup.includes("p1"));assert.equal(a.next.plan.filter(d=>d.lineup.includes("p2")).length,3);
  assert.equal(JSON.stringify(x),before);
  const p={...x.saved.profile_json,strategicPlan:a.next};
  const observed=core.strategicObservedContext({profile:p,clanId,locks:p.locks});
  // Fixture's observation is in the future relative to real Node date in
  // some environments; validate effective live independently of wall time.
  const live={...p.cwlLive,rounds:a.next.observedRounds},standard=core.planCwl({members:p.members,slots:15,days:5});
  assert.equal(core.resolvePublishedStrategicPlan({profile:p,clanId,locks:p.locks,standard,live}).status,"published");
 }
});
test("no computation for locked, disabled, changed season, expired or missing earlier war",async()=>{
 const {buildAutomaticStrategicCandidate}=await mod;
 for(const change of [x=>x.review.locked=true,x=>x.saved.profile_json.config.strategicAuto=false,x=>x.review.season="2026-11",x=>x.projection.quality.validUntil=now,x=>x.projection.group.upcoming[0].day=2]){
  const x=fixture();change(x);assert.equal(buildAutomaticStrategicCandidate(x).ok,false);
 }
});
test("actual started roster and manual locks override, conflicting actual roster blocks",async()=>{
 const {buildAutomaticStrategicCandidate}=await mod,x=fixture(),g=x.projection.group;
 g.wars=[{...g.upcoming[0],status:undefined,state:"inWar"}];g.upcoming[0]={...g.upcoming[0],day:2,warTag:tag(101)};
 const result=buildAutomaticStrategicCandidate(x);assert.equal(result.ok,true,result.reason);assert.deepEqual(result.next.plan[0].lineup,x.saved.profile_json.members.slice(0,15).map(m=>m.id));
 x.saved.profile_json.locks[0]={locked:true,lineup:x.saved.profile_json.members.slice(1,16).map(m=>m.id)};
 assert.equal(buildAutomaticStrategicCandidate(x).reason,"lock_conflict");
});
