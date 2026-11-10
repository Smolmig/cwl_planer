"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sql=read("supabase/migrations/20261110182000_cwl_clan_loyalty_evidence.sql");

test("Loyalty data is tenant-isolated, owner-only and no browser can write evidence",()=>{
 for(const table of ["cwl_clan_donation_observations","cwl_clan_absence_observations"]){
  assert.match(sql,new RegExp("ALTER TABLE public\\."+table+" ENABLE ROW LEVEL SECURITY","i"));
  assert.match(sql,new RegExp("REVOKE ALL ON public\\."+table+" FROM PUBLIC,anon,authenticated","i"));
  assert.match(sql,new RegExp("FOR SELECT TO authenticated USING \\(private\\.cwl_is_owner\\(clan_id\\)\\)","i"));
  assert.match(sql,new RegExp("FOREIGN KEY \\(clan_id,source_clash_tag,player_tag\\)","i"));
  assert.doesNotMatch(sql,new RegExp("GRANT (?:INSERT|UPDATE|DELETE|ALL) ON public\\."+table+" TO authenticated","i"));
 }
 assert.match(sql,/SECURITY INVOKER SET search_path = ''/);
 assert.match(sql,/current_user <> 'service_role'/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|grant execute on function .* to (?:anon|authenticated)/i);
});

test("Only changed verified donation timestamps can append, not seasonal decreases or replay",()=>{
 assert.match(sql,/NEW\.last_donation_increase_at IS DISTINCT FROM OLD\.last_donation_increase_at/);
 assert.match(sql,/NEW\.last_donation_increase_by BETWEEN 1 AND 9999999/);
 assert.match(sql,/positive_delta integer NOT NULL CHECK \(positive_delta BETWEEN 1 AND 9999999\)/);
 assert.match(sql,/PRIMARY KEY \(clan_id,source_clash_tag,player_tag,observed_at\)/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
 const source=read("supabase/migrations/20261110145500_cwl_clan_rank_donation_evidence.sql");
 assert.match(source,/p\.donations>t\.last_donations/);
 assert.match(source,/v_now-t\.last_donations_at <= interval '3 hours'/);
 assert.match(source,/t\.is_present/);
});

test("Departure and return events preserve bounded observed absence, not fabricated offline time",()=>{
 assert.match(sql,/OLD\.is_present AND NOT NEW\.is_present/);
 assert.match(sql,/NOT OLD\.is_present AND NOT NEW\.is_present/);
 assert.match(sql,/NOT OLD\.is_present AND NEW\.is_present/);
 assert.match(sql,/v_elapsed <= 10800/);
 assert.match(sql,/ELSE 0 END/);
 assert.match(sql,/OLD\.observed_visits/);
 assert.match(sql,/return_observed_at=NEW\.last_observed_at/);
 assert.doesNotMatch(sql,/UPDATE public\.cwl_clan_member_tenure|DELETE FROM public\.cwl_clan_member_tenure/);
 const old=read("supabase/migrations/20261110114500_cwl_clan_member_tenure.sql");
 assert.match(old,/confirmed_seconds=t\.confirmed_seconds\+case/);
});

test("Existing client, collector and promotion logic are not silently converted to loyalty scoring",()=>{
 const core=read("clan-management-core.js"),edge=read("supabase/functions/coc-stats-collector/index.ts");
 assert.match(core,/loyaltyReviewChecks/);
 assert.match(core,/loyalty_min_days:60/);
 assert.match(edge,/cwl_observe_clan_roster_evidence/);
 assert.match(sql,/AFTER UPDATE ON public\.cwl_clan_member_tenure/);
 assert.doesNotMatch(sql,/cwl_clan_management_rules|CREATE POLICY.*TO anon/);
});
