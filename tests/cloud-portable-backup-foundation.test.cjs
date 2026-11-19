"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");

const {
 PORTABLE_CLOUD_BACKUP_KIND,PORTABLE_CLOUD_BACKUP_FORMAT,PORTABLE_CLOUD_TABLES,
 PORTABLE_EXCLUDED_TABLES,createPortableCloudBackup,verifyPortableCloudBackup,
 previewPortableCloudRestore,collectOwnerCloudBackup,canonicalBackupJson
}=awaitImport();

function awaitImport(){
 // Node 22's test runner supports dynamic ESM loading from a CJS test file.
 return new Proxy({}, {get(_target,key){return (...args)=>import("../cloud-portable-backup-core.mjs").then(m=>m[key](...args))}});
}
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const OWNER="33333333-3333-4333-8333-333333333333";
const FOREIGN="44444444-4444-4444-8444-444444444444";
const TAG="#P8Y2";
function emptyTables(){
 return Object.fromEntries(PORTABLE_CLOUD_TABLES.map(s=>[s.name,[]]));
}
function row(name,values={},clanId=A){
 const spec=PORTABLE_CLOUD_TABLES.find(x=>x.name===name);
 assert.ok(spec,"test needs known table "+name);
 return Object.assign(Object.fromEntries(spec.columns.map(col=>[col,null])),{clan_id:clanId},values);
}
function profile(clanId=A){
 return row("cwl_cloud_profiles",{
  data_version:9,revision:1,profile_json:{
   name:"United Fighters",members:[{id:"m1",playerTag:"#P8Y2",note:"privat"}],
   locks:[{locked:false,lineup:[]}],archives:[]
  },created_at:"2026-11-19T08:00:00Z",updated_at:"2026-11-19T08:00:00Z"
 },clanId);
}
function basicClan(id=A,tag=TAG){
 const tables=emptyTables();tables.cwl_cloud_profiles=[profile(id)];
 return {source_clan_id:id,name:"United Fighters",clash_tag:tag,tables};
}
async function backup(clans=[basicClan()]){
 const m=await import("../cloud-portable-backup-core.mjs");
 return m.createPortableCloudBackup({clans,createdAt:"2026-11-19T11:00:00Z"});
}
function getError(fn,pattern){return assert.rejects(fn,pattern);}
function mockSb({clans,allRows={},userId=OWNER,failTable="",log=[]}){
 let changedUserId=userId;
 const api={
  auth:{async getUser(){return{data:{user:changedUserId?{id:changedUserId}:null},error:null}}},
  from(table){
   let filters=[],inFilters=[],range=null,orders=[];
   const query={
    select(columns){log.push({table,columns});return query;},
    eq(col,value){filters.push([col,value]);return query;},
    in(col,values){inFilters.push([col,values]);return query;},
    order(col){orders.push(col);return query;},
    range(start,end){range=[start,end];return Promise.resolve(output());},
    then(resolve,reject){return Promise.resolve(output()).then(resolve,reject);}
   };
   function output(){
    if(table===failTable)return{data:null,error:{message:"forced RLS/query failure"}};
    let rows=(table==="cwl_clans"?clans:allRows[table]||[]).filter(x=>
     filters.every(([k,v])=>x[k]===v)&&inFilters.every(([k,arr])=>arr.includes(x[k])));
    for(const field of orders.slice().reverse())rows=rows.slice().sort((x,y)=>
     String(x[field]).localeCompare(String(y[field])));
    if(range)rows=rows.slice(range[0],range[1]+1);
    return{data:rows,error:null};
   }
   return query;
  },
  setUserId(next){changedUserId=next;}
 };
 return api;
}

