"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261119144800_cwl_owned_portable_snapshot.sql"),"utf8");
const fixture=fs.readFileSync(path.join(root,"tests/sql/portable-cloud-export-fixture.sql"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/portable-cloud-export-ci.yml"),"utf8");
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const OWNER="33333333-3333-4333-8333-333333333333";

function rowsFor(specs){
 const rows=Object.fromEntries(specs.map(x=>[x.name,[]]));
 const profile=Object.fromEntries(specs.find(x=>x.name==="cwl_cloud_profiles").columns.map(k=>[k,null]));
 Object.assign(profile,{
  clan_id:A,data_version:9,revision:3,
  profile_json:{members:[{name:"Captain",playerTag:"#P8Y2"}],
   locks:[{locked:false,lineup:[]}],archives:[]}
 });
 rows.cwl_cloud_profiles=[profile];return rows;
}
function rpcMock(data,{login=OWNER,called=[]}={}){
 return{
  rpc(name,args){called.push({name,args});return Promise.resolve({data,error:null});},
  auth:{getUser:async()=>({data:{user:{id:login}},error:null})}
 };
}

test("SQL owner-snapshot has explicit 17 projections matching the portable manifest",async()=>{
 const {PORTABLE_CLOUD_TABLES}=await import("../cloud-portable-backup-core.mjs");
 assert.equal(PORTABLE_CLOUD_TABLES.length,17);
 for(const spec of PORTABLE_CLOUD_TABLES){
  const match=sql.match(new RegExp(
   "SELECT\\s+([a-z0-9_,\\s]+)\\s+FROM public\\."+spec.name+
   "\\s+WHERE clan_id = v_clan\\.id\\s+ORDER BY ([a-z0-9_,\\s]+)\\s+LIMIT 100001","i"
  ));
  assert.ok(match,"SQL projection missing "+spec.name);
  const cols=match[1].split(",").map(s=>s.trim());
  const order=match[2].split(",").map(s=>s.trim());
  assert.deepEqual(cols,spec.columns,"column drift "+spec.name);
  assert.deepEqual(order,spec.key,"primary-key order drift "+spec.name);
  assert.match(fixture,new RegExp("CREATE TABLE public\\."+spec.name+"\\s*\\("));
 }
 const actual=[...sql.matchAll(/FROM public\.(cwl_[a-z_]+)\s+WHERE clan_id = v_clan\.id/g)];
 assert.equal(actual.length,17);
});
test("SQL function is STABLE INVOKER, has fail-closed rights and contains no data writes",()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.cwl_export_owned_backup\(p_clan_ids uuid\[\]\)/);
 assert.match(sql,/RETURNS jsonb\s+LANGUAGE plpgsql\s+STABLE\s+SECURITY INVOKER\s+SET search_path = ''/);
 assert.match(sql,/m\.role = 'owner'/);
 assert.match(sql,/c\.owner_user_id = v_owner/);
 assert.match(sql,/v_count <> v_requested/);
 assert.match(sql,/COUNT\(DISTINCT ids\.id\)/);
 assert.match(sql,/LIMIT 100001/);
 assert.match(sql,/octet_length\(v_tables::text\) > 67108864/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.cwl_export_owned_backup\(uuid\[\]\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.cwl_export_owned_backup\(uuid\[\]\) TO authenticated/);
 const executable=sql.split("\n").filter(s=>!s.trim().startsWith("--")).join("\n");
 const body=executable.match(/AS \$portable_export\$([\s\S]*?)\$portable_export\$/)[1];
 assert.doesNotMatch(body,/\b(?:insert|update|delete|truncate|drop|alter|execute)\s+(?:into|from|table|public\.)\b/i);
 assert.doesNotMatch(body,/\bSECURITY DEFINER\b|auth\.users|service_role|cwl_clan_invites|cwl_access_blocks/i);
 assert.match(body,/consistency','server-stable-statement'/);
 assert.match(workflow,/postgres:17/);
 assert.match(workflow,/tests\/sql\/portable-cloud-export-check\.sql/);
 assert.match(workflow,/node --input-type=module/);
 assert.doesNotMatch(workflow,/SUPABASE_DB_URL|service_role|secrets\./i);
});
test("snapshot RPC adapter verifies owner session, exact source IDs and checksum",async()=>{
 const core=await import("../cloud-portable-backup-core.mjs");
 const data={
  kind:core.PORTABLE_CLOUD_BACKUP_KIND,format_version:1,
  created_at:"2026-11-19T14:48:00Z",consistency:"server-stable-statement",
  clans:[{source_clan_id:A,name:"UF",clash_tag:"#P8Y2",
   tables:rowsFor(core.PORTABLE_CLOUD_TABLES)}]
 };
 const called=[];
 const file=await core.exportOwnerCloudSnapshot({sb:rpcMock(data,{called}),clanIds:[A]});
 assert.equal(file.consistency,"server-stable-statement");
 assert.equal(called.length,1);
 assert.equal(called[0].name,"cwl_export_owned_backup");
 assert.deepEqual(called[0].args.p_clan_ids,[A]);
 assert.equal((await core.verifyPortableCloudBackup(file)).clans[0].source_clan_id,A);
});
test("snapshot adapter rejects partial server payload, foreign clan, old format, session drift",async()=>{
 const core=await import("../cloud-portable-backup-core.mjs");
 const data={
  kind:core.PORTABLE_CLOUD_BACKUP_KIND,format_version:1,
  created_at:"2026-11-19T14:48:00Z",consistency:"server-stable-statement",
  clans:[{source_clan_id:A,name:"UF",clash_tag:"#P8Y2",
   tables:rowsFor(core.PORTABLE_CLOUD_TABLES)}]
 };
 await assert.rejects(()=>core.exportOwnerCloudSnapshot({
  sb:rpcMock({...data,clans:[]}),clanIds:[A]}),/Unvollständiger/);
 await assert.rejects(()=>core.exportOwnerCloudSnapshot({
  sb:rpcMock({...data,clans:[{...data.clans[0],source_clan_id:B}]}),clanIds:[A]}),/Unvollständiger/);
 await assert.rejects(()=>core.exportOwnerCloudSnapshot({
  sb:rpcMock({...data,consistency:"client-read-non-atomic"}),clanIds:[A]}),/Unvollständiger/);
 let n=0;
 const sb=rpcMock(data);
 sb.auth.getUser=async()=>({data:{user:{id:++n===1?OWNER:B}},error:null});
 await assert.rejects(()=>core.exportOwnerCloudSnapshot({sb,clanIds:[A]}),/Benutzersitzung/);
 await assert.rejects(()=>core.exportOwnerCloudSnapshot({sb:rpcMock(data),clanIds:[A,A]}),/ungültige Clanauswahl/);
});
test("legacy client backup is still explicitly non-atomic and verifiable",async()=>{
 const core=await import("../cloud-portable-backup-core.mjs");
 const file=await core.createPortableCloudBackup({
  clans:[{source_clan_id:A,name:"UF",clash_tag:"#P8Y2",tables:rowsFor(core.PORTABLE_CLOUD_TABLES)}],
  createdAt:"2026-11-19T14:48:00Z"
 });
 assert.equal(file.consistency,"client-read-non-atomic");
 assert.equal((await core.verifyPortableCloudBackup(file)).consistency,"client-read-non-atomic");
});

test("owner-only preview compares imported file against one consistent server target snapshot",async()=>{
 const core=await import("../cloud-portable-backup-core.mjs");
 const sourceTables=rowsFor(core.PORTABLE_CLOUD_TABLES);
 const file=await core.createPortableCloudBackup({
  clans:[{source_clan_id:A,name:"UF",clash_tag:"#P8Y2",tables:sourceTables}],
  createdAt:"2026-11-19T14:48:00Z",consistency:"server-stable-statement"
 });
 const targetTables=rowsFor(core.PORTABLE_CLOUD_TABLES);
 targetTables.cwl_cloud_profiles[0].clan_id=B;
 targetTables.cwl_cloud_profiles[0].revision=5;
 const payload={kind:core.PORTABLE_CLOUD_BACKUP_KIND,format_version:1,
  created_at:"2026-11-19T14:49:00Z",consistency:"server-stable-statement",
  clans:[{source_clan_id:B,name:"UF",clash_tag:"#P8Y2",tables:targetTables}]
 };
 const called=[];
 const preview=await core.previewOwnerCloudRestore({
  sb:rpcMock(payload,{called}),file,mapping:{[A]:B}
 });
 assert.equal(called.length,1);
 assert.deepEqual(called[0].args.p_clan_ids,[B]);
 assert.equal(preview.mutationPermitted,false);
 assert.equal(preview.target_snapshot_consistency,"server-stable-statement");
 assert.match(preview.target_snapshot_sha256,/^[0-9a-f]{64}$/);
 assert.equal(preview.clans[0].tables.cwl_cloud_profiles.conflict,1);
 assert.equal(sourceTables.cwl_cloud_profiles[0].revision,3);
 assert.equal(targetTables.cwl_cloud_profiles[0].revision,5);
});
test("preview does not authorize a cross-tag or target RLS-denied restore",async()=>{
 const core=await import("../cloud-portable-backup-core.mjs");
 const file=await core.createPortableCloudBackup({
  clans:[{source_clan_id:A,name:"UF",clash_tag:"#P8Y2",
   tables:rowsFor(core.PORTABLE_CLOUD_TABLES)}],
  createdAt:"2026-11-19T14:48:00Z"
 });
 const targetTables=rowsFor(core.PORTABLE_CLOUD_TABLES);
 targetTables.cwl_cloud_profiles[0].clan_id=B;
 const wrongTag={kind:core.PORTABLE_CLOUD_BACKUP_KIND,format_version:1,
  created_at:"2026-11-19T14:49:00Z",consistency:"server-stable-statement",
  clans:[{source_clan_id:B,name:"UF",clash_tag:"#QL8P",tables:targetTables}]
 };
 await assert.rejects(()=>core.previewOwnerCloudRestore({
  sb:rpcMock(wrongTag),file,mapping:{[A]:B}
 }),/stimmt nicht überein/);
 const blocked={
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async()=>({data:null,error:{code:"42501"}})
 };
 await assert.rejects(()=>core.previewOwnerCloudRestore({
  sb:blocked,file,mapping:{[A]:B}
 }),/Snapshot konnte nicht erstellt/);
 await assert.rejects(()=>core.previewOwnerCloudRestore({
  sb:rpcMock(wrongTag),file,mapping:{[A]:"not-a-uuid"}
 }),/Ungültige oder doppelte Zielclans/);
});
