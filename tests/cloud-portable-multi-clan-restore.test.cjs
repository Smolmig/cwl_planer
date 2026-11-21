"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const SRC=["11111111-1111-4111-8111-111111111111",
 "55555555-5555-4555-8555-555555555555"];
const TGT=["88888888-8888-4888-8888-888888888888",
 "abababab-abab-4bab-8bab-abababababab"];
const TAGS=["#P8Y2","#QL8P"];
const OWNER="33333333-3333-4333-8333-333333333333";
const RECEIPT="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREATED="2026-11-21T15:20:00Z";
const DIGESTS=["a".repeat(64),"b".repeat(64)];
const CHECKPOINTS=[
 "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 "cccccccc-cccc-4ccc-8ccc-cccccccccccc"];
const SESSION="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
async function fixture(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const profileCols=core.PORTABLE_CLOUD_TABLES.find(s=>s.name==="cwl_cloud_profiles").columns;
 const profile=(id,revision)=>Object.assign(
  Object.fromEntries(profileCols.map(k=>[k,null])),
  {clan_id:id,revision,data_version:9,
   profile_json:{name:"UF",members:[],locks:[],archives:[],
    archivedMembers:[],cwlLive:{rounds:[],warCount:0}}});
 const sourceClans=SRC.map((id,i)=>({
  source_clan_id:id,name:i?"UF2":"United Fighters",
  clash_tag:TAGS[i],tables:{
   ...Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(s=>[s.name,[]])),
   cwl_cloud_profiles:[profile(id,4)]
  }}));
 const receipt={id:RECEIPT,owner_user_id:OWNER,snapshot_at:CREATED,
  payload_sha256:"f".repeat(64)};
 const file=await core.createPortableCloudBackup({
  clans:sourceClans,createdAt:CREATED,
  consistency:"server-stable-statement",serverReceipt:receipt});
 const body={...file};delete body.server_receipt;delete body.sha256;
 const calls=[];
 let tags=[...TAGS];
 let revisions=[1,1];
 let responseOverride=null;
 const previews=SRC.map((id,i)=>({
  scope:"verified-pristine-new-clan-17-datasets",
  source_clan_id:id,target_clan_id:TGT[i],
  restored_table_count:17,source_rows:6,source_locked_days:i+1,
  source_archive_rows:i+1,expected_revision:1,
  target_fingerprint:DIGESTS[i],applied:false
 }));
 const done=SRC.map((id,i)=>({
  scope:"verified-pristine-new-clan-17-datasets",
  source_clan_id:id,target_clan_id:TGT[i],
  restored_table_count:17,source_rows:6,source_locked_days:i+1,
  applied:true,applied_revision:2,checkpoint_id:CHECKPOINTS[i]
 }));
 const sb={
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==="cwl_export_owned_backup")return{data:{
    ...body,clans:TGT.map((id,i)=>({
     source_clan_id:id,name:"New clan",clash_tag:tags[i],
     tables:{...sourceClans[i].tables,
      cwl_cloud_profiles:[profile(id,revisions[i])]}
    }))},error:null};
   if(name==="cwl_verify_owned_backup_witness")
    return{data:{verified:true,scope:"server-origin-17-table-snapshot",
     receipt_id:RECEIPT,payload_sha256:receipt.payload_sha256,
     source_clan_count:2,target_clan_ids:[...TGT],owner_user_id:OWNER},error:null};
   if(name==="cwl_restore_witnessed_multi_clans")
    return{data:responseOverride||(args.p_apply?{
     scope:"verified-multi-pristine-clan-17-datasets",
     source_clan_count:2,target_clan_count:2,
     source_clan_ids:[...SRC],target_clan_ids:[...TGT],
     applied:true,mutation_permitted:false,
     public_full_restore_available:false,source_rows:12,
     recovery_session_id:SESSION,checkpoints:[...CHECKPOINTS],
     restores:done
    }:{
     scope:"verified-multi-pristine-clan-17-datasets",
     source_clan_count:2,target_clan_count:2,
     source_clan_ids:[...SRC],target_clan_ids:[...TGT],
     applied:false,mutation_permitted:false,
     public_full_restore_available:false,source_rows:12,
     previews
    }),error:null};
   throw Error("Unexpected RPC "+name);
  }
 };
 const mapping=Object.fromEntries(SRC.map((s,i)=>[s,TGT[i]]));
 return{core,file,sb,calls,mapping,
  changeTargetTag:(i,t)=>{tags[i]=t},
  changeRevision:(i,r)=>{revisions[i]=r},
  overrideResult:r=>{responseOverride=r}};
}
test("full signed 2-clan preview validates one shared private witness and reads both targets",async()=>{
 const f=await fixture();
 const v=await f.core.previewWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:f.mapping});
 assert.equal(v.applied,false);
 assert.equal(v.mutationPermitted,false);
 assert.equal(v.fullRestoreAvailable,false);
 assert.equal(v.previews.length,2);
 assert.equal(v.previews[0].target_fingerprint,DIGESTS[0]);
 assert.equal(v.previews[1].target_fingerprint,DIGESTS[1]);
 assert.deepEqual(f.calls.filter(c=>c.name==="cwl_export_owned_backup")[0].args.p_clan_ids,TGT);
 assert.deepEqual(f.calls.filter(c=>c.name==="cwl_verify_owned_backup_witness")[0].args.p_target_clan_ids,TGT);
 const restore=f.calls.filter(c=>c.name==="cwl_restore_witnessed_multi_clans");
 assert.equal(restore.length,1);
 assert.equal(restore[0].args.p_apply,false);
 assert.equal(restore[0].args.p_confirmation,null);
 assert.deepEqual(restore[0].args.p_expected_revisions,[1,1]);
 assert.equal(restore[0].args.p_payload.server_receipt,undefined);
 assert.equal(restore[0].args.p_payload.sha256,undefined);
});
test("confirmed all-or-nothing multi-clan replay uses exactly ONE SQL RPC and one manifest",async()=>{
 const f=await fixture();
 const v=await f.core.applyWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:f.mapping,
  expectedRevisions:[1,1],expectedTargetFingerprints:DIGESTS,
  confirmation:"RESTORE_ALL_VERIFIED_EMPTY_CLANS"});
 assert.equal(v.applied,true);
 assert.equal(v.recovery_session_id,SESSION);
 assert.deepEqual(v.checkpoints,CHECKPOINTS);
 assert.equal(v.restores.length,2);
 assert.equal(v.fullRestoreAvailable,false);
 assert.equal(v.mutationPermitted,false);
 const restore=f.calls.filter(c=>c.name==="cwl_restore_witnessed_multi_clans");
 assert.equal(restore.length,1);
 assert.equal(restore[0].args.p_apply,true);
 assert.deepEqual(restore[0].args.p_expected_target_fingerprints,DIGESTS);
 assert.equal(restore[0].args.p_confirmation,"RESTORE_ALL_VERIFIED_EMPTY_CLANS");
});
test("duplicate, missing, same-source destination and wrong confirmation all rejected before SQL",async()=>{
 const f=await fixture();
 const wrong={...f.mapping,[SRC[1]]:TGT[0]};
 await assert.rejects(()=>f.core.previewWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:wrong}),/eindeutigen/);
 const missing={[SRC[0]]:TGT[0]};
 await assert.rejects(()=>f.core.previewWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:missing}),/zugeordnet/);
 const original={...f.mapping,[SRC[1]]:SRC[1]};
 await assert.rejects(()=>f.core.previewWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:original}),/neuen Zielclan/);
 await assert.rejects(()=>f.core.applyWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:f.mapping,
  expectedRevisions:[1,1],expectedTargetFingerprints:DIGESTS,
  confirmation:"YES"}),/Bestätigung/);
 assert.equal(f.calls.length,0);
});
test("mismatched target Clash-tag, stale revision and bogus SQL group success are refused",async()=>{
 const f=await fixture();
 f.changeTargetTag(1,"#P8Y2");
 await assert.rejects(()=>f.core.previewWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:f.mapping}),/Clash-Clan/);
 assert.equal(f.calls.filter(c=>c.name==="cwl_restore_witnessed_multi_clans").length,0);
 f.changeTargetTag(1,"#QL8P");
 f.changeRevision(1,2);
 await assert.rejects(()=>f.core.applyWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:f.mapping,expectedRevisions:[1,1],
  expectedTargetFingerprints:DIGESTS,
  confirmation:"RESTORE_ALL_VERIFIED_EMPTY_CLANS"}),/Planrevision/);
 assert.equal(f.calls.filter(c=>c.name==="cwl_restore_witnessed_multi_clans").length,0);
 f.changeRevision(1,1);
 f.overrideResult({
  scope:"verified-multi-pristine-clan-17-datasets",
  source_clan_count:2,target_clan_count:2,
  source_clan_ids:[...SRC],target_clan_ids:[...TGT],
  applied:true,mutation_permitted:false,
  public_full_restore_available:false,source_rows:12,
  recovery_session_id:SESSION,checkpoints:[CHECKPOINTS[0],null],
  restores:[{scope:"verified-pristine-new-clan-17-datasets",
   source_clan_id:SRC[0],target_clan_id:TGT[0],
   restored_table_count:17,applied:true,applied_revision:2,
   checkpoint_id:CHECKPOINTS[0]}]
 });
 await assert.rejects(()=>f.core.applyWitnessedMultiClanRestore({
  sb:f.sb,file:f.file,mapping:f.mapping,expectedRevisions:[1,1],
  expectedTargetFingerprints:DIGESTS,
  confirmation:"RESTORE_ALL_VERIFIED_EMPTY_CLANS"}),/Checkpoint/);
});
test("a signed single clan or an unsigned two-clan file cannot claim multi-clan restore",async()=>{
 const f=await fixture();
 const unsigned=await f.core.createPortableCloudBackup({
  clans:f.file.clans,createdAt:CREATED,consistency:"server-stable-statement"});
 await assert.rejects(()=>f.core.previewWitnessedMultiClanRestore({
  sb:f.sb,file:unsigned,mapping:f.mapping}),/original belegte/);
 const onlyOne=await f.core.createPortableCloudBackup({
  clans:[f.file.clans[0]],createdAt:CREATED,consistency:"server-stable-statement",
  serverReceipt:f.file.server_receipt});
 await assert.rejects(()=>f.core.previewWitnessedMultiClanRestore({
  sb:f.sb,file:onlyOne,mapping:{[SRC[0]]:TGT[0]}}),/2 bis 10/);
});
test("SQL public invoker, private helper non-executable and checkpoint owner RLS are in release gate",()=>{
 const migration=fs.readFileSync(path.join(__dirname,
  "../supabase/migrations/20261121101000_cwl_atomic_multi_clan_restore.sql"),"utf8");
 assert.match(migration,/private\.cwl_restore_witnessed_multi_member_worker/);
 assert.match(migration,/REVOKE ALL ON FUNCTION private\.cwl_restore_witnessed_multi_member_worker/);
 assert.match(migration,/cwl_verify_owned_backup_witness/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/ORDER BY x\.id/);
 assert.match(migration,/p_expected_target_fingerprints/);
 assert.match(migration,/cwl_portable_multi_clan_recovery_sessions/);
 assert.match(migration,/SECURITY DEFINER SET search_path=''/);
 assert.match(migration,/SECURITY INVOKER SET search_path=''/);
 assert.match(migration,/RESTORE_ALL_VERIFIED_EMPTY_CLANS/);
 assert.match(migration,/RAISE EXCEPTION 'A verified full restore member failed/);
 assert.match(migration,/NOT EXISTS\(/);
});