test("backup allowlist explicitly covers plans, archives, wars, misses and private audits, not invitations",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 assert.equal(m.PORTABLE_CLOUD_TABLES.length,17);
 for(const name of ["cwl_stat_attacks","cwl_stat_missed","cwl_clan_cw_missed_decisions",
  "cwl_missed_owner_decisions","cwl_clan_management_rules","cwl_group_archives",
  "cwl_plan_review_state","cwl_plan_suggestions","cwl_clan_member_tenure"]){
  assert.ok(m.PORTABLE_CLOUD_TABLES.some(x=>x.name===name),name);
 }
 for(const name of ["cwl_clan_invites","cwl_clan_memberships","cwl_access_blocks",
  "cwl_clan_presence","cwl_stat_collector_status"]){
  assert.ok(m.PORTABLE_EXCLUDED_TABLES.includes(name));
  assert.ok(!m.PORTABLE_CLOUD_TABLES.some(x=>x.name===name));
 }
 assert.ok(!m.PORTABLE_CLOUD_TABLES.some(x=>x.columns.some(k=>
  /token|password|secret|code_hash/i.test(k))));
});
test("valid backup verifies and includes versioned SHA-256 and private profile data",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const file=await backup();
 assert.equal(file.kind,m.PORTABLE_CLOUD_BACKUP_KIND);
 assert.equal(file.format_version,m.PORTABLE_CLOUD_BACKUP_FORMAT);
 assert.match(file.sha256,/^[0-9a-f]{64}$/);
 assert.equal(file.consistency,"client-read-non-atomic");
 const result=await m.verifyPortableCloudBackup(file);
 assert.equal(result.clans[0].tables.cwl_cloud_profiles[0].profile_json.members[0].note,"privat");
 assert.ok(!("sha256" in result));
});
test("canonical fingerprint ignores row insertion and object property order",async()=>{
 const c=basicClan();
 c.tables.cwl_stat_wars=[
  row("cwl_stat_wars",{war_key:"normal:w2",war_type:"normal"}),
  row("cwl_stat_wars",{war_key:"normal:w1",war_type:"normal"})
 ];
 const a=await backup([c]);
 c.tables.cwl_stat_wars.reverse();
 c.tables.cwl_cloud_profiles[0].profile_json={
  archives:[],locks:[{lineup:[],locked:false}],
  members:[{note:"privat",playerTag:"#P8Y2",id:"m1"}],name:"United Fighters"
 };
 const b=await backup([c]);
 assert.equal(a.sha256,b.sha256);
});
test("changed bytes are rejected even if the attacker keeps old checksum",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const file=await backup();
 const changed=JSON.parse(JSON.stringify(file));
 changed.clans[0].tables.cwl_cloud_profiles[0].profile_json.members[0].note="edited";
 await getError(()=>m.verifyPortableCloudBackup(changed),/Integritätsprüfung/);
});
test("tampering with version, extra secret and missing dataset fails closed",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const base=basicClan();delete base.tables.cwl_stat_missed;
 await getError(()=>backup([base]),/unvollständiges Backup/);
 const version=await backup();version.format_version=2;
 await getError(()=>m.verifyPortableCloudBackup(version),/nicht unterstützt/);
 const secret=basicClan();secret.tables.cwl_cloud_profiles[0].service_role="unsafe";
 await getError(()=>backup([secret]),/unerlaubtes Feld/);
});
test("clan isolation, duplicate keys and nonempty profile are required",async()=>{
 const c=basicClan();
 c.tables.cwl_stat_missed=[row("cwl_stat_missed",{war_key:"normal:x",player_tag:"#P8Y2"},B)];
 await getError(()=>backup([c]),/anderen Clan/);
 c.tables.cwl_stat_missed=[];
 c.tables.cwl_cloud_profiles.push(profile());
 await getError(()=>backup([c]),/doppelter Primärschlüssel/);
 c.tables.cwl_cloud_profiles=[];
 await getError(()=>backup([c]),/genau ein Cloud-Profil/);
});
test("orphan attacks and missed attacks are not silently accepted",async()=>{
 const c=basicClan();
 c.tables.cwl_stat_attacks=[row("cwl_stat_attacks",{
  war_key:"normal:orphan",attacker_tag:"#P8Y2",attack_order:1,stars:3,destruction:100
 })];
 await getError(()=>backup([c]),/ohne zugehörigen Krieg/);
 c.tables.cwl_stat_attacks=[];
 c.tables.cwl_stat_missed=[row("cwl_stat_missed",{
  war_key:"normal:orphan",player_tag:"#P8Y2",missed_count:1
 })];
 await getError(()=>backup([c]),/ohne zugehörigen Krieg/);
});
test("preview is strictly non-mutating and counts new/identical/conflict separately",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const file=await backup();
 const current=emptyTables();
 current.cwl_cloud_profiles=[{...profile(B),revision:2}];
 const preview=await m.previewPortableCloudRestore(file,{
  targets:[{id:B,clash_tag:TAG,isOwner:true}],
  mapping:{[A]:B},existingByClan:{[B]:current}
 });
 assert.equal(preview.mutationPermitted,false);
 assert.equal(preview.clans[0].tables.cwl_cloud_profiles.conflict,1);
 assert.equal(preview.clans[0].tables.cwl_stat_wars.new,0);
 assert.equal(current.cwl_cloud_profiles[0].revision,2);
 current.cwl_cloud_profiles=[profile(B)];
 const identical=await m.previewPortableCloudRestore(file,{
  targets:[{id:B,clash_tag:TAG,isOwner:true}],
  mapping:{[A]:B},existingByClan:{[B]:current}
 });
 assert.equal(identical.clans[0].tables.cwl_cloud_profiles.identical,1);
});
test("private append-only owner decisions require review, never automatic replay",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const clan=basicClan();
 clan.tables.cwl_clan_cw_missed_decisions=[row("cwl_clan_cw_missed_decisions",{
  id:42,source_clash_tag:TAG,war_key:"normal:war",player_tag:"#P8Y2",
  decision:"excused",note:"belegt"
 })];
 const file=await backup([clan]);
 const result=await m.previewPortableCloudRestore(file,{
  targets:[{id:B,clash_tag:TAG,isOwner:true}],mapping:{[A]:B},
  existingByClan:{[B]:emptyTables()}
 });
 assert.equal(result.clans[0].tables.cwl_clan_cw_missed_decisions.reviewOnly,1);
 assert.equal(result.clans[0].tables.cwl_clan_cw_missed_decisions.new,0);
});
test("preview rejects viewer targets, cross-clan tags and incomplete target inventory",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const file=await backup();
 const options={targets:[{id:B,clash_tag:TAG,isOwner:false}],
  mapping:{[A]:B},existingByClan:{[B]:emptyTables()}};
 await getError(()=>m.previewPortableCloudRestore(file,options),/nicht ausdrücklich/);
 options.targets[0].isOwner=true;options.targets[0].clash_tag="#QL8P";
 await getError(()=>m.previewPortableCloudRestore(file,options),/stimmt nicht überein/);
 options.targets[0].clash_tag=TAG;
 delete options.existingByClan[B].cwl_stat_attacks;
 await getError(()=>m.previewPortableCloudRestore(file,options),/Ziel-Datentabelle fehlt/);
});
test("owner-only collector paginates all rows and never uses * or writes",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const logs=[];
 const data={
  cwl_cloud_profiles:[profile()],
  cwl_stat_wars:["normal:w1","normal:w2","normal:w3"].map(w=>
   row("cwl_stat_wars",{war_key:w,war_type:"normal"}))
 };
 const sb=mockSb({clans:[{id:A,name:"UF",clash_tag:TAG,owner_user_id:OWNER}],
  allRows:data,log:logs});
 const file=await m.collectOwnerCloudBackup({sb,clanIds:[A],pageSize:2});
 const verified=await m.verifyPortableCloudBackup(file);
 assert.equal(verified.clans[0].tables.cwl_stat_wars.length,3);
 assert.ok(logs.filter(x=>x.table==="cwl_stat_wars").length>=2);
 assert.ok(logs.every(x=>x.columns!=="*"));
 assert.equal(logs.filter(x=>x.table==="cwl_clans").length,2);
});
test("collector rejects unauthorized clan, failed RLS query and invalid selected IDs",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const clans=[{id:A,name:"UF",clash_tag:TAG,owner_user_id:FOREIGN}];
 const data={cwl_cloud_profiles:[profile()]};
 const sb=mockSb({clans,allRows:data});
 await getError(()=>m.collectOwnerCloudBackup({sb,clanIds:[A]}),/nicht alle Clans/);
 const owned=mockSb({clans:[{...clans[0],owner_user_id:OWNER}],allRows:data,
  failTable:"cwl_stat_attacks"});
 await getError(()=>m.collectOwnerCloudBackup({sb:owned,clanIds:[A]}),/unvollständiger oder gesperrter Export/);
 await getError(()=>m.collectOwnerCloudBackup({sb:owned,clanIds:[A,A]}),/ungültige Clanauswahl/);
});
test("collector cannot export a second clan without matching signed-in ownership",async()=>{
 const m=await import("../cloud-portable-backup-core.mjs");
 const clans=[
  {id:A,name:"UF",clash_tag:TAG,owner_user_id:OWNER},
  {id:B,name:"UF2",clash_tag:"#QL8P",owner_user_id:FOREIGN}
 ];
 await getError(()=>m.collectOwnerCloudBackup({
  sb:mockSb({clans,allRows:{cwl_cloud_profiles:[profile()]}}),
  clanIds:[A,B]
 }),/nicht alle Clans/);
});
