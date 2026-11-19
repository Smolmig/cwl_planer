"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const migration=fs.readFileSync(path.join(root,
 "supabase/migrations/20261119180400_cwl_portable_plan_recovery_staging_rpc.sql"),"utf8");
const table=fs.readFileSync(path.join(root,
 "supabase/migrations/20261119180200_cwl_portable_plan_recovery_candidates.sql"),"utf8");
const workflow=fs.readFileSync(path.join(root,
 ".github/workflows/portable-plan-recovery-ci.yml"),"utf8");
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const OWNER="33333333-3333-4333-8333-333333333333";
const DATE="2026-11-19T17:15:00Z";
function tablesFor(core,clanId){
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(s=>[s.name,[]]));
 const empty=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.find(s=>
  s.name==="cwl_cloud_profiles").columns.map(k=>[k,null]));
 Object.assign(empty,{
  clan_id:clanId,data_version:9,revision:4,
  profile_json:{id:"synthetic",name:"United Fighters",
   members:[{tag:"#P8Y2"}],archivedMembers:[],
   config:{},dayGoals:[],cwlLive:{clanTag:"#P8Y2"},
   locks:Array.from({length:7},()=>({locked:false,lineup:[],snapshots:{}})),
   archives:[]}
 });
 tables.cwl_cloud_profiles=[empty];
 return tables;
}
async function setup(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const file=await core.createPortableCloudBackup({
  clans:[{source_clan_id:A,name:"United Fighters",clash_tag:"#P8Y2",
   tables:tablesFor(core,A)}],
  consistency:"server-stable-statement",createdAt:DATE
 });
 return{core,file,target:{kind:core.PORTABLE_CLOUD_BACKUP_KIND,
  format_version:1,consistency:"server-stable-statement",created_at:DATE,
  clans:[{source_clan_id:B,name:"United Fighters",clash_tag:"#P8Y2",
   tables:tablesFor(core,B)}]}};
}
function fakeClient(payload,{staged=false,fail=false}={}){
 const calls=[];
 const sb={calls,
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==="cwl_export_owned_backup")return{data:payload,error:null};
   if(name==="cwl_stage_portable_plan_recovery"){
    if(fail)return{data:null,error:{code:"42501"}};
    return{data:{
     scope:"plan-archive-review-only",target_clan_id:B,target_revision:4,
     staged,active_plan_modified:false,archives_modified:false,
     mutation_permitted:false,target_protected_days:1,
     plan_identical:false,source_members:1,target_members:1,
     candidate_id:staged?"77777777-7777-4777-8777-777777777777":null,
     group_archives:{new:1,identical:0,conflict:0},
     own_lineup_archives:{new:0,identical:1,conflict:0}
    },error:null};
   }
   throw Error("Unexpected RPC "+name);
  }
 };
 return sb;
}
test("plan staging SQL stays SECURITY INVOKER and never touches active plans or collector archives",()=>{
 assert.match(migration,/SECURITY INVOKER\s+SET search_path = ''/);
 assert.match(migration,/m\.role='owner'/);
 assert.match(migration,/c\.owner_user_id=v_owner/);
 assert.match(migration,/p_expected_revision/);
 assert.match(migration,/FOR SHARE/);
 assert.match(migration,/STAGE_PLAN_FOR_MANUAL_REVIEW/);
 assert.match(migration,/active_plan_modified',false/);
 assert.match(migration,/archives_modified',false/);
 const body=migration.match(/AS \$plan_stage\$([\s\S]*?)\$plan_stage\$/)[1]
   .split("\n").filter(s=>!s.trimStart().startsWith("--")).join("\n");
 assert.deepEqual([...body.matchAll(/\bINSERT INTO public\.(cwl_[a-z_]+)/gi)]
   .map(x=>x[1]),["cwl_portable_plan_recovery_candidates"]);
 for(const pattern of [/\bUPDATE\s+public\.cwl_/i,
  /\bDELETE\s+FROM\s+public\.cwl_/i,
  /\bTRUNCATE\s+public\.cwl_/i,/\bSECURITY DEFINER\b/i])
  assert.doesNotMatch(body,pattern);
 assert.match(migration,/target_before/);
 assert.match(migration,/source_own_lineup_archives/);
});
test("candidate table is RLS-backed, append-only, owner-only; collector archives remain restricted",()=>{
 assert.match(table,/ENABLE ROW LEVEL SECURITY/);
 assert.match(table,/actor_user_id uuid NOT NULL DEFAULT auth\.uid\(\)/);
 assert.match(table,/role='owner'/);
 assert.match(table,/source_group_archives jsonb/);
 assert.match(table,/source_own_lineup_archives jsonb/);
 assert.match(table,/target_before jsonb NOT NULL/);
 assert.match(table,/UNIQUE \(\s*clan_id,source_clan_id,source_revision,target_revision\)/);
 assert.match(table,/REVOKE ALL ON public\.cwl_portable_plan_recovery_candidates/);
 assert.doesNotMatch(table,/\bGRANT\s+(?:UPDATE|DELETE)/i);
 const cols=table.match(/GRANT INSERT \(([\s\S]*?)\) ON public\.cwl_portable_plan_recovery_candidates/);
 assert.ok(cols);
 assert.doesNotMatch(cols[1],/\b(?:actor_user_id|created_at|id)\b/);
 assert.match(workflow,/postgres:17/);
 assert.match(workflow,/portable-plan-recovery-check\.sql/);
 assert.doesNotMatch(workflow,/secrets\.|service_role|SUPABASE_DB_URL/);
});
test("browser plan preview uses one owner snapshot and exactly four allowed tables",async()=>{
 const {core,file,target}=await setup();
 const sb=fakeClient(target);
 const reply=await core.previewPortablePlanArchiveRecovery({
  sb,file,sourceClanId:A,targetClanId:B
 });
 assert.equal(reply.mutationPermitted,false);
 assert.equal(reply.target_protected_days,1);
 assert.equal(reply.group_archives.new,1);
 assert.equal(sb.calls.length,2);
 assert.equal(sb.calls[0].name,"cwl_export_owned_backup");
 assert.equal(sb.calls[1].name,"cwl_stage_portable_plan_recovery");
 assert.equal(sb.calls[1].args.p_stage,false);
 assert.equal(sb.calls[1].args.p_confirmation,null);
 assert.deepEqual(Object.keys(sb.calls[1].args.p_source.tables).sort(),
  ["cwl_cloud_profiles","cwl_group_archives",
   "cwl_own_lineup_archives","cwl_plan_review_state"].sort());
 assert.deepEqual(sb.calls[1].args.p_source.tables.cwl_cloud_profiles[0].profile_json.locks,
  file.clans[0].tables.cwl_cloud_profiles[0].profile_json.locks);
});
test("candidate staging requires explicit confirmation and never implies active restore",async()=>{
 const {core,file,target}=await setup();
 const sb=fakeClient(target,{staged:true});
 await assert.rejects(()=>core.previewPortablePlanArchiveRecovery({
  sb,file,sourceClanId:A,targetClanId:B,stage:true,confirmation:"YES"
 }),/Bestätigung/);
 assert.equal(sb.calls.length,0);
 const stage=await core.previewPortablePlanArchiveRecovery({
  sb,file,sourceClanId:A,targetClanId:B,
  stage:true,confirmation:"STAGE_PLAN_FOR_MANUAL_REVIEW"
 });
 assert.equal(stage.staged,true);
 assert.equal(stage.mutationPermitted,false);
 assert.equal(stage.active_plan_modified,false);
 assert.equal(stage.archives_modified,false);
 assert.match(stage.candidate_id,/^[0-9a-f-]{36}$/);
 assert.equal(sb.calls[1].args.p_expected_revision,4);
 assert.equal(sb.calls[1].args.p_stage,true);
});
test("tampered/non-atomic files and cross-Clash mapping fail closed before staging",async()=>{
 const {core,file,target}=await setup();
 const tamper=JSON.parse(JSON.stringify(file));
 tamper.clans[0].tables.cwl_cloud_profiles[0].profile_json.name="attacker";
 const sb=fakeClient(target);
 await assert.rejects(()=>core.previewPortablePlanArchiveRecovery({
  sb,file:tamper,sourceClanId:A,targetClanId:B
 }),/Integritätsprüfung/);
 assert.equal(sb.calls.length,0);
 const clientFile=await core.createPortableCloudBackup({
  clans:file.clans,createdAt:DATE,consistency:"client-read-non-atomic"
 });
 await assert.rejects(()=>core.previewPortablePlanArchiveRecovery({
  sb,file:clientFile,sourceClanId:A,targetClanId:B
 }),/konsistenten Server-Snapshot/);
 target.clans[0].clash_tag="#QL8P";
 await assert.rejects(()=>core.previewPortablePlanArchiveRecovery({
  sb,file,sourceClanId:A,targetClanId:B
 }),/stimmen nicht überein/);
});
test("RPC owner denial and forged stage reply do not claim success",async()=>{
 const {core,file,target}=await setup();
 const denied=fakeClient(target,{fail:true});
 await assert.rejects(()=>core.previewPortablePlanArchiveRecovery({
  sb:denied,file,sourceClanId:A,targetClanId:B
 }),/Vergleich ist fehlgeschlagen/);
 const bad=fakeClient(target);
 const rpc=bad.rpc;
 bad.rpc=async(name,args)=>{
  const x=await rpc(name,args);
  if(name==="cwl_stage_portable_plan_recovery")
   x.data.active_plan_modified=true;
  return x;
 };
 await assert.rejects(()=>core.previewPortablePlanArchiveRecovery({
  sb:bad,file,sourceClanId:A,targetClanId:B
 }),/ungültige Antwort/);
});
