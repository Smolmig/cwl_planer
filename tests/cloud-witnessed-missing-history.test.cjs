"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const CLAN="11111111-1111-4111-8111-111111111111";
const OWNER="33333333-3333-4333-8333-333333333333";
const RECEIPT="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DATE="2026-11-20T13:00:00Z";
const FINGERPRINT="f".repeat(64);
async function make(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const specs=core.PORTABLE_CLOUD_TABLES;
 const tables=Object.fromEntries(specs.map(s=>[s.name,[]]));
 const profile=Object.fromEntries(specs.find(s=>s.name==="cwl_cloud_profiles").columns.map(k=>[k,null]));
 Object.assign(profile,{clan_id:CLAN,data_version:9,revision:7,
  profile_json:{name:"UF",members:[],locks:[{locked:true,lineup:[]}],archives:[]}
 });
 tables.cwl_cloud_profiles=[profile];
 const clan={source_clan_id:CLAN,name:"UF",clash_tag:"#P8Y2",tables};
 const receipt={id:RECEIPT,owner_user_id:OWNER,
  snapshot_at:DATE,payload_sha256:"d".repeat(64)};
 const file=await core.createPortableCloudBackup({
  clans:[clan],createdAt:DATE,consistency:"server-stable-statement",
  serverReceipt:receipt
 });
 const payload={...file};delete payload.server_receipt;delete payload.sha256;
 const calls=[];
 let targetRevision=7;
 let applyResult={scope:"witnessed-same-clan-missing-history",
  clan_id:CLAN,new:2,conflict:0,applied:true,full_app_restore:false,
  checkpoint_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"};
 const sb={
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==="cwl_export_owned_backup")return{
    data:{...payload,clans:[{...clan,
     tables:{...tables,cwl_cloud_profiles:[{...profile,revision:targetRevision}]}}]},
    error:null};
   if(name==="cwl_verify_owned_backup_witness")return{error:null,data:{
    verified:true,scope:"server-origin-17-table-snapshot",receipt_id:RECEIPT,
    payload_sha256:receipt.payload_sha256,owner_user_id:OWNER,
    source_clan_count:1,target_clan_ids:[CLAN]}};
   if(name==="cwl_restore_witnessed_missing_history")return{error:null,data:
    args.p_apply?applyResult:{
     scope:"witnessed-same-clan-missing-history",clan_id:CLAN,
     target_fingerprint:FINGERPRINT,expected_revision:7,
     new:2,conflict:0,applied:false,mutation_permitted:false,
     full_app_restore:false,tables:Object.fromEntries(specs.map(s=>[
      s.name,{new:0,identical:0,conflict:0}
     ]))
    }};
   throw Error("Unexpected "+name);
  }
 };
 return {core,file,sb,calls,receipt,
  setTargetRevision:n=>{targetRevision=n},
  setApplyResult:x=>{applyResult=x}};
}
test("owner has a verified same-ID, 17-table preview without any write",async()=>{
 const {core,file,sb,calls}=await make();
 const p=await core.previewWitnessedMissingHistoryRestore({
  sb,file,targetClanId:CLAN});
 assert.equal(p.expected_revision,7);
 assert.equal(p.target_fingerprint,FINGERPRINT);
 assert.equal(p.new,2);
 assert.equal(p.mutationPermitted,false);
 assert.equal(p.fullRestoreAvailable,false);
 assert.equal(calls.filter(x=>x.name==="cwl_restore_witnessed_missing_history").length,1);
 const rpc=calls.at(-1);
 assert.equal(rpc.args.p_apply,false);
 assert.equal(rpc.args.p_confirmation,null);
 assert.equal(rpc.args.p_receipt_id,RECEIPT);
 assert.equal(rpc.args.p_payload.server_receipt,undefined);
 assert.equal(rpc.args.p_payload.sha256,undefined);
});
test("confirmed restore calls only the witnessed SAME-clan SQL transaction",async()=>{
 const {core,file,sb,calls}=await make();
 const r=await core.applyWitnessedMissingHistoryRestore({
  sb,file,targetClanId:CLAN,expectedRevision:7,
  expectedTargetFingerprint:FINGERPRINT,
  confirmation:"RESTORE_WITNESSED_MISSING_HISTORY"});
 assert.equal(r.applied,true);
 assert.equal(r.new,2);
 assert.equal(r.mutationPermitted,false);
 assert.equal(r.fullRestoreAvailable,false);
 assert.equal(calls.at(-1).args.p_apply,true);
 assert.equal(calls.at(-1).args.p_expected_target_fingerprint,FINGERPRINT);
});
test("no bypass for wrong confirmation, a stale plan or a fabricated SQL success",async()=>{
 const {core,file,sb,calls,setTargetRevision,setApplyResult}=await make();
 await assert.rejects(()=>core.applyWitnessedMissingHistoryRestore({
  sb,file,targetClanId:CLAN,expectedRevision:7,
  expectedTargetFingerprint:FINGERPRINT,confirmation:"YES"
 }),/Bestätigung/);
 assert.equal(calls.length,0);
 setTargetRevision(8);
 await assert.rejects(()=>core.applyWitnessedMissingHistoryRestore({
  sb,file,targetClanId:CLAN,expectedRevision:7,
  expectedTargetFingerprint:FINGERPRINT,
  confirmation:"RESTORE_WITNESSED_MISSING_HISTORY"}),/Planrevision/);
 assert.equal(calls.filter(x=>x.name==="cwl_restore_witnessed_missing_history").length,0);
 setTargetRevision(7);
 setApplyResult({scope:"witnessed-same-clan-missing-history",
  clan_id:CLAN,new:2,conflict:0,applied:true,full_app_restore:false,
  checkpoint_id:null});
 await assert.rejects(()=>core.applyWitnessedMissingHistoryRestore({
  sb,file,targetClanId:CLAN,expectedRevision:7,
  expectedTargetFingerprint:FINGERPRINT,
  confirmation:"RESTORE_WITNESSED_MISSING_HISTORY"}),/Sicherungspunkt/);
});
test("legacy and foreign mapping fail before the privileged history RPC",async()=>{
 const {core,file,sb,calls}=await make();
 const legacy=await core.createPortableCloudBackup({
  clans:file.clans,createdAt:DATE,consistency:"server-stable-statement"
 });
 await assert.rejects(()=>core.previewWitnessedMissingHistoryRestore({
  sb,file:legacy,targetClanId:CLAN}),/Server-Herkunftsbeleg/);
 await assert.rejects(()=>core.previewWitnessedMissingHistoryRestore({
  sb,file,targetClanId:"88888888-8888-4888-8888-888888888888"
 }),/ursprünglichen Clan/);
 assert.equal(calls.length,0);
});
test("SQL full-history worker requires signed source, 17 allowlisted datasets, checkpoint and no update/delete",()=>{
 const sql=fs.readFileSync(path.join(__dirname,
  "../supabase/migrations/20261120142000_cwl_witnessed_atomic_missing_history_recovery.sql"),"utf8");
 assert.match(sql,/SECURITY DEFINER SET search_path=''/);
 assert.match(sql,/LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=''/);
 assert.match(sql,/cwl_verify_owned_backup_witness/);
 assert.match(sql,/cwl_canonical_backup_payload/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/cwl_portable_history_recovery_checkpoints/);
 assert.match(sql,/source_clan_id.*p_clan_id::text/);
 assert.match(sql,/OVERRIDING SYSTEM VALUE/);
 assert.match(sql,/RAISE EXCEPTION 'Restore postcondition mismatch/);
 assert.match(sql,/auth\.users/);
 assert.match(sql,/p_expected_target_fingerprint/);
 for(const s of ["cwl_cloud_profiles","cwl_group_archives","cwl_own_lineup_archives",
 "cwl_plan_review_state","cwl_stat_wars","cwl_stat_attacks",
 "cwl_stat_missed","cwl_clan_review_decisions","cwl_change_events",
 "cwl_clan_absence_observations","cwl_clan_donation_observations"])
  assert.match(sql,new RegExp("'"+s+"'"));
 assert.doesNotMatch(sql,/\bUPDATE public\.cwl_|\bDELETE FROM public\.cwl_/i);
});
