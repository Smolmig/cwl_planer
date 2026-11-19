"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261119165000_cwl_portable_war_facts_restore_v1.sql"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/portable-cloud-restore-ci.yml"),"utf8");
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const OWNER="33333333-3333-4333-8333-333333333333";
const DATE="2026-11-19T15:40:00Z";
async function data(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(t=>[t.name,[]]));
 const profile=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.find(t=>t.name==="cwl_cloud_profiles").columns.map(k=>[k,null]));
 Object.assign(profile,{clan_id:A,data_version:9,revision:4,
  profile_json:{name:"United Fighters",members:[],locks:[],archives:[]}});
 tables.cwl_cloud_profiles=[profile];
 const file=await core.createPortableCloudBackup({clans:[
  {source_clan_id:A,name:"United Fighters",clash_tag:"#P8Y2",tables}
 ],createdAt:DATE,consistency:"server-stable-statement"});
 const target=JSON.parse(JSON.stringify(file));
 const original=target.clans[0];
 original.source_clan_id=B;
 for(const row of original.tables.cwl_cloud_profiles)row.clan_id=B;
 target.clans[0].tables=original.tables;
 target.clans[0].source_clan_id=B;
 return{core,file,targetEnvelope:{
  kind:core.PORTABLE_CLOUD_BACKUP_KIND,format_version:1,created_at:DATE,
  consistency:"server-stable-statement",clans:target.clans
 }};
}
function mock({targetEnvelope,respond,fail=false}){
 const calls=[];
 const sb={calls,
  auth:{async getUser(){return{data:{user:{id:OWNER}},error:null};}},
  async rpc(name,params){
   calls.push({name,params});
   if(name==="cwl_export_owned_backup")
    return{data:targetEnvelope,error:null};
   if(name==="cwl_restore_portable_facts_atomic")
    return fail?{data:null,error:{code:"40001"}}:
     {data:typeof respond==="function"?respond(params):respond,error:null};
   throw Error("Unexpected RPC "+name);
  }
 };
 return sb;
}
const result=(applied)=>({target_clan_id:B,scope:"war-facts-only",applied,
 wars:{new:2,identical:0,conflict:0},
 attacks:{new:4,identical:0,conflict:0},
 missed:{new:1,identical:0,conflict:0},
 review_only_other_rows:4,api_wars_imported_as_unverified:2});
