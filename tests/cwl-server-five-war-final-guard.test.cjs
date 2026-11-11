"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261111192000_cwl_review_final_actual_round_five_or_seven.sql"),"utf8");
const fixtures=fs.readFileSync(path.join(root,"tests/sql/cwl-review-final-5-7-fixtures.sql"),"utf8");
const earlier=fs.readFileSync(path.join(root,"supabase/migrations/20261111163500_cwl_review_cycle_cas_checked_rpc.sql"),"utf8");
test("server uses exact league group membership and count to determine the last round",()=>{
 assert.match(migration,/jsonb_array_length\(p_group->'clans'\) not in \(6,8\)/);
 assert.match(migration,/jsonb_array_length\(p_group->'rounds'\)\s*<>\s*jsonb_array_length\(p_group->'clans'\)-1/);
 assert.match(migration,/count\(distinct upper\(x\.value->>'tag'\)\)/);
 assert.match(migration,/when 6 then[\s\S]*?\{rounds,4,day\}.*?'5'/);
 assert.match(migration,/when 8 then[\s\S]*?\{rounds,6,day\}.*?'7'/);
 assert.match(migration,/\$\.rounds\[4\]\.matches\[\*\]/);
 assert.match(migration,/\$\.rounds\[6\]\.matches\[\*\]/);
 assert.match(migration,/@\.state == "warEnded"/);
 assert.match(migration,/@\.available == true/);
 assert.match(migration,/upper\(g\.clan_tag\)=upper\(c\.clash_tag\)/);
});
test("five-war fix cannot modify tenant data, planning cycles or roles",()=>{
 assert.doesNotMatch(migration,/\b(?:insert\s+into|update\s+public\.|delete\s+from|drop\s+table|truncate\s+)\b/i);
 assert.match(migration,/create or replace function private\.cwl_review_group_final_ended/);
 assert.match(migration,/create or replace function private\.cwl_review_last_round_ended/);
 assert.match(migration,/revoke all on function private\.cwl_review_group_final_ended\(jsonb,text\)/);
 assert.match(migration,/revoke all on function private\.cwl_review_last_round_ended\(uuid,text\)/);
 assert.match(migration,/security definer set search_path = ''/);
 assert.match(earlier,/private\.cwl_review_last_round_ended\(p_clan,v_state\.season\)/);
});
test("production-readable, read-only SQL fixtures cover 5/5, 7/7, 6/7 and malicious inconsistencies",()=>{
 for(const name of [
  "five war own finished","seven war own finished","seven with only round five",
  "five war in progress","six clan phantom seven",
  "eight clan incomplete five","duplicate group tags",
  "wrong linked clan","own member missing","no finale match","enemy perspective completed",
  "not a json array"
 ])assert.ok(fixtures.includes(name),name);
 assert.match(fixtures,/private\.cwl_review_group_final_ended/);
 assert.match(fixtures,/where actual is distinct from expected/);
 assert.doesNotMatch(fixtures,/\b(?:insert|update|delete|drop|truncate|alter)\b/i);
});
