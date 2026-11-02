"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261102224500_cwl_plan_review_workflow.sql"),"utf8");

test("Separate, server-enforced plan approval cannot be bypassed by editors",()=>{
 assert.match(sql,/create table public\.cwl_plan_review_state/);
 assert.match(sql,/create table public\.cwl_plan_suggestions/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/private\.cwl_plan_can_write\(clan_id\)/);
 assert.match(sql,/private\.cwl_plan_is_locked\(p_clan\)/);
 assert.match(sql,/create trigger cwl_plan_guard before insert or update of profile_json/);
 assert.match(sql,/for share/);
 assert.match(sql,/revoke all on public\.cwl_plan_review_state from anon,authenticated/);
 assert.match(sql,/revoke all on public\.cwl_plan_suggestions from anon,authenticated/);
});
test("Suggestion acceptance is owner-only, revision-locked, and protects played history",()=>{
 assert.match(sql,/function public\.cwl_resolve_plan_suggestion/);
 assert.match(sql,/not private\.cwl_is_owner\(v_s\.clan_id\)/);
 assert.match(sql,/v_profile\.revision<>v_s\.base_revision/);
 assert.match(sql,/v_s\.suggested_profile->'locks' is distinct from v_profile\.profile_json->'locks'/);
 assert.match(sql,/v_s\.suggested_profile->'archives' is distinct from v_profile\.profile_json->'archives'/);
 assert.match(sql,/status=case when p_accept then 'accepted' else 'rejected' end/);
});
test("Suggestion creation requires an active owner lock and a real editor",()=>{
 assert.match(sql,/role='editor'/);
 assert.match(sql,/not v_state\.locked/);
 assert.match(sql,/season<>to_char\(now\(\) at time zone 'UTC','YYYY-MM'\)/);
 assert.match(sql,/v_profile\.revision<>p_base_revision/);
 assert.match(sql,/public\.cwl_withdraw_plan_suggestion/);
});
test("Cloud UI exposes owner approvals, editor drafts, and response history",()=>{
 for(const id of ["planReviewPanel","planReviewToggle","planSubmitSuggestion","planReviewSuggestions","planRefreshSuggestions"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(sync,/role==="editor"&&planIsLocked\(\)/);
 assert.match(sync,/cwl_submit_plan_suggestion/);
 assert.match(sync,/cwl_set_plan_lock/);
 assert.match(sync,/cwl_resolve_plan_suggestion/);
 assert.match(sync,/cwl_withdraw_plan_suggestion/);
 assert.match(sync,/Angenommen/);
 assert.match(sync,/Abgelehnt/);
 assert.match(sync,/openNewPlanCycle/);
 assert.match(html,/openNewCycle/);
});
test("Owner proposal diff uses text descriptions for member edits",()=>{
 const start=sync.indexOf("function suggestionChanges(suggestion){");
 const end=sync.indexOf("function renderPlanReview()",start);
 assert.ok(start>=0&&end>start);
 const current={members:[{id:"one",name:"Alpha",fixed:false,targetDays:3,statuses:Array(7).fill("auto")}],config:{slots:15},dayGoals:[]};
 const context={storage:{getProfile:()=>current}};
 const diff=vm.runInNewContext(sync.slice(start,end)+"\nsuggestionChanges",context);
 const result=diff({suggested_profile:{members:[{...current.members[0],fixed:true,targetDays:4}],config:current.config,dayGoals:[]}});
 assert.ok(result.some(x=>x.includes("Fix: false → true")));
 assert.ok(result.some(x=>x.includes("Einsatzziel: 3 → 4")));
});
