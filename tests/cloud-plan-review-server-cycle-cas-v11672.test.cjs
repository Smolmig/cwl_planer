"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=p=>fs.readFileSync(path.resolve(__dirname,"..",p),"utf8");
const sync=read("cloud-sync.mjs");
const migration=read("supabase/migrations/20261111163500_cwl_review_cycle_cas_checked_rpc.sql");
const retire=read("supabase/migrations/20261111164500_cwl_review_retire_legacy_rpc.sql");

test("all four new RPCs accept server cycle and season tokens",()=>{
 for(const method of ["cwl_set_plan_lock_checked","cwl_submit_plan_suggestion_checked",
  "cwl_resolve_plan_suggestion_checked","cwl_withdraw_plan_suggestion_checked"]){
  assert.match(migration,new RegExp("function public\\."+method+"\\("));
  assert.match(sync,new RegExp('sb\\.rpc\\("'+method+'"'));
 }
 assert.match(migration,/p_expected_cycle uuid,p_expected_season text/);
 assert.match(sync,/reviewCycleToken=\(\)=>\(\{/);
 assert.match(sync,/p_expected_cycle:planReview\?\.cycle_id\|\|null/);
 assert.match(sync,/p_expected_season:planReview\?\.season\|\|currentSeason\(\)/);
});
test("checked owner lock validates and serializes the state before legacy mutation",()=>{
 assert.match(migration,/select \* into v_state from public\.cwl_plan_review_state[\s\S]*?where clan_id=p_clan for update/);
 assert.match(migration,/p_expected_cycle is distinct from v_state\.cycle_id/);
 assert.match(migration,/p_expected_season is distinct from v_state\.season/);
 assert.match(migration,/raise exception 'stale_plan_cycle'/);
 assert.match(migration,/return public\.cwl_set_plan_lock\(p_clan,p_locked,p_new_cycle\)/);
 assert.match(migration,/v_state\.season<>v_current/);
});
test("finished season evidence is server-only and never inferred from missing 6/7 results",()=>{
 assert.match(migration,/from public\.cwl_group_archives g/);
 assert.match(migration,/@\.state == "warEnded"/);
 assert.match(migration,/\.rounds\[6\]\.matches/);
 assert.match(migration,/upper\(g\.clan_tag\)=upper\(c\.clash_tag\)/);
 assert.match(migration,/cwl_season_finished/);
 assert.doesNotMatch(migration,/update public\.cwl_cloud_profiles/i);
 assert.doesNotMatch(migration,/delete from public\.cwl_/i);
 assert.match(retire,/revoke execute on function public\.cwl_set_plan_lock\(/);
 assert.match(retire,/revoke execute on function public\.cwl_submit_plan_suggestion\(/);
 assert.match(retire,/revoke execute on function public\.cwl_resolve_plan_suggestion\(/);
 assert.match(retire,/revoke execute on function public\.cwl_withdraw_plan_suggestion\(/);
});
test("owner sends the exact old token, never a newly read cycle after confirmation",async()=>{
 const src=sync.slice(sync.indexOf("async function togglePlanLock(){"),sync.indexOf("async function submitPlanSuggestion(){"));
 let rpc=null,cycle="cycle-one",clan="clan-one";
 const ctx={
  clanId:clan,role:"owner",accountEpoch:1,planReview:{cycle_id:cycle},
  assertReviewSeasonAvailable:()=>{},reviewCycleToken:()=>({p_expected_cycle:cycle,p_expected_season:"2026-11"}),
  planIsLocked:()=>false,assertPlanningReady:()=>{},
  storage:{getProfile:()=>({}),confirmAction:async()=>true,toast:()=>{}},
  ensureSaved:async()=>{},sb:{rpc:async(name,args)=>{rpc={name,args};return {error:null};}},
  reviewRpcError:e=>e,loadPlanReview:async()=>{}
 };
 const run=vm.runInNewContext(src+";togglePlanLock",ctx);
 await run();
 assert.equal(rpc.name,"cwl_set_plan_lock_checked");
 assert.equal(rpc.args.p_expected_cycle,"cycle-one");
 assert.equal(rpc.args.p_expected_season,"2026-11");
 rpc=null;
 ctx.storage.confirmAction=async()=>{cycle="cycle-two";ctx.planReview.cycle_id=cycle;return true;};
 await assert.rejects(run(),/Clan oder Saison/);
 assert.equal(rpc,null);
});
test("proposal submit includes token and preserves backed-up played history",()=>{
 const proposalTest=read("tests/cloud-proposal-history-compat.test.cjs");
 assert.match(proposalTest,/p_expected_cycle:"test-cycle"/);
 assert.match(proposalTest,/cwl_submit_plan_suggestion_checked/);
});
