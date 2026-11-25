"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../supabase/functions/coc-stats-collector/collector-season-rollover.mjs");
const tags=["#2PYL","#8PYL","#G9QL","#P9QL","#Q9QL","#R9QL","#J9QL","#C9QL"];
const now=Date.parse("2026-12-01T10:00:00Z");
const group=(count=7)=>({season:"2026-12-01",state:"preparation",clans:tags.slice(0,count+1).map(tag=>({tag})),rounds:Array.from({length:count},()=>({warTags:["#0"]}))});
const member=(id,name)=>({id,name,playerTag:"#2PY"+(id==="a"?"L":"Q"),townHall:18,threeStar:"high",fixed:false,participating:true,priority:2,statuses:Array(7).fill("in"),firstDay:2,outFromDay:6,targetDays:5,cocBeforeDeparture:{before:{targetDays:4,statuses:["out"],fixed:false},automatic:{targetDays:2,statuses:["auto"]},edited:{"statuses.0":true,targetDays:3,priority:true}}});
function profile(days=7,played=6){
 const a=member("a","A"),b=member("b","B");
 const rounds=Array.from({length:days},(_,i)=>({day:i+1,warTag:"#P9QL"+i,state:i<played?"warEnded":"inWar",available:true}));
 return {id:"test",name:"Test",config:{days,slots:2,memberSort:"name"},members:[a],archivedMembers:[b],archives:[],
  locks:Array.from({length:7},(_,i)=>i<played?{locked:true,source:"coc-api",season:"2026-11",warTag:rounds[i].warTag,lineup:["a","b"],snapshots:{a,b}}:{locked:false,lineup:[]}),
  dayGoals:[{townHall:{18:2}}],cwlLive:{season:"2026-11",clanTag:tags[0],rounds,warCount:days}};
}
test("Only a current official group with correct clan and actual five/seven-war format is eligible",async()=>{
 const {officialNewLeague}=await load();
 for(const count of [5,7]){
  assert.equal(officialNewLeague(group(count),tags[0],now).warCount,count);
 }
 assert.equal(officialNewLeague({...group(),season:"2026-11"},tags[0],now),null);
 assert.equal(officialNewLeague({...group(),state:"ended"},tags[0],now),null);
 assert.equal(officialNewLeague({...group(),state:"notInWar"},tags[0],now),null);
 assert.equal(officialNewLeague(group(5),tags[7],now),null);
 assert.equal(officialNewLeague({...group(),rounds:[{}]},tags[0],now),null);
 assert.equal(officialNewLeague({...group(),clans:Array(8).fill({tag:tags[0]})},tags[0],now),null);
});
test("0/5/6/7 saved days remain exactly as recorded; new season clears only day planning",async()=>{
 const {officialNewLeague,buildSeasonRollover}=await load();
 for(const [days,played] of [[7,0],[5,5],[7,6],[7,7]]){
  const p=profile(days,played),original=JSON.stringify(p);
  const proof=officialNewLeague(group(5),tags[0],now);
  const result=buildSeasonRollover(p,proof,now);
  assert.equal(result.ok,true,result.reason);
  const n=result.profile,a=n.archives[0];
  assert.equal(JSON.stringify(p),original);
  assert.equal(a.sourceSeason,"2026-11");assert.equal(a.playedCount,played);
  assert.equal(a.complete,days===played);assert.equal(a.lineups.length,played);
  assert.deepEqual(a.cwlLive,p.cwlLive);
  assert.equal(a.deploymentSnapshot.players.length,2);
  assert.equal(n.cwlLive.season,"2026-12");assert.equal(n.config.days,5);
  assert.equal(n.cwlLiveIgnoredSeason,"2026-11");
  assert.equal(n.locks.every(l=>!l.locked&&l.lineup.length===0),true);
  assert.deepEqual(n.archivedMembers,[]);assert.equal(n.members[0].priority,2);
  assert.equal(n.members[0].targetDays,null);
  assert.equal(n.members[0].cocBeforeDeparture.edited.priority,true);
  assert.equal(n.members[0].cocBeforeDeparture.edited.targetDays,undefined);
  assert.equal(buildSeasonRollover(n,proof,now).ok,false);
 }
});
test("Existing archives are immutable; incompatible old plan, roster or source blocks rollover",async()=>{
 const {officialNewLeague,buildSeasonRollover}=await load();
 const proof=officialNewLeague(group(),tags[0],now),p=profile();
 const a=buildSeasonRollover(p,proof,now).profile.archives[0];
 p.archives.push(a);
 assert.deepEqual(buildSeasonRollover(p,proof,now).profile.archives,[a]);
 const changed=profile();changed.archives.push({...a,playedCount:5});
 assert.equal(buildSeasonRollover(changed,proof,now).reason,"prior_archive_conflict");
 const bad=profile();bad.locks[5].warTag="#G9QL";
 assert.equal(buildSeasonRollover(bad,proof,now).reason,"inconsistent_api_lock");
 assert.equal(buildSeasonRollover({...p,cwlLive:{...p.cwlLive,clanTag:tags[1]}},proof,now).ok,false);
});
