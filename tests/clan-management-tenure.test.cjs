"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=path.resolve(__dirname,"..");
const file=p=>fs.readFileSync(path.join(base,p),"utf8");

test("Never treat partial, invalid or repeated API roster as a membership observation",async()=>{
 const {rosterTags}=await import("../supabase/functions/coc-stats-collector/collector-roster.mjs");
 const rows={items:[{tag:"#2PYL",name:"A"},{tag:"#2PYQ",name:"B"}]};
 assert.deepEqual(rosterTags(rows),["#2PYL","#2PYQ"]);
 for(const bad of [null,{}, {items:[]},
  {...rows,paging:{cursors:{after:"next"}}},
  {...rows,paging:{cursors:{before:"previous"}}},
  {items:[rows.items[0],{...rows.items[0],tag:"#2pyl"}]},
  {items:[{tag:"#WRONG",name:"A"}]},
  {items:[{tag:"#2PYL",name:""}]},
  {items:Array(51).fill(rows.items[0])}]){
  assert.throws(()=>rosterTags(bad));
 }
});
test("Tenure migration is tenant scoped, service-only write, owner-only read",()=>{
 const sql=file("supabase/migrations/20261110114500_cwl_clan_member_tenure.sql");
 assert.match(sql,/primary key \(clan_id,source_clash_tag,player_tag\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/for select to authenticated using \(private\.cwl_is_owner\(clan_id\)\)/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/current_user <> 'service_role'/);
 assert.match(sql,/grant execute on function public\.cwl_observe_clan_roster\(uuid,text,text\[\]\)\s+to service_role/);
 assert.match(sql,/not t\.is_present and t\.player_tag=any\(p_tags\)/);
 assert.match(sql,/v_now-t\.last_observed_at <= interval '3 hours'/);
 assert.doesNotMatch(sql,/grant (?:update|insert|delete|all) on public\.cwl_clan_member_tenure to authenticated/i);
});
test("Scheduled collector alone writes snapshots; UI only reads confirmed hours",()=>{
 const edge=file("supabase/functions/coc-stats-collector/index.ts");
 const sync=file("cloud-sync.mjs");
 assert.match(edge,/members\?limit=50/);
 assert.match(edge,/rpc\/cwl_observe_clan_roster/);
 assert.match(sync,/from\("cwl_clan_member_tenure"\)\.select/);
 const start=sync.indexOf("async fetchManagementRoster(){"),end=sync.indexOf("isEmergencyEditing:",start);
 const part=sync.slice(start,end);
 assert.doesNotMatch(part,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
});

test("Evidence labels never backdate unobserved time and identify leave-return sessions",()=>{
 const core=require("../clan-management-core.js");
 const now=Date.parse("2026-11-10T10:00:00Z");
 const rows=[
  {player_tag:"#2PYL",confirmed_seconds:25*3600,observed_visits:2,is_present:true,
   last_observed_at:"2026-11-10T09:00:00Z"},
  {player_tag:"#2PYQ",confirmed_seconds:3*3600,observed_visits:1,is_present:false,
   last_observed_at:"2026-11-08T09:00:00Z"}
 ];
 assert.equal(core.tenureLabel(null,now),"Mitgliedschaftszeit noch nicht beobachtet");
 assert.match(core.tenureLabel(rows[0],now),/1 Tg\. 1 Std\. · 2 beobachtete Aufenthalte/);
 assert.match(core.tenureLabel(rows[1],now),/ausgetreten/);
 assert.match(core.tenureLabel(rows[1],now),/Stand älter als 24 Std/);
 assert.match(core.tenureLabel({...rows[0],confirmed_seconds:-5},now),/unklar/);
 const people=[
  {tag:"#2PYL",name:"Return",role:"member"},
  {tag:"#2PYQ",name:"Former",role:"admin"},
  {tag:"#2PYR",name:"Vize",role:"coLeader"}
 ];
 const preview=core.buildPreview(people,rows);
 assert.equal(preview.rows.length,2);
 assert.match(preview.rows.find(x=>x.name==="Return").tenureNote,/2 beobachtete Aufenthalte/);
 assert.ok(preview.rows.every(x=>x.rank!=="coLeader"));
 assert.equal(preview.eligibleForRecommendation,0);
});
