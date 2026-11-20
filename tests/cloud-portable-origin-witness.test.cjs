"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const SOURCE="11111111-1111-4111-8111-111111111111";
const TARGET="88888888-8888-4888-8888-888888888888";
const OWNER="33333333-3333-4333-8333-333333333333";
const DATE="2026-11-20T08:30:00Z";
const RECEIPT="99999999-9999-4999-8999-999999999999";
async function fixture(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(t=>[t.name,[]]));
 const profile=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.find(t=>
  t.name==="cwl_cloud_profiles").columns.map(k=>[k,null]));
 Object.assign(profile,{
  clan_id:SOURCE,data_version:9,revision:8,
  profile_json:{id:"source",name:"Synthetic",members:[],archivedMembers:[],
   locks:Array.from({length:7},()=>({locked:false,lineup:[],snapshots:{}})),
   archives:[],config:{},dayGoals:[],cwlLive:{rounds:[]}}
 });
 tables.cwl_cloud_profiles=[profile];
 const payload={
  kind:core.PORTABLE_CLOUD_BACKUP_KIND,
  format_version:1,created_at:DATE,consistency:"server-stable-statement",
  clans:[{source_clan_id:SOURCE,name:"Synthetic",clash_tag:"#P8Y2",tables}]
 };
 const receipt={id:RECEIPT,owner_user_id:OWNER,payload_sha256:"d".repeat(64),snapshot_at:DATE};
 const file=await core.createPortableCloudBackup({
  clans:payload.clans,createdAt:DATE,consistency:payload.consistency,
  serverReceipt:receipt
 });
 const calls=[];
 const sb={calls,
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==="cwl_issue_owned_backup_witness")
    return{data:{snapshot:payload,server_receipt:receipt},error:null};
   if(name==="cwl_verify_owned_backup_witness")
    return{data:{
     verified:true,scope:"server-origin-17-table-snapshot",
     receipt_id:RECEIPT,payload_sha256:"d".repeat(64),
     source_clan_count:1,target_clan_ids:[TARGET],owner_user_id:OWNER
    },error:null};
   throw Error("Unexpected RPC "+name);
  }
 };
 return{core,file,payload,receipt,sb};
}
test("one standalone format-v1 file carries full 17-table server receipt under integrity hash",async()=>{
 const {core,file,receipt}=await fixture();
 const checked=await core.verifyPortableCloudBackup(file);
 assert.deepEqual({...checked.server_receipt},receipt);
 assert.equal(Object.keys(checked.clans[0].tables).length,17);
 const tampered=structuredClone(file);
 tampered.server_receipt.payload_sha256="0".repeat(64);
 await assert.rejects(()=>core.verifyPortableCloudBackup(tampered),/Integritätsprüfung/);
});
test("legacy backup remains readable, but cannot be represented as server-witnessed",async()=>{
 const {core,payload,sb}=await fixture();
 const legacy=await core.createPortableCloudBackup({
  clans:payload.clans,createdAt:DATE,consistency:payload.consistency
 });
 assert.equal((await core.verifyPortableCloudBackup(legacy)).server_receipt,undefined);
 await assert.rejects(()=>core.verifyWitnessedOwnerCloudBackup({
  sb,file:legacy,mapping:{[SOURCE]:TARGET}
 }),/keinen serverseitigen Herkunftsbeleg/);
 assert.equal(sb.calls.length,0);
});
test("owner export invokes ONE protected server snapshot+receipt transaction",async()=>{
 const {core,sb}=await fixture();
 const returned=await core.exportWitnessedOwnerCloudSnapshot({
  sb,clanIds:[SOURCE]
 });
 assert.equal(sb.calls.length,1);
 assert.equal(sb.calls[0].name,"cwl_issue_owned_backup_witness");
 assert.deepEqual(sb.calls[0].args.p_clan_ids,[SOURCE]);
 assert.equal(returned.server_receipt.owner_user_id,OWNER);
 assert.equal(returned.clans[0].source_clan_id,SOURCE);
 assert.equal(returned.consistency,"server-stable-statement");
 assert.ok(returned.sha256);
});
test("verifying original source requires server owner+destination check, without granting mutation",async()=>{
 const {core,sb,file}=await fixture();
 const verified=await core.verifyWitnessedOwnerCloudBackup({
  sb,file,mapping:{[SOURCE]:TARGET}
 });
 assert.equal(verified.verified,true);
 assert.equal(verified.sourceClans,1);
 assert.deepEqual(verified.targetClans,[TARGET]);
 assert.equal(verified.fullRestoreAvailable,false);
 assert.equal(verified.mutationPermitted,false);
 assert.equal(sb.calls.length,1);
 assert.deepEqual(sb.calls[0].args,{
  p_receipt_id:RECEIPT,
  p_payload:Object.fromEntries(Object.entries(
   await core.verifyPortableCloudBackup(file)
  ).filter(([key])=>key!=="server_receipt")),
  p_target_clan_ids:[TARGET]
 });
});
test("authentication change, malformed receipt and mismatched source/target are rejected",async()=>{
 const {core,sb,file,receipt,payload}=await fixture();
 const broken=structuredClone(file);
 broken.server_receipt.owner_user_id="not-a-uuid";
 await assert.rejects(()=>core.verifyPortableCloudBackup(broken),/Ungültiger/);
 const forged=await core.createPortableCloudBackup({
  clans:payload.clans,createdAt:DATE,consistency:payload.consistency,
  serverReceipt:{...receipt,snapshot_at:"2020-01-01T00:00:00Z"}
 }).then(()=>true,()=>false);
 assert.equal(forged,false);
 await assert.rejects(()=>core.verifyWitnessedOwnerCloudBackup({
  sb,file,mapping:{[SOURCE]:SOURCE,[TARGET]:TARGET}
 }),/Nicht alle Quellclans/);
 const denied=await fixture();
 denied.sb.rpc=async()=>({data:null,error:{code:"42501"}});
 await assert.rejects(()=>core.verifyWitnessedOwnerCloudBackup({
  sb:denied.sb,file,mapping:{[SOURCE]:TARGET}
 }),/Originalherkunft/);
});
test("SQL receipts require fixed empty search_path, authentic owner, and no direct table grants",()=>{
 const sql=fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261120103000_cwl_owner_backup_origin_witness.sql"),"utf8");
 for(const pattern of [
  /CREATE TABLE private\.cwl_portable_backup_witnesses/,
  /ENABLE ROW LEVEL SECURITY/,
  /REVOKE ALL ON private\.cwl_portable_backup_witnesses/,
  /SECURITY INVOKER\s+SET search_path=''/,
  /CREATE POLICY cwl_portable_backup_witness_trusted_insert/,
  /cwl_witness_matches_current_snapshot/,
  /WITH CHECK\(/,
  /c\.owner_user_id=v_actor/,
  /m\.role='owner'/,
  /cwl_export_owned_backup\(v_ids\)/,
  /cwl_verify_owned_backup_witness/,
  /v_digest IS DISTINCT FROM v_row\.payload_sha256/,
  /p_target_clan_ids\[v_i\+1\]/,
  /source_clash_tags/,
  /pg_catalog\.sha256/,
  /scope','server-origin-17-table-snapshot'/,
  /REVOKE ALL ON FUNCTION public\.cwl_issue_owned_backup_witness/,
 ])assert.match(sql,pattern);
 assert.match(sql,/GRANT INSERT \(/);
 assert.doesNotMatch(sql,/\bGRANT\s+(UPDATE|DELETE)\b/i);
 assert.doesNotMatch(sql,/\bUPDATE public\.cwl_|\bDELETE FROM public\.cwl_/i);
});