test("restore SQL has invoker + owner/membership + CAS + explicit human confirm",()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.cwl_restore_portable_facts_atomic\(/);
 assert.match(sql,/SECURITY INVOKER\s+SET search_path = ''/);
 assert.match(sql,/m\.role='owner'/);
 assert.match(sql,/c\.owner_user_id=v_owner/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/v_revision IS DISTINCT FROM p_expected_revision/);
 assert.match(sql,/RESTORE_VERIFIED_WAR_FACTS/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/hashtextextended\(p_target::text,424242\)/);
 assert.match(sql,/ON CONFLICT \(clan_id,war_key\) DO NOTHING/);
 assert.match(sql,/ON CONFLICT \(clan_id,war_key,attacker_tag,attack_order\) DO NOTHING/);
 assert.match(sql,/ON CONFLICT \(clan_id,war_key,player_tag\) DO NOTHING/);
 assert.match(sql,/v_conflict_wars\+v_conflict_attacks\+v_conflict_missed/);
 assert.match(sql,/RAISE EXCEPTION 'portable war facts conflict/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.cwl_restore_portable_facts_atomic/);
 assert.match(sql,/TO authenticated;/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.cwl_restore_portable_facts_atomic[\s\S]*?FROM PUBLIC,anon,authenticated/);
});
test("no API masquerade and no changes to plans, archives or audit",()=>{
 assert.match(sql,/'import',CASE WHEN pg_catalog\.jsonb_typeof/);
 assert.match(sql,/'source_clash_tag',?NULL|false,NULL/);
 assert.match(sql,/IF v_existing_source='api' THEN/);
 assert.match(sql,/review_only_other_rows/);
 const executable=sql.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
 assert.doesNotMatch(executable,/\bUPDATE\s+public\.cwl_/i);
 assert.doesNotMatch(executable,/\bDELETE\s+FROM\s+public\.cwl_/i);
 assert.doesNotMatch(executable,/\bTRUNCATE\s+public\.cwl_/i);
 const inserted=[...executable.matchAll(/\bINSERT INTO public\.(cwl_[a-z_]+)/gi)].map(m=>m[1]);
 assert.deepEqual([...new Set(inserted)].sort(),["cwl_stat_attacks","cwl_stat_missed","cwl_stat_wars"]);
 for(const name of ["cwl_cloud_profiles","cwl_plan_review_state","cwl_group_archives","cwl_own_lineup_archives","cwl_clan_review_decisions"])
  assert.ok(!inserted.includes(name));
});
test("SQL CI uses synthetic PG17 and tests preview, rollback, API origin, anon",()=>{
 assert.match(workflow,/image: postgres:17/);
 assert.match(workflow,/portable-cloud-restore-check\.sql/);
 assert.match(workflow,/SET ROLE anon/);
 assert.doesNotMatch(workflow,/SUPABASE_DB_URL|service_role|secrets\./i);
 const testSql=fs.readFileSync(path.join(root,"tests/sql/portable-cloud-restore-check.sql"),"utf8");
 for(const token of ["rollback4","restored3","missing confirmation accepted",
  "second restore duplicated data","API-missed injection incorrectly allowed",
  "foreign clan accepted","stale plan revision accepted","duplicate war keys accepted"])
  assert.ok(testSql.includes(token),token);
});
test("client preview verifies signed-file structure, target role and never enables mutation",async()=>{
 const {core,file,targetEnvelope}=await data();
 const sb=mock({targetEnvelope,respond:result(false)});
 const preview=await core.previewPortableWarFactRestore({
  sb,file,sourceClanId:A,targetClanId:B
 });
 assert.equal(preview.mutationPermitted,false);
 assert.equal(preview.expectedRevision,4);
 assert.equal(preview.api_wars_imported_as_unverified,2);
 assert.equal(sb.calls.length,2);
 assert.equal(sb.calls[0].name,"cwl_export_owned_backup");
 assert.equal(sb.calls[1].name,"cwl_restore_portable_facts_atomic");
 assert.equal(sb.calls[1].params.p_apply,false);
 assert.equal(sb.calls[1].params.p_confirmation,null);
 assert.equal(sb.calls[1].params.p_expected_revision,4);
});
test("client apply requires explicit confirmation, preview version and target CAS",async()=>{
 const {core,file,targetEnvelope}=await data();
 const sb=mock({targetEnvelope,respond:result(true)});
 await assert.rejects(()=>core.applyPortableWarFactRestore({
  sb,file,sourceClanId:A,targetClanId:B,expectedRevision:4,confirmation:"YES"
 }),/Bestätigung/);
 assert.equal(sb.calls.length,0);
 await assert.rejects(()=>core.applyPortableWarFactRestore({
  sb,file,sourceClanId:A,targetClanId:B,expectedRevision:3,
  confirmation:"RESTORE_VERIFIED_WAR_FACTS"
 }),/Planrevision/);
 assert.equal(sb.calls.filter(c=>c.name==="cwl_restore_portable_facts_atomic").length,0);
 const applied=await core.applyPortableWarFactRestore({
  sb,file,sourceClanId:A,targetClanId:B,expectedRevision:4,
  confirmation:"RESTORE_VERIFIED_WAR_FACTS"
 });
 assert.equal(applied.applied,true);
 const call=sb.calls.find(c=>c.name==="cwl_restore_portable_facts_atomic");
 assert.equal(call.params.p_target,B);
 assert.equal(call.params.p_apply,true);
 assert.equal(call.params.p_expected_revision,4);
});
test("preview/apply reject tampered backup, mismatch tags and RPC error",async()=>{
 const {core,file,targetEnvelope}=await data();
 const bad=JSON.parse(JSON.stringify(file));
 bad.clans[0].name="tampered";
 const sb=mock({targetEnvelope,respond:result(false)});
 await assert.rejects(()=>core.previewPortableWarFactRestore({
  sb,file:bad,sourceClanId:A,targetClanId:B
 }),/Integritätsprüfung/);
 assert.equal(sb.calls.length,0);
 targetEnvelope.clans[0].clash_tag="#QL8P";
 await assert.rejects(()=>core.previewPortableWarFactRestore({
  sb,file,sourceClanId:A,targetClanId:B
 }),/stimmen nicht überein/);
 targetEnvelope.clans[0].clash_tag="#P8Y2";
 const failed=mock({targetEnvelope,fail:true});
 await assert.rejects(()=>core.applyPortableWarFactRestore({
  sb:failed,file,sourceClanId:A,targetClanId:B,expectedRevision:4,
  confirmation:"RESTORE_VERIFIED_WAR_FACTS"
 }),/vom Server abgelehnt/);
});
