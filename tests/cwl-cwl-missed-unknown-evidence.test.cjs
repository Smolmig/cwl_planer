"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const load=async()=>import(pathToFileURL(
  path.resolve(__dirname,"../cwl-stats-core.mjs")).href);
const alphabet="0289PYLQGRJCUV";
const tags=Array.from({length:15},(_,i)=>"#2P"+alphabet[i]+"L");
const makeWar=(key="cwl:#2QGL",overrides={})=>({
  clan_id:"synthetic-clan",war_key:key,war_type:"cwl",
  started_at:"2026-11-06T19:00:00.000Z",
  team_size:15,source:"api",finalized:true,
  roster_tags:[...tags],missed_log_complete:false,...overrides
});
const attacks=(key,count)=>tags.slice(0,count).map((tag,i)=>({
  war_key:key,attacker_tag:tag,attacker_name:"Player "+i,
  attack_order:1,attacker_th:18,defender_th:18,
  stars:3,destruction:100
}));

test("Historical final CWL 15/15, 14/15, 13/15 never imply missed completeness without official proof",async()=>{
 const {computeWarStats}=await load();
 for(const count of [15,14,13]){
  const war=makeWar(),rows=attacks(war.war_key,count);
  const stats=computeWarStats([war],rows,{type:"cwl",last:"all",cwlSeasons:"all"});
  assert.equal(stats.wars,1);
  assert.equal(stats.attacks,count,"Real attack statistics remain available");
  assert.equal(stats.hitRate,count?100:null);
  assert.equal(stats.missedCoverage.cwl.wars,1);
  assert.equal(stats.missedCoverage.cwl.coveredWars,0);
  assert.equal(stats.missedCoverage.cwl.complete,false);
  assert.equal(stats.complete,false);
  assert.equal(stats.misses,null,"Unknown is not zero or estimated missed");
  assert.equal(stats.missesKnown,0,"Absent attack rows cannot become known misses");
  assert.ok(stats.rows.every(row=>row.missed===null&&row.missedKnown===0&&
    row.missedComplete===false));
  for(const unknownTag of tags.slice(count)){
   assert.equal(stats.rows.some(p=>p.tag===unknownTag),false,
     "Unattacked roster slots must not become fake missed-attack player rows");
  }
 }
});

test("A partial, explicitly documented missed event is a lower bound, not proof of completeness",async()=>{
 const {computeWarStats}=await load();
 const war=makeWar(),missedEvents=[{
   war_key:war.war_key,player_tag:tags[14],player_name:"Documented",
   missed_count:1
 }];
 const s=computeWarStats([war],attacks(war.war_key,13),{
   type:"cwl",last:"all",cwlSeasons:"all",missedEvents
 });
 assert.equal(s.misses,null);
 assert.equal(s.missesKnown,1);
 assert.equal(s.complete,false);
 assert.equal(s.missedCoverage.cwl.coveredWars,0);
 const documented=s.rows.find(x=>x.tag===tags[14]);
 assert.ok(documented);
 assert.equal(documented.missedKnown,1);
 assert.equal(documented.missed,null);
 assert.equal(s.rows.some(x=>x.tag===tags[13]),false);
});

test("Fully confirmed CWL remains exact for 0 and multiple misses; unknown other CWL day poisons combined completeness",async()=>{
 const {computeWarStats}=await load();
 const proved=makeWar("cwl:#2QGL",{missed_log_complete:true});
 const second=makeWar("cwl:#2QRL",{started_at:"2026-11-05T19:00:00.000Z"});
 const logged=[{
   war_key:proved.war_key,player_tag:tags[14],player_name:"Confirmed",
   missed_count:1
 }];
 const only=computeWarStats([proved],attacks(proved.war_key,14),{
   type:"cwl",last:"all",cwlSeasons:"all",missedEvents:logged
 });
 assert.equal(only.complete,true);
 assert.equal(only.misses,1);
 assert.equal(only.missedCoverage.cwl.coveredWars,1);
 const completeZero=computeWarStats([{...proved,missed_log_complete:true}],
   attacks(proved.war_key,15),{type:"cwl",last:"all",cwlSeasons:"all"});
 assert.equal(completeZero.misses,0);
 assert.equal(completeZero.complete,true);
 const combined=computeWarStats([proved,second],
   [...attacks(proved.war_key,14),...attacks(second.war_key,15)],{
     type:"cwl",last:"all",cwlSeasons:"all",missedEvents:logged
   });
 assert.equal(combined.misses,null);
 assert.equal(combined.missesKnown,1);
 assert.equal(combined.missedCoverage.cwl.coveredWars,1);
 assert.equal(combined.missedCoverage.cwl.wars,2);
 assert.equal(combined.missedCoverage.cwl.complete,false);
});

test("Normal CW and imported historical CWL evidence stay separate",async()=>{
 const {computeWarStats}=await load();
 const normal={
   ...makeWar("normal:synthetic-war",{
     war_type:"normal",source:"api",team_size:15,missed_log_complete:false
   })
 };
 const cw=computeWarStats([normal],attacks(normal.war_key,29).map((a,i)=>({
   ...a,attacker_tag:tags[i%15],attack_order:Math.floor(i/15)+1
 })),{type:"normal",last:"all"});
 assert.equal(cw.complete,true,"Normal CW keeps its established full-roster fallback");
 assert.equal(cw.missedCoverage.normal.coveredWars,1);
 const unproved=makeWar();
 const both=computeWarStats([normal,unproved],
   [...attacks(normal.war_key,15),...attacks(unproved.war_key,14)],{
     type:"all",last:"all",cwlSeasons:"all"
   });
 assert.equal(both.missedCoverage.normal.complete,true);
 assert.equal(both.missedCoverage.cwl.complete,false);
 assert.equal(both.complete,false);
 assert.equal(both.misses,null);
});
