"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const ID="11111111-1111-4111-8111-111111111111";
const OWNER="33333333-3333-4333-8333-333333333333";
const DATE="2026-11-19T17:04:00Z";
async function moduleInfo(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const gate=await import("../cloud-portable-backup-release-gate.mjs");
 return{core,gate};
}
function row(t,override){
 return Object.fromEntries(t.columns.map(k=>[k,Object.hasOwn(override,k)?override[k]:null]));
}
async function sample(){
 const {core,gate}=await moduleInfo();
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(s=>[s.name,[]]));
 const prof=core.PORTABLE_CLOUD_TABLES.find(s=>s.name==="cwl_cloud_profiles");
 tables.cwl_cloud_profiles=[row(prof,{
  clan_id:ID,revision:3,data_version:9,
  profile_json:{
   id:"synthetic",name:"Owner",members:[],archivedMembers:[],
   config:{days:7,slots:15},dayGoals:[],
   locks:Array.from({length:7},()=>({locked:false,warTag:null,lineup:[],snapshots:{}})),
   archives:[],cwlLive:{clanTag:"#P8Y2",rounds:[],warCount:0}
  }
 })];
 const war=core.PORTABLE_CLOUD_TABLES.find(s=>s.name==="cwl_stat_wars");
 tables.cwl_stat_wars=[row(war,{
  clan_id:ID,war_key:"normal:w1",war_type:"normal",started_at:"2026-11-12T10:00:00Z",
  team_size:5,opponent_tag:"#QL8P",opponent_name:"Synthetic",source:"import",
  roster_tags:["#P8Y2"],finalized:true,missed_log_complete:false,
  source_clash_tag:null,updated_at:DATE
 })];
 const attack=core.PORTABLE_CLOUD_TABLES.find(s=>s.name==="cwl_stat_attacks");
 tables.cwl_stat_attacks=[row(attack,{
  clan_id:ID,war_key:"normal:w1",attacker_tag:"#P8Y2",attack_order:1,
  attacker_name:"Fixture",attacker_th:17,defender_tag:"#QL8P",
  defender_name:"Fixture",defender_th:17,stars:3,destruction:100,created_at:DATE
 })];
 const audit=core.PORTABLE_CLOUD_TABLES.find(s=>s.name==="cwl_change_events");
 tables.cwl_change_events=[row(audit,{
  id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",clan_id:ID,actor_id:OWNER,
  revision:2,event_type:"fixture",details:{},created_at:DATE
 })];
 const clan={source_clan_id:ID,name:"Owner",clash_tag:"#P8Y2",tables};
 const file=await core.createPortableCloudBackup({
  clans:[clan],createdAt:DATE,consistency:"server-stable-statement"
 });
 const snapshot=JSON.parse(JSON.stringify(file));
 delete snapshot.sha256;
 const sb={calls:[],
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async(name,params)=>{
   sb.calls.push({name,params});
   if(name==="cwl_issue_owned_backup_witness")
    return{data:{snapshot,server_receipt:{
     id:"99999999-9999-4999-8999-999999999999",
     payload_sha256:"a".repeat(64),owner_user_id:OWNER,snapshot_at:DATE
    }},error:null};
   if(name==="cwl_export_owned_backup")
    return{data:snapshot,error:null};
   throw Error("Unexpected RPC "+name);
  }
 };
 return{core,gate,file,snapshot,sb};
}
test("complete backup download is one self-contained 17-table server-MVCC/sha256-valid JSON",async()=>{
 const {core,gate,sb}=await sample();
 const f=await gate.preparePortableOwnerBackupDownload({sb,clanIds:[ID]});
 assert.match(f.filename,/^CWL_Cloud_App_Backup_2026-11-19_1-Clans\.json$/);
 assert.ok(f.byteLength>1000);
 assert.equal(f.clanCount,1);
 assert.equal(f.dataTables,17);
 assert.equal(f.completeExport,true);
 assert.match(f.originReceiptId,/^[0-9a-f-]{36}$/);
 assert.equal(f.fullRestoreAvailable,false);
 const parsed=JSON.parse(f.json);
 const valid=await core.verifyPortableCloudBackup(parsed);
 assert.equal(valid.consistency,"server-stable-statement");
 assert.equal(valid.server_receipt.payload_sha256,"a".repeat(64));
 assert.equal(valid.clans[0].tables.cwl_stat_wars.length,1);
 assert.equal(valid.clans[0].tables.cwl_stat_attacks.length,1);
 assert.equal(valid.clans[0].tables.cwl_change_events.length,1);
 assert.equal(Object.keys(valid.clans[0].tables).length,17);
 assert.equal(sb.calls.length,1);
 assert.deepEqual(sb.calls[0].params.p_clan_ids,[ID]);
 assert.equal(sb.calls[0].name,"cwl_issue_owned_backup_witness");
});
test("full restore summary flags audit+observations and every non-atomic conflict; never grants apply",async()=>{
 const {gate}=await sample();
 const empty=Object.fromEntries((await moduleInfo()).core.PORTABLE_CLOUD_TABLES.map(t=>[
  t.name,{new:0,identical:0,conflict:0,reviewOnly:0}
 ]));
 empty.cwl_stat_wars.new=2;
 empty.cwl_stat_attacks.identical=4;
 empty.cwl_group_archives.conflict=1;
 empty.cwl_change_events.reviewOnly=3;
 empty.cwl_clan_donation_observations.reviewOnly=5;
 const report=gate.summarizePortableRestoreCoverage({
  format_version:1,created_at:DATE,mutationPermitted:false,
  clans:[{source_clan_id:ID,target_clan_id:ID,tables:empty}]
 });
 assert.equal(report.tablesPerClan,17);
 assert.equal(report.counts.total,15);
 assert.equal(report.counts.new,2);
 assert.equal(report.counts.conflict,1);
 assert.equal(report.counts.reviewOnly,8);
 assert.equal(report.fullRestoreAvailable,false);
 assert.equal(report.mutationPermitted,false);
 assert.deepEqual(report.clans[0].incompleteAreas.sort(),
  ["cwl_change_events","cwl_clan_donation_observations",
   "cwl_group_archives","cwl_stat_wars"].sort());
 assert.match(report.explanation,/nicht vollständig/);
});
test("identical preview is no-op, not a false full restore success",async()=>{
 const {core,gate}=await sample();
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(t=>[
  t.name,{new:0,identical:0,conflict:0,reviewOnly:0}
 ]));
 tables.cwl_cloud_profiles.identical=1;
 const result=gate.summarizePortableRestoreCoverage({
  format_version:1,created_at:DATE,mutationPermitted:false,
  clans:[{source_clan_id:ID,target_clan_id:ID,tables}]
 });
 assert.equal(result.alreadyIdentical,true);
 assert.equal(result.counts.identical,1);
 assert.equal(result.fullRestoreAvailable,false);
 assert.match(result.explanation,/kein Import/);
});
test("input size, invalid/tampered backup and missing owner target fail closed before mutation",async()=>{
 const {gate,file,sb}=await sample();
 await assert.rejects(()=>gate.inspectPortableOwnerRestoreFile({
  sb,fileText:"not json",mapping:{[ID]:ID}
 }),/gültiges JSON/);
 // Size limit is enforced in the implementation; do not allocate a 129MiB
 // string inside the parallel CI test runner just to test this branch.
 const tampered=JSON.parse(JSON.stringify(file));
 tampered.clans[0].name="Injected";
 await assert.rejects(()=>gate.inspectPortableOwnerRestoreFile({
  sb,fileText:JSON.stringify(tampered),mapping:{[ID]:ID}
 }),/Integritätsprüfung/);
 const foreign=JSON.parse(JSON.stringify(file));
 foreign.consistency="client-read-non-atomic";
 await assert.rejects(()=>gate.inspectPortableOwnerRestoreFile({
  sb,fileText:JSON.stringify(foreign),mapping:{[ID]:ID}
 }),/Integritätsprüfung/);
 // Even a checksum-valid legacy/client-paginated snapshot is insufficient
 // to claim consistent recovery after concurrent collector writes.
 const nonAtomic=await (await moduleInfo()).core.createPortableCloudBackup({
  clans:file.clans,createdAt:DATE,consistency:"client-read-non-atomic"
 });
 await assert.rejects(()=>gate.inspectPortableOwnerRestoreFile({
  sb,fileText:JSON.stringify(nonAtomic),mapping:{[ID]:ID}
 }),/konsistente Server-Snapshots/);
 assert.equal(sb.calls.length,0);
});
test("preview routes only to server-authorized owner snapshot and detects identical audit",async()=>{
 const {gate,file,sb}=await sample();
 const report=await gate.inspectPortableOwnerRestoreFile({
  sb,fileText:JSON.stringify(file),mapping:{[ID]:ID}
 });
 assert.equal(sb.calls.length,1);
 assert.equal(report.counts.new,0);
 assert.equal(report.counts.conflict,0);
 assert.equal(report.counts.reviewOnly,0);
 assert.equal(report.counts.identical,4);
 assert.equal(report.alreadyIdentical,true);
 assert.equal(report.fullRestoreAvailable,false);
 assert.deepEqual(report.clans[0].incompleteAreas,[]);
});
test("forged preview reports are rejected even if marked mutationPermitted",async()=>{
 const {core,gate}=await sample();
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(t=>[
  t.name,{new:0,identical:0,conflict:0,reviewOnly:0}
 ]));
 for(const forged of [
  {format_version:1,created_at:DATE,mutationPermitted:true,
   clans:[{source_clan_id:ID,target_clan_id:ID,tables}]},
  {format_version:1,created_at:DATE,mutationPermitted:false,
   clans:[{source_clan_id:ID,target_clan_id:ID,tables:{...tables,cwl_stat_wars:{new:-1,identical:0,conflict:0,reviewOnly:0}}}]},
  {format_version:1,created_at:DATE,mutationPermitted:false,
   clans:[{source_clan_id:ID,target_clan_id:ID,tables:{...tables,cwl_stat_wars:null}}]}
 ]) assert.throws(()=>gate.summarizePortableRestoreCoverage(forged),/Cloud-Backup/);
});
