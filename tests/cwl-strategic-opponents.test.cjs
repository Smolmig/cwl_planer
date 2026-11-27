"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const model=import("../cwl-strategic-opponents.mjs");
const alphabet="0289PYLQGRJCUV",now=Date.UTC(2026,10,26),season="2026-11";
const mkTag=i=>"#P"+alphabet[Math.floor(i/13)%13]+alphabet[i%13];
const clans=Array.from({length:6},(_,i)=>({tag:mkTag(i)}));
const member=(clan,i,extra={})=>({tag:mkTag(10+clan*15+i),townhallLevel:19,mapPosition:i+1,attacks:[],...extra});
const side=(clan)=>({tag:clans[clan].tag,members:Array.from({length:15},(_,i)=>member(clan,i))});
function war(a,b,key,state="warEnded"){
 return {available:true,warTag:mkTag(110+key),state,teamSize:15,attacksPerMember:1,clan:side(a),opponent:side(b)};
}
function hit(a,b,order,stars=3){a.attacks=[{attackerTag:a.tag,defenderTag:b.tag,stars,destructionPercentage:stars===3?100:75,order}]}
const input=rounds=>({snapshot:{season,clanTag:clans[0].tag,observedAt:now,clans,rounds},selectedClanTag:clans[0].tag,season,asOf:now});
test("foreign pairings reveal separate attack and defense by matchup; repeated hits are not repeated wars",async()=>{
 const {analyzeCwlGroup}=await model;
 const w=war(1,2,1),w2=war(1,3,2);const target=w.clan.members[0];
 w.opponent.members[0].townhallLevel=18;
 hit(w.opponent.members[0],target,1,2);hit(w.opponent.members[1],target,2,3);
 hit(target,w.opponent.members[2],3,3);hit(w2.opponent.members[0],w2.clan.members[0],1,3);
 const result=analyzeCwlGroup(input([{day:1,matches:[w]},{day:2,matches:[w2]}]));
 const p=result.profiles.find(x=>x.playerTag===target.tag);
 assert.equal(p.attack.n,1);assert.equal(p.attack.triples,1);assert.equal(p.defense.n,3);
 assert.equal(p.defense.observedWars,2);assert.equal(p.defense.tripledWars,2);assert.equal(p.defense.firstHits.n,2);
 assert.equal(p.defense.firstHits.triples,1);assert.equal(p.defense.byTownHall.find(x=>x.relation==="lowerAttacker").n,1);
 assert.equal(p.layoutUnverified,true);assert.equal(result.calibrated,false);
});
test("only actual preparation roster exposed, future snapshot forbidden, no false defense on untouched bases",async()=>{
 const {analyzeCwlGroup}=await model;const w=war(0,1,1,"preparation");hit(w.opponent.members[0],w.clan.members[0],1);
 const data=input([{day:1,matches:[w]}]);const frozen=JSON.stringify(data);
 const p=analyzeCwlGroup(data);assert.equal(p.profiles.length,0);assert.equal(p.upcoming.length,1);assert.equal(p.upcoming[0].roster.length,15);
 assert.equal(p.upcoming[0].roster[0].mapPosition,1);assert.equal(JSON.stringify(data),frozen);
 assert.throws(()=>analyzeCwlGroup({...data,asOf:now-1}),/invalid_group_scope_or_cutoff/);
 assert.throws(()=>analyzeCwlGroup({...data,selectedClanTag:clans[1].tag}),/invalid_group_scope_or_cutoff/);
});
test("partial attack logs and unknown order do not produce first-hit certainty or inferred misses",async()=>{
 const {analyzeCwlGroup}=await model;const w=war(0,1,1,"inWar");
 hit(w.clan.members[0],w.opponent.members[0],2);delete w.clan.members[1].attacks;
 const p=analyzeCwlGroup(input([{day:1,matches:[w]}]));assert.equal(p.audit.incompleteAttackLogs,1);
 assert.equal(p.audit.unknownAttackOrder,1);assert.equal(p.profiles.length,2);
 const d=p.profiles.find(x=>x.playerTag===w.opponent.members[0].tag);assert.equal(d.defense.n,1);assert.equal(d.defense.firstHitUnknown,1);assert.equal(d.defense.firstHits.n,0);
});
test("duplicates, impossible pairings, special format and malformed attack targets fail closed",async()=>{
 const {analyzeCwlGroup}=await model;const w=war(0,1,1),w2=war(2,3,2),w3=war(4,5,3);
 w2.attacksPerMember=2;hit(w3.clan.members[0],w.clan.members[0],1);
 const p=analyzeCwlGroup(input([{day:1,matches:[w,w2,w3]},{day:2,matches:[w]}]));
 assert.equal(p.audit.duplicateWar,2);assert.equal(p.audit.excludedSpecialFormat,1);assert.equal(p.audit.incompleteAttackLogs,1);
 assert.equal(p.profiles.length,0);assert.equal(p.upcoming.length,0);
});
test("opponent TH upgrades separate contexts; same-day competing rosters rejected",async()=>{
 const {analyzeCwlGroup}=await model;const w=war(1,2,1),w2=war(1,3,2);
 hit(w.clan.members[0],w.opponent.members[0],1);
 w2.clan.members[0].townhallLevel=20;hit(w2.clan.members[0],w2.opponent.members[0],1);
 const p=analyzeCwlGroup(input([{day:1,matches:[w]},{day:2,matches:[w2]}]));
 assert.deepEqual(p.profiles.filter(x=>x.playerTag===w.clan.members[0].tag).map(x=>x.townHall),[19,20]);
 const invalid=analyzeCwlGroup(input([{day:1,matches:[w,w2]}]));assert.equal(invalid.audit.invalid,2);assert.equal(invalid.profiles.length,0);
});
