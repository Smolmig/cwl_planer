"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const standings=import("../cwl-strategic-standings.mjs"),targets=import("../cwl-strategic-targets.mjs");
const abc="0289PYLQGRJCUV",t=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13],now=Date.UTC(2026,10,26),season="2026-11",league="Crystal III";
const rules={verified:true,league,season,fullGroupSize:8,promotionPlaces:2,demotionPlaces:2,source:"official example Crystal III"};
function data(n=8,played=n-1,score=(a,b)=>a===0?45:0){
 const clans=Array.from({length:n},(_,i)=>({tag:t(i)})),rot=Array.from({length:n},(_,i)=>i),rounds=[];
 for(let d=0;d<n-1;d++){
  const matches=[];
  for(let j=0;j<n/2;j++){
   const a=rot[j],b=rot[n-1-j],sa=score(a,b),sb=score(b,a);
   matches.push({available:true,warTag:t(20+d*4+j),teamSize:15,state:d<played?"warEnded":"preparation",
    clan:{tag:t(a),stars:sa,destructionPercentage:sa===45?100:sa===0?0:50},
    opponent:{tag:t(b),stars:sb,destructionPercentage:sb===45?100:sb===0?0:50}});
  }
  rounds.push({day:d+1,matches});rot.splice(1,0,rot.pop());
 }
 return {snapshot:{season,clanTag:t(0),observedAt:now,clans,rounds},selectedClanTag:t(0),season,league,asOf:now,rules,teamSize:15};
}
test("guaranteed placement uses confirmed points and conservative remaining bounds",async()=>{
 const {assessStrategicStandings}=await standings;const s=data(8,6);const p=assessStrategicStandings(s);
 assert.deepEqual(p.bounds,{best:1,worst:1});assert.equal(p.promotion,"guaranteed");assert.equal(p.demotion,"impossible");
 assert.equal(p.complete,false);assert.equal(p.teams.find(x=>x.tag===t(0)).min.stars,330);
});
test("six-clan Crystal III group has no relegation positions; unverified rules remain unknown",async()=>{
 const {assessStrategicStandings}=await standings;const s=data(6,0),p=assessStrategicStandings(s);
 assert.deepEqual(p.bounds,{best:1,worst:6});assert.equal(p.demotion,"not_applicable");assert.equal(p.promotion,"open");
 assert.equal(assessStrategicStandings({...s,rules:{...rules,verified:false}}).demotion,"unknown_rules");
});
test("missing and duplicate matches preserve full uncertainty; future snapshot rejected",async()=>{
 const {assessStrategicStandings}=await standings;const s=data(8,0);s.snapshot.rounds[0].matches[0].available=false;
 s.snapshot.rounds[1].matches[0].warTag=s.snapshot.rounds[2].matches[0].warTag;
 const p=assessStrategicStandings(s);assert.equal(p.quality,"partial");assert.ok(p.invalid>=2);assert.deepEqual(p.bounds,{best:1,worst:8});
 assert.equal(p.teams.find(x=>x.tag===t(0)).max.stars,385);assert.throws(()=>assessStrategicStandings({...s,asOf:now-1}),/invalid_standings_scope/);
});
test("finished ties preserve rank uncertainty; destruction wins earn ten bonus",async()=>{
 const {assessStrategicStandings}=await standings;const s=data(8,7,()=>30);
 const p=assessStrategicStandings(s);assert.equal(p.complete,true);assert.deepEqual(p.bounds,{best:1,worst:8});
 const w=s.snapshot.rounds[0].matches.find(w=>w.clan.tag===t(0)||w.opponent.tag===t(0));
 (w.clan.tag===t(0)?w.clan:w.opponent).destructionPercentage=51;
 const q=assessStrategicStandings(s);assert.deepEqual(q.bounds,{best:1,worst:1});assert.equal(q.teams.find(x=>x.tag===t(0)).min.stars,220);
});
test("guaranteed relegation and unfinished partial score lower bounds",async()=>{
 const {assessStrategicStandings}=await standings;const s=data(8,7,(a,b)=>a===0?0:45);
 const p=assessStrategicStandings(s);assert.equal(p.demotion,"guaranteed");assert.deepEqual(p.bounds,{best:8,worst:8});
 const q=data(8,0);const w=q.snapshot.rounds[0].matches.find(w=>w.clan.tag===t(0));w.state="inWar";w.clan.stars=20;w.clan.destructionPercentage=60;
 const x=assessStrategicStandings(q);assert.equal(x.teams.find(x=>x.tag===t(0)).min.stars,20);assert.equal(x.teams.find(x=>x.tag===t(0)).min.destruction,0);assert.equal(x.teams.find(x=>x.tag===t(0)).max.stars,385);
});
function targetData(){
 const roster=Array.from({length:15},(_,i)=>({tag:t(60+i),townHall:i===0?18:19,mapPosition:i+1}));
 const ownRoster=Array.from({length:15},(_,i)=>({tag:t(80+i),townHall:19,mapPosition:i+1}));
 const c=(defenderTh,smoothedStars,n=10)=>({kind:"cwl",attackerTh:19,defenderTh,smoothedStars,n});
 const profiles=[{playerTag:ownRoster[0].tag,townHall:19,contexts:[c(18,2),c(19,2.8)]},{playerTag:ownRoster[1].tag,townHall:19,contexts:[c(18,2.9),c(19,2)]}];
 return {group:{season,selectedClanTag:t(0),asOf:now,upcoming:[{day:2,warTag:t(30),opponentTag:t(1),teamSize:15,status:"confirmed_preparation_roster",roster,ownRoster}],profiles:[]},
  evidence:{asOf:now,profiles},selectedClanTag:t(0),season,day:2,asOf:now};
}
test("target pair swap only for demonstrated matchup improvement, unique targets and mirror elsewhere",async()=>{
 const {previewStrategicTargets}=await targets;const s=targetData(),frozen=JSON.stringify(s);
 const p=previewStrategicTargets(s);assert.ok(p.ok);assert.equal(p.changes.length,1);assert.equal(p.proposal[0].targetPosition,2);assert.equal(p.proposal[1].targetPosition,1);
 assert.equal(new Set(p.proposal.map(r=>r.targetTag)).size,15);assert.ok(p.proposal.slice(2).every(r=>r.attackerPosition===r.targetPosition));
 assert.equal(p.requiresConfirmation,true);assert.equal(JSON.stringify(s),frozen);
});
test("unknown or limited matchup evidence leaves mirror; no preparation/positions means no recommendation",async()=>{
 const {previewStrategicTargets}=await targets;const s=targetData();s.evidence.profiles[0].contexts[0].n=1;
 assert.deepEqual(previewStrategicTargets(s).changes,[]);assert.equal(previewStrategicTargets({...s,day:3}).ok,false);
 s.group.upcoming[0].roster[0].mapPosition=null;assert.equal(previewStrategicTargets(s).reason,"incomplete_positions");
 assert.throws(()=>previewStrategicTargets({...s,asOf:now-1}),/invalid_target_scope/);
});
