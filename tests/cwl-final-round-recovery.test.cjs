"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const load=()=>import("../supabase/functions/coc-cwl-status/final-round-recovery.mjs");
const tags=["#2PYL","#8PYL","#G9QL","#P9QL","#Q9QL","#R9QL","#J9QL","#C9QL"];
const now=Date.parse("2026-12-01T10:00:00Z");
const prior=(day,season="2026-11")=>({season,day,war_tag:"#P9QL2",team_size:15,state:"inWar"});
const group=(count,season="2026-11")=>({season,clan_tag:tags[0],group_json:{season,clanTag:tags[0],clans:tags.slice(0,count+1).map(tag=>({tag})),rounds:Array.from({length:count},(_,i)=>({day:i+1,matches:i===count-1?[{available:true,warTag:"#P9QL2",clan:{tag:tags[0]},opponent:{tag:tags[1]}}]:[]}))}});
test("Final round recovery supports five and seven actual official rounds",async()=>{
 const {finalRoundRecoveryCandidate:pick}=await load();
 for(const count of [5,7]){
  const result=pick(prior(count),group(count),tags[0],now);
  assert.equal(result.day,count);assert.equal(result.warCount,count);
  assert.equal(result.warTag,"#P9QL2");
 }
 assert.equal(pick(prior(5),null,tags[0],now),null);
 assert.equal(pick(prior(7),null,tags[0],now).day,7);
});
test("Never use an older season, wrong clan, incomplete format or inconsistent final war tag",async()=>{
 const {finalRoundRecoveryCandidate:pick}=await load();
 assert.equal(pick(prior(7,"2026-10"),group(5),tags[0],now),null);
 assert.equal(pick(prior(5),group(7),tags[0],now),null);
 assert.equal(pick(prior(7),group(7),tags[1],now),null);
 assert.equal(pick({...prior(5),war_tag:"#P9QL9"},group(5),tags[0],now),null);
 const incomplete=group(5);incomplete.group_json.rounds.pop();
 assert.equal(pick(prior(5),incomplete,tags[0],now),null);
 assert.equal(pick(prior(7,"2026-10"),null,tags[0],now),null);
});
