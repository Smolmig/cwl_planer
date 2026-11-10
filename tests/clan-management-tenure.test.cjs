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
 assert.match(sql,/grant execute on function public\.cwl_observe_clan_roster\(uuid,text,text\[\]\) to service_role/);
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
