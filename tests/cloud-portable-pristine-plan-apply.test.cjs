"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const rpc=fs.readFileSync(path.join(root,
 "supabase/migrations/20261119181600_cwl_portable_pristine_plan_apply_rpc.sql"),"utf8");
const checkpoints=fs.readFileSync(path.join(root,
 "supabase/migrations/20261119181500_cwl_portable_plan_apply_checkpoints.sql"),"utf8");
const workflow=fs.readFileSync(path.join(root,
 ".github/workflows/portable-pristine-plan-apply-ci.yml"),"utf8");
const A="88888888-8888-4888-8888-888888888888";
const C="77777777-7777-4777-8777-777777777777";
const U="33333333-3333-4333-8333-333333333333";
function fakePlan(){
 return {
  id:"target-id",name:"Recovery target",
  members:[],archivedMembers:[],archives:[],
  config:{},dayGoals:[],cwlLive:{clanTag:"#P8Y2",rounds:[],warCount:0},
  locks:Array.from({length:7},()=>({locked:false,warTag:null,lineup:[],snapshots:{}})),
  updatedAt:0
 };
}
async function fixture(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(t=>[t.name,[]]));
 const profile=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.find(s=>
  s.name==="cwl_cloud_profiles").columns.map(k=>[k,null]));
 Object.assign(profile,{clan_id:A,revision:5,data_version:9,profile_json:fakePlan()});
 tables.cwl_cloud_profiles=[profile];
 return{core,snapshot:{
  kind:core.PORTABLE_CLOUD_BACKUP_KIND,
  format_version:1,created_at:"2026-11-19T18:20:00Z",
  consistency:"server-stable-statement",
  clans:[{source_clan_id:A,name:"Recovery target",
   clash_tag:"#P8Y2",tables}]
 }};
}
function outcome(applied,overrides={}){
 return{
  scope:"pristine-plan-planning-only",target_clan_id:A,candidate_id:C,
  expected_revision:5,result_revision:applied?6:5,applied,
  eligible_for_empty_target_apply:true,has_changes:true,target_is_empty:true,
  matches_staging_baseline:true,protected_days:0,existing_archive_rows:0,
  existing_wars:0,pending_editor_suggestions:0,member_count:1,
  checkpoint_id:applied?"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb":null,
  restored_fields:["members","dayGoals","config"],locks_preserved:true,
  archives_preserved:true,plan_approval_preserved:true,...overrides
 };
}
function fakeSb(snapshot,{result=outcome(false),error=false}={}){
 const calls=[];
 const sb={calls,
  auth:{getUser:async()=>({data:{user:{id:U}},error:null})},
  rpc:async(name,params)=>{
   calls.push({name,params});
   if(name==="cwl_export_owned_backup")return{data:snapshot,error:null};
   if(name==="cwl_apply_portable_pristine_plan"){
    return error?{data:null,error:{code:"40001"}}:{data:result,error:null};
   }
   throw Error("unexpected RPC: "+name);
  }
 };
 return sb;
}
test("DB plan apply is security invoker + owner/CAS and writes ONLY private checkpoint and current profile",()=>{
 assert.match(rpc,/SECURITY INVOKER\s+SET search_path=''/);
 assert.match(rpc,/m\.role='owner'/);
 assert.match(rpc,/c\.owner_user_id=v_user/);
 assert.match(rpc,/candidate\.source_clash_tag IS DISTINCT FROM v_owner_tag/);
 assert.match(rpc,/FOR UPDATE/);
 assert.match(rpc,/revision=v_revision/);
 assert.match(rpc,/APPLY_TO_EMPTY_CWL_PLAN/);
 assert.match(rpc,/target_before->'profile_json'/);
 assert.match(rpc,/source_profile_json/);
 assert.match(rpc,/Invalid planning-day goal structure/);
 assert.match(rpc,/g\.row_data->'strength'/);
 assert.match(rpc,/g\.row_data->'townHall'/);
 assert.match(rpc,/GROUP BY m\.row_data->>'playerTag' HAVING count\(\*\)>1/);
 assert.match(rpc,/jsonb_build_object\(\s*'members',v_source->'members',\s*'dayGoals',v_source->'dayGoals',\s*'config',v_source->'config'/);
 assert.match(rpc,/v_after_db->'locks'/);
 assert.match(rpc,/v_after_db->'archives'/);
 assert.match(rpc,/v_after_db->'cwlLive'/);
 assert.match(rpc,/v_after_db->'archivedMembers'/);
 const body=rpc.match(/AS \$apply_pristine\$([\s\S]*?)\$apply_pristine\$/)[1]
   .split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
 const inserted=[...body.matchAll(/\bINSERT INTO ([a-z_]+\.[a-z_]+)/gi)].map(m=>m[1]);
 const updated=[...body.matchAll(/\bUPDATE ([a-z_]+\.[a-z_]+)/gi)].map(m=>m[1]);
 assert.deepEqual(inserted,["private.cwl_portable_plan_apply_checkpoints"]);
 assert.deepEqual(updated,["public.cwl_cloud_profiles"]);
 assert.doesNotMatch(body,/\bDELETE FROM\b|\bTRUNCATE TABLE\b|SECURITY DEFINER/);
});
test("private-schema before/after checkpoint is owner-RLS, append-only and not exposed as public data table",async()=>{
 const core=await import("../cloud-portable-backup-core.mjs");
 assert.match(checkpoints,/CREATE SCHEMA IF NOT EXISTS private/);
 assert.match(checkpoints,/CREATE TABLE private\.cwl_portable_plan_apply_checkpoints/);
 assert.match(checkpoints,/ENABLE ROW LEVEL SECURITY/);
 assert.match(checkpoints,/BEFORE|before_profile_json/);
 assert.match(checkpoints,/applied_profile_json/);
 assert.match(checkpoints,/m\.role='owner'/);
 assert.match(checkpoints,/actor_user_id=\(select auth\.uid\(\)\)/);
 assert.doesNotMatch(checkpoints,/\bGRANT UPDATE\b|\bGRANT DELETE\b/);
 assert.doesNotMatch(core.PORTABLE_CLOUD_TABLES.map(t=>t.name).join(" "),/cwl_portable_plan_apply_checkpoints/);
 assert.doesNotMatch(core.PORTABLE_EXCLUDED_TABLES.join(" "),/cwl_portable_plan_apply_checkpoints/);
 assert.match(workflow,/postgres:17/);
 assert.match(workflow,/portable-pristine-plan-apply-check\.sql/);
 assert.doesNotMatch(workflow,/secrets\.|service_role|SUPABASE_DB_URL/);
});
test("browser preview reads owner-authorized target and never claims a real apply",async()=>{
 const {core,snapshot}=await fixture();
 const sb=fakeSb(snapshot);
 const view=await core.previewPortablePristinePlanApply({sb,candidateId:C,targetClanId:A});
 assert.equal(view.applied,false);
 assert.equal(view.mutationPermitted,false);
 assert.equal(view.eligible_for_empty_target_apply,true);
 assert.equal(view.expectedRevision,5);
 assert.equal(view.target_snapshot_consistency,"server-stable-statement");
 assert.equal(sb.calls.length,2);
 assert.equal(sb.calls[0].name,"cwl_export_owned_backup");
 assert.equal(sb.calls[1].name,"cwl_apply_portable_pristine_plan");
 assert.deepEqual(sb.calls[1].params,{
  p_candidate:C,p_expected_revision:5,p_apply:false,p_confirmation:null
 });
});
test("apply enforces strong user confirmation + fresh target revision and validates server checkpoint",async()=>{
 const {core,snapshot}=await fixture();
 const sb=fakeSb(snapshot,{result:outcome(true)});
 await assert.rejects(()=>core.applyPortablePristinePlan({
  sb,candidateId:C,targetClanId:A,expectedRevision:5,confirmation:"YES"
 }),/Bestätigung/);
 assert.equal(sb.calls.length,0);
 await assert.rejects(()=>core.applyPortablePristinePlan({
  sb,candidateId:C,targetClanId:A,expectedRevision:4,
  confirmation:"APPLY_TO_EMPTY_CWL_PLAN"
 }),/seit der Vorschau geändert/);
 assert.equal(sb.calls.filter(x=>x.name==="cwl_apply_portable_pristine_plan").length,0);
 const applied=await core.applyPortablePristinePlan({
  sb,candidateId:C,targetClanId:A,expectedRevision:5,
  confirmation:"APPLY_TO_EMPTY_CWL_PLAN"
 });
 assert.equal(applied.applied,true);
 assert.equal(applied.result_revision,6);
 assert.match(applied.checkpoint_id,/^[0-9a-f-]{36}$/);
 const rpcCall=sb.calls.find(x=>x.name==="cwl_apply_portable_pristine_plan");
 assert.equal(rpcCall.params.p_apply,true);
 assert.equal(rpcCall.params.p_candidate,C);
});
test("server refuses dirty target, missing rollback checkpoint, unauthorized requests and forged response",async()=>{
 const {core,snapshot}=await fixture();
 const ineligible=fakeSb(snapshot,{result:outcome(false,{
  eligible_for_empty_target_apply:false,target_is_empty:false,
  protected_days:1
 })});
 const view=await core.previewPortablePristinePlanApply({
  sb:ineligible,candidateId:C,targetClanId:A
 });
 assert.equal(view.eligible_for_empty_target_apply,false);
 assert.equal(view.protected_days,1);
 const bad=fakeSb(snapshot,{result:outcome(true,{checkpoint_id:null})});
 await assert.rejects(()=>core.applyPortablePristinePlan({
  sb:bad,candidateId:C,targetClanId:A,expectedRevision:5,
  confirmation:"APPLY_TO_EMPTY_CWL_PLAN"
 }),/unvollständigen Plan-Import/);
 const failed=fakeSb(snapshot,{error:true});
 await assert.rejects(()=>core.previewPortablePristinePlanApply({
  sb:failed,candidateId:C,targetClanId:A
 }),/vom Server abgelehnt/);
});
test("PG17 SQL fixture covers real trigger rollback, repeated apply, protected day, anonymous and foreign RLS",()=>{
 const sql=fs.readFileSync(path.join(root,"tests/sql/portable-pristine-plan-apply-check.sql"),"utf8");
 for(const word of ["APPLY_TO_EMPTY_CWL_PLAN","FAIL_AFTER_CHECKPOINT",
  "blocked protected target","protected day","repeated restore",
  "checkpoint","foreign owner","synthetic trigger failure","duplicate Clash player tags accepted"])
  assert.ok(sql.includes(word),word);
 assert.match(workflow,/SET ROLE anon/);
});
