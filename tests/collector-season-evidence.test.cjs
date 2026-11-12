"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const load=()=>import(pathToFileURL(path.join(root,
  "supabase/functions/coc-stats-collector/collector-season-evidence.mjs")).href);
const tags=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const wars=["#2PL0","#2PL2","#2PL8","#2PL9","#2PLP","#2PLY","#2PLQ"];
function group(clans=8,{state="preparation",rounds=0,season="2026-12-02"}={}){
  return {season,state,clans:tags.slice(0,clans).map(tag=>({tag})),
    rounds:Array.from({length:rounds},(_,i)=>({warTags:[wars[i]]}))};
}
test("official new six/eight-clan groups are valid, even before first war",async()=>{
 const {verifiedLeagueObservation:verify}=await load();
 for(const [count,days] of [[6,5],[8,7]]){
  const early=verify(group(count),tags[0]);
  assert.equal(early.season,"2026-12");
  assert.equal(early.war_count,days);
  assert.equal(early.rounds_count,0);
  assert.deepEqual(early.group_tags,tags.slice(0,count).sort());
  const underway=verify(group(count,{state:"inWar",rounds:days}),tags[0]);
  assert.equal(underway.group_state,"inWar");
  assert.equal(underway.rounds_count,days);
  const ended=verify(group(count,{state:"ended",rounds:days}),tags[0]);
  assert.equal(ended.group_state,"ended");
  assert.equal(ended.war_count,days);
 }
});
test("no group evidence from unknown, malformed, foreign or ambiguous league data",async()=>{
 const {verifiedLeagueObservation:verify}=await load();
 const candidates=[
  null,{state:"notInWar",season:"2026-12",clans:[],rounds:[]},
  group(8,{season:"2026-00"}),group(8,{season:"2026-13"}),
  group(8,{state:"ended",rounds:0}),group(8,{state:"inWar",rounds:0}),
  group(8,{rounds:6}),group(6,{rounds:7}),
  {...group(8),clans:tags.slice(0,7).map(tag=>({tag}))},
  {...group(8),clans:tags.map(tag=>({tag:tags[0]}))},
  {...group(8),clans:tags.map((tag,i)=>({tag:i===2?"#BAD!":tag}))},
  {...group(8,{rounds:7}),rounds:[{warTags:[wars[0],wars[0]]}]},
  {...group(8,{rounds:7}),rounds:[{warTags:[wars[0]]},{warTags:[wars[0]]},...Array.from({length:5},()=>({warTags:[]}))]},
  {...group(8,{rounds:7}),rounds:Array.from({length:7},()=>({warTags:"invalid"}))}
 ];
 for(const value of candidates){
  assert.equal(verify(value,tags[0]),null,JSON.stringify(value));
 }
 assert.equal(verify(group(8),"#2LQQ"),null,"a different tenant is not in this league");
 assert.equal(verify(group(8),"invalid!"),null);
});
test("same Clash clan can have separate app-clan identities; helper never includes a tenant id",async()=>{
 const {verifiedLeagueObservation:verify}=await load();
 const a=verify(group(8),"#2PYL");
 const b=verify(group(8),"2PYL");
 assert.deepEqual(a,b);
 assert.equal(Object.hasOwn(a,"clan_id"),false);
 assert.equal(Object.hasOwn(a,"cycle_id"),false);
 assert.equal(Object.hasOwn(a,"completed"),false);
});
test("collector stores only same-tag evidence; no plan/cycle mutation in phase 1",()=>{
 const collector=fs.readFileSync(path.join(root,"supabase/functions/coc-stats-collector/index.ts"),"utf8");
 const helper=fs.readFileSync(path.join(root,
  "supabase/functions/coc-stats-collector/collector-season-evidence.mjs"),"utf8");
 const migration=fs.readFileSync(path.join(root,
  "supabase/migrations/20261112101500_cwl_verified_league_observations.sql"),"utf8");
 assert.match(collector,/verifiedLeagueObservation\(group,gameTag\)/);
 assert.match(collector,/cwl_verified_league_observations/);
 assert.match(collector,/clan_id:id/);
 assert.doesNotMatch(helper,/cwl_set_plan_lock|resetPlanningData|archiveCurrentCwl/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(migration,/REVOKE ALL ON public\.cwl_verified_league_observations\s+FROM PUBLIC,anon,authenticated/i);
 assert.match(migration,/GRANT SELECT,INSERT,UPDATE ON public\.cwl_verified_league_observations\s+TO service_role/i);
 assert.doesNotMatch(migration,/GRANT .* TO authenticated/i);
 assert.doesNotMatch(migration,/DELETE FROM|UPDATE public\.cwl_cloud_profiles/i);
});
