"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const SOURCE="11111111-1111-4111-8111-111111111111";
const TARGET="88888888-8888-4888-8888-888888888888";
const OWNER="33333333-3333-4333-8333-333333333333";
const RECEIPT="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FINGERPRINT="f".repeat(64);
const CREATED="2026-11-20T14:30:00Z";
async function mock(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(s=>[s.name,[]]));
 const profileKeys=core.PORTABLE_CLOUD_TABLES.find(x=>x.name==="cwl_cloud_profiles").columns;
 const makeProfile=(id,rev)=>Object.assign(
  Object.fromEntries(profileKeys.map(k=>[k,null])),{
   clan_id:id,revision:rev,data_version:9,
   profile_json:{name:"United Fighters",members:[],locks:[],archives:[],
    archivedMembers:[],cwlLive:{rounds:[],warCount:0}}
  });
 tables.cwl_cloud_profiles=[makeProfile(SOURCE,4)];
 const original={source_clan_id:SOURCE,name:"Original",clash_tag:"#P8Y2",tables};
 const receipt={id:RECEIPT,owner_user_id:OWNER,
  snapshot_at:CREATED,payload_sha256:"a".repeat(64)};
 const file=await core.createPortableCloudBackup({
  clans:[original],createdAt:CREATED,consistency:"server-stable-statement",
  serverReceipt:receipt});
 const payload={...file};delete payload.server_receipt;delete payload.sha256;
 const calls=[];
 let targetRevision=1,targetTag="#P8Y2";
 let resultOverride=null;
 const sb={
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==="cwl_export_owned_backup"){
    return {data:{...payload,clans:[{
      source_clan_id:TARGET,name:"Replacement",clash_tag:targetTag,
      tables:{...tables,cwl_cloud_profiles:[makeProfile(TARGET,targetRevision)]}
     }]},error:null};
   }
   if(name==="cwl_verify_owned_backup_witness")return{data:{
     verified:true,scope:"server-origin-17-table-snapshot",receipt_id:RECEIPT,
     payload_sha256:receipt.payload_sha256,source_clan_count:1,
     target_clan_ids:[TARGET],owner_user_id:OWNER
    },error:null};
   if(name==="cwl_restore_witnessed_pristine_clan")return{error:null,
     data:resultOverride||(args.p_apply?{
      scope:"verified-pristine-new-clan-17-datasets",
      source_clan_id:SOURCE,target_clan_id:TARGET,
      restored_table_count:17,source_rows:17,source_locked_days:1,
      applied:true,applied_revision:2,
      checkpoint_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      mutation_permitted:false,public_full_restore_available:false
     }:{
      scope:"verified-pristine-new-clan-17-datasets",
      source_clan_id:SOURCE,target_clan_id:TARGET,
      restored_table_count:17,source_rows:17,source_locked_days:1,
      source_archive_rows:2,expected_revision:1,
      target_fingerprint:FINGERPRINT,applied:false,
      mutation_permitted:false,public_full_restore_available:false
     })};
   throw Error("Unexpected RPC "+name);
  }
 };
 return{core,file,sb,calls,
  setRevision:r=>{targetRevision=r},
  setTag:t=>{targetTag=t},
  setResult:r=>{resultOverride=r}};
}
test("fresh-clan preview verifies original owner, target mapping and 17 areas without mutating",async()=>{
 const {core,file,sb,calls}=await mock();
 const p=await core.previewWitnessedPristineClanRestore({
  sb,file,sourceClanId:SOURCE,targetClanId:TARGET});
 assert.equal(p.expected_revision,1);
 assert.equal(p.source_locked_days,1);
 assert.equal(p.source_archive_rows,2);
 assert.equal(p.restored_table_count,17);
 assert.equal(p.fullRestoreAvailable,false);
 assert.equal(p.mutationPermitted,false);
 const witness=calls.find(x=>x.name==="cwl_verify_owned_backup_witness");
 assert.deepEqual(witness.args.p_target_clan_ids,[TARGET]);
 const rpc=calls.at(-1);
 assert.equal(rpc.name,"cwl_restore_witnessed_pristine_clan");
 assert.equal(rpc.args.p_apply,false);
 assert.equal(rpc.args.p_confirmation,null);
 assert.equal(rpc.args.p_payload.server_receipt,undefined);
 assert.equal(rpc.args.p_payload.sha256,undefined);
 assert.equal(rpc.args.p_receipt_id,RECEIPT);
});
test("confirmed fresh-clan apply executes only one atomic signed 17-dataset RPC",async()=>{
 const {core,file,sb,calls}=await mock();
 const r=await core.applyWitnessedPristineClanRestore({
  sb,file,sourceClanId:SOURCE,targetClanId:TARGET,
  expectedRevision:1,expectedTargetFingerprint:FINGERPRINT,
  confirmation:"RESTORE_ORIGINAL_TO_EMPTY_CLAN"});
 assert.equal(r.applied,true);
 assert.equal(r.applied_revision,2);
 assert.equal(r.fullRestoreAvailable,false);
 assert.equal(r.mutationPermitted,false);
 assert.match(r.checkpoint_id,/^[0-9a-f-]{36}$/);
 const rpc=calls.at(-1);
 assert.equal(rpc.args.p_expected_target_fingerprint,FINGERPRINT);
 assert.equal(rpc.args.p_apply,true);
 assert.equal(rpc.args.p_confirmation,"RESTORE_ORIGINAL_TO_EMPTY_CLAN");
});
test("no bypass on wrong source/destination, missing confirmation or stale revision",async()=>{
 const {core,file,sb,calls,setRevision,setTag}=await mock();
 await assert.rejects(()=>core.applyWitnessedPristineClanRestore({
  sb,file,sourceClanId:SOURCE,targetClanId:TARGET,
  expectedRevision:1,expectedTargetFingerprint:FINGERPRINT,
  confirmation:"CONFIRM"}),/Bestätigung/);
 await assert.rejects(()=>core.previewWitnessedPristineClanRestore({
  sb,file,sourceClanId:SOURCE,targetClanId:SOURCE}),/Zielclan/);
 await assert.rejects(()=>core.previewWitnessedPristineClanRestore({
  sb,file,sourceClanId:"77777777-7777-4777-8777-777777777777",
  targetClanId:TARGET}),/Zielclan/);
 assert.equal(calls.length,0);
 setRevision(2);
 await assert.rejects(()=>core.applyWitnessedPristineClanRestore({
  sb,file,sourceClanId:SOURCE,targetClanId:TARGET,
  expectedRevision:1,expectedTargetFingerprint:FINGERPRINT,
  confirmation:"RESTORE_ORIGINAL_TO_EMPTY_CLAN"}),/Planrevision/);
 assert.equal(calls.filter(x=>x.name==="cwl_restore_witnessed_pristine_clan").length,0);
 setTag("#QL8P");
 await assert.rejects(()=>core.previewWitnessedPristineClanRestore({
  sb,file,sourceClanId:SOURCE,targetClanId:TARGET}),/Clash-Tag/);
});
test("reject unsigned, multi-source and fake SQL success",async()=>{
 const {core,file,sb,calls,setResult}=await mock();
 const unsigned=await core.createPortableCloudBackup({
  clans:file.clans,createdAt:CREATED,consistency:"server-stable-statement"});
 await assert.rejects(()=>core.previewWitnessedPristineClanRestore({
  sb,file:unsigned,sourceClanId:SOURCE,targetClanId:TARGET}),/Serverbeleg/);
 setResult({scope:"verified-pristine-new-clan-17-datasets",
   source_clan_id:SOURCE,target_clan_id:TARGET,
   restored_table_count:17,source_rows:17,source_locked_days:1,
   applied:true,applied_revision:2,checkpoint_id:null,
   mutation_permitted:false,public_full_restore_available:false});
 await assert.rejects(()=>core.applyWitnessedPristineClanRestore({
  sb,file,sourceClanId:SOURCE,targetClanId:TARGET,
  expectedRevision:1,expectedTargetFingerprint:FINGERPRINT,
  confirmation:"RESTORE_ORIGINAL_TO_EMPTY_CLAN"}),/Checkpoint|Neuaufbau/);
});
test("fixed server contract includes immutable witness, full profile, all 17 and protected checkpoint",()=>{
 const sql=fs.readFileSync(path.join(__dirname,
   "../supabase/migrations/20261120160000_cwl_witnessed_pristine_new_clan_restore.sql"),"utf8");
 assert.match(sql,/private.cwl_portable_fresh_clan_recovery_checkpoints/);
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/SECURITY INVOKER SET search_path=''/);
 assert.match(sql,/cwl_verify_owned_backup_witness/);
 assert.match(sql,/p_expected_target_fingerprint/);
 assert.match(sql,/RESTORE_ORIGINAL_TO_EMPTY_CLAN/);
 assert.match(sql,/WHERE clan_id=p_target_clan_id AND revision=v_original_target_revision/);
 assert.match(sql,/normal profile guards/i);
 assert.match(sql,/profile_json=v_src_profile/);
 assert.match(sql,/only an unused replacement/i);
 assert.match(sql,/historical author account missing/i);
 assert.match(sql,/17-table restored dataset/);
 const descriptors=[
  "cwl_cloud_profiles","cwl_profile_snapshots","cwl_change_events",
  "cwl_stat_wars","cwl_stat_attacks","cwl_stat_missed",
  "cwl_plan_review_state","cwl_plan_suggestions","cwl_group_archives",
  "cwl_own_lineup_archives","cwl_missed_owner_decisions","cwl_clan_member_tenure",
  "cwl_clan_management_rules","cwl_clan_donation_observations",
  "cwl_clan_absence_observations","cwl_clan_review_decisions",
  "cwl_clan_cw_missed_decisions"];
 for(const table of descriptors)assert.match(sql,new RegExp(table));
 assert.doesNotMatch(sql,/\bDELETE FROM public\.cwl_stat_|\bUPDATE public\.cwl_stat_/i);
});
