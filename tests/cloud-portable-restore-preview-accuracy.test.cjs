"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");

const SOURCE="11111111-1111-4111-8111-111111111111";
const TARGET="88888888-8888-4888-8888-888888888888";
const TAG="#P8Y2";
const DATE="2026-11-20T12:30:00Z";
const auditId=41;

async function fixture(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const gate=await import("../cloud-portable-backup-release-gate.mjs");
 const specifications=new Map(core.PORTABLE_CLOUD_TABLES.map(spec=>[spec.name,spec]));
 const row=(table,values={},id=SOURCE)=>Object.assign(
  Object.fromEntries(specifications.get(table).columns.map(column=>[column,null])),
  {clan_id:id},values);
 const source=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(spec=>[spec.name,[]]));
 source.cwl_cloud_profiles=[row("cwl_cloud_profiles",{
  data_version:9,revision:4,created_at:DATE,updated_at:DATE,
  profile_json:{name:"Synthetic",members:[],locks:[{locked:false,lineup:[]}],archives:[]}
 })];
 source.cwl_change_events=[row("cwl_change_events",{
  id:auditId,revision:4,event_type:"test",details:{message:"recorded"},created_at:DATE
 })];
 source.cwl_clan_donation_observations=[row("cwl_clan_donation_observations",{
  source_clash_tag:TAG,player_tag:"#P8Y2",observed_at:DATE,positive_delta:10
 })];
 const file=await core.createPortableCloudBackup({
  clans:[{source_clan_id:SOURCE,name:"Synthetic",clash_tag:TAG,tables:source}],
  createdAt:DATE,consistency:"server-stable-statement"
 });
 const target=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(spec=>[
  spec.name,source[spec.name].map(r=>({...r,clan_id:TARGET}))
 ]));
 const inspect=async()=>core.previewPortableCloudRestore(file,{
  targets:[{id:TARGET,clash_tag:TAG,isOwner:true}],
  mapping:{[SOURCE]:TARGET},existingByClan:{[TARGET]:target}
 });
 return {core,gate,file,target,row,inspect};
}
test("identical immutable owner history and observed evidence are counted as identical, never review-only",async()=>{
 const {gate,inspect}=await fixture();
 const preview=await inspect();
 assert.equal(preview.mutationPermitted,false);
 assert.equal(preview.clans[0].tables.cwl_change_events.identical,1);
 assert.equal(preview.clans[0].tables.cwl_change_events.reviewOnly,0);
 assert.equal(preview.clans[0].tables.cwl_clan_donation_observations.identical,1);
 assert.equal(preview.clans[0].tables.cwl_clan_donation_observations.reviewOnly,0);
 const report=gate.summarizePortableRestoreCoverage(preview);
 assert.equal(report.alreadyIdentical,true);
 assert.equal(report.nothingToImport,true);
 assert.equal(report.fullRestoreAvailable,false);
 assert.equal(report.mutationPermitted,false);
});
test("additional destination war and newer audit history are preserved as target-only, not restore conflicts",async()=>{
 const {gate,target,row,inspect}=await fixture();
 target.cwl_stat_wars.push(row("cwl_stat_wars",{
  war_key:"normal:recent",war_type:"normal",source:"api",
  finalized:true,missed_log_complete:true,source_clash_tag:TAG
 },TARGET));
 target.cwl_change_events.push(row("cwl_change_events",{
  id:42,revision:5,event_type:"newer",details:{},created_at:DATE
 },TARGET));
 const original=JSON.stringify(target);
 const preview=await inspect();
 const report=gate.summarizePortableRestoreCoverage(preview);
 assert.equal(report.counts.targetOnly,2);
 assert.equal(report.counts.new,0);
 assert.equal(report.counts.conflict,0);
 assert.equal(report.counts.reviewOnly,0);
 assert.equal(report.counts.total,3);
 assert.equal(report.nothingToImport,true);
 assert.equal(report.alreadyIdentical,false);
 assert.equal(report.targetHasAdditionalData,true);
 assert.equal(report.clans[0].rows.find(x=>x.table==="cwl_stat_wars").targetOnly,1);
 assert.match(report.explanation,/zusätzliche Daten/);
 assert.equal(JSON.stringify(target),original,"preview cannot mutate newer destination");
});
test("missing and altered immutable audit rows still require review and must never become writable",async()=>{
 const {gate,target,inspect}=await fixture();
 target.cwl_change_events[0]={...target.cwl_change_events[0],details:{message:"different"}};
 target.cwl_clan_donation_observations=[];
 const preview=await inspect();
 const report=gate.summarizePortableRestoreCoverage(preview);
 assert.equal(report.counts.reviewOnly,2);
 assert.equal(report.counts.conflict,0);
 assert.equal(report.nothingToImport,false);
 assert.equal(report.clans[0].rows.find(x=>x.table==="cwl_change_events").requiresRecovery,true);
 assert.equal(report.mutationPermitted,false);
 assert.equal(report.fullRestoreAvailable,false);
});
test("different current plan revision remains a conflict, not swallowed by target-only detection",async()=>{
 const {gate,target,inspect}=await fixture();
 target.cwl_cloud_profiles[0]={...target.cwl_cloud_profiles[0],revision:5};
 const report=gate.summarizePortableRestoreCoverage(await inspect());
 assert.equal(report.counts.conflict,1);
 assert.equal(report.counts.targetOnly,0);
 assert.equal(report.alreadyIdentical,false);
 assert.equal(report.mutationPermitted,false);
});
test("invalid reverse diff counts fail closed and legacy previews remain readable",async()=>{
 const {gate,inspect}=await fixture();
 const preview=await inspect();
 const table=preview.clans[0].tables.cwl_cloud_profiles;
 for(const v of [-1,1.2,NaN,100001]){
  table.targetOnly=v;
  assert.throws(()=>gate.summarizePortableRestoreCoverage(preview),/Ungültige neuere Zieldaten/);
 }
 delete table.targetOnly;
 const report=gate.summarizePortableRestoreCoverage(preview);
 assert.equal(report.counts.targetOnly,0);
 assert.equal(report.alreadyIdentical,true);
});


test("duplicate destination, forged counter fields and malformed envelope are rejected",async()=>{
 const {gate,inspect}=await fixture();
 const preview=await inspect();
 const doubleTarget=structuredClone(preview);
 doubleTarget.clans.push({
  ...structuredClone(doubleTarget.clans[0]),
  source_clan_id:"22222222-2222-4222-8222-222222222222"
 });
 assert.throws(()=>gate.summarizePortableRestoreCoverage(doubleTarget),/Ungültige Quell-\/Zielzuordnung/);
 const extraField=structuredClone(preview);
 extraField.clans[0].tables.cwl_change_events.systemPrivilege=true;
 assert.throws(()=>gate.summarizePortableRestoreCoverage(extraField),/Unerlaubtes Vergleichsfeld/);
 for(const bad of [
  {...preview,format_version:99},
  {...preview,created_at:"not-a-date"},
  {...preview,mutationPermitted:true}
 ]) assert.throws(()=>gate.summarizePortableRestoreCoverage(bad),/Ungültige Read-only-Vorschau/);
});
