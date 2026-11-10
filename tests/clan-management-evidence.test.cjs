"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const core=require("../clan-management-core.js");

test("Full roster evidence never counts missing donation fields as zero, nor accepts partial or duplicated members",async()=>{
 const {rosterEvidence}=await import("../supabase/functions/coc-stats-collector/collector-roster.mjs");
 const good={items:[
  {tag:"#2PYL",name:"One",role:"admin",donations:12},
  {tag:"#2PYQ",name:"Two",role:"member"}
 ]};
 assert.deepEqual(rosterEvidence(good),[
  {tag:"#2PYL",role:"admin",donations:12},
  {tag:"#2PYQ",role:"member",donations:null}
 ]);
 assert.equal(rosterEvidence({items:[{tag:"#2PYL",name:"One",role:"unknown",donations:-5}]})[0].donations,null);
 for(const bad of [null,{}, {items:[]},
  {...good,paging:{cursors:{after:"next"}}},
  {items:[good.items[0],{...good.items[0]}]}])
  assert.throws(()=>rosterEvidence(bad));
});
test("Rank restoration only after an observed absence and rejoin, never from arbitrary rank",()=>{
 const player={tag:"#2PYL",name:"Back",role:"member",donations:42};
 const baseline={player_tag:player.tag,confirmed_seconds:3600,last_observed_at:"2026-11-10T07:00:00Z",
  observed_visits:2,is_present:true,rank_before_leave:"elder",rank_before_leave_at:"2026-11-01T09:00:00Z"};
 const positive=core.buildPreview([player],[baseline]);
 assert.equal(positive.restoreRankChecks,1);
 assert.match(positive.rows[0].returnRankNote,/Rang nach Rückkehr im Spiel prüfen/);
 assert.match(positive.rows[0].donationNote,/laufende Saison.*42/);
 for(const entry of [{...baseline,observed_visits:1},{...baseline,is_present:false},
  {...baseline,rank_before_leave:"member"},{...baseline,rank_before_leave_at:null}]){
  assert.equal(core.buildPreview([player],[entry]).restoreRankChecks,0);
 }
 assert.equal(core.buildPreview([{...player,role:"admin"}],[baseline]).restoreRankChecks,0);
 assert.equal(core.buildPreview([{...player,role:"coLeader"}],[baseline]).rows.length,0);
});
test("Donation last change is an observed signal, not a last login or proof of inactivity",()=>{
 const entry={last_donation_increase_at:"2026-11-10T08:00:00Z",last_donation_increase_by:3};
 const label=core.donorLabel({donations:25},entry,Date.parse("2026-11-10T10:00:00Z"));
 assert.match(label,/Spenden laut Clash/);assert.match(label,/Spendenzuwachs beobachtet/);
 assert.doesNotMatch(label,/online|offline|zuletzt eingeloggt/i);
 assert.doesNotMatch(core.donorLabel({donations:null},null),/Spenden/);
 assert.doesNotMatch(core.donorLabel({donations:0},{last_donation_increase_by:4}),/beobachtet/);
});
test("Rank and donation evidence RPC is tenant-scoped service only, uses old interval guard atomically",()=>{
 const migration=read("supabase/migrations/20261110145500_cwl_clan_rank_donation_evidence.sql");
 assert.match(migration,/current_user <> 'service_role'/);
 assert.match(migration,/security invoker/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/perform public\.cwl_observe_clan_roster\(p_clan,p_clash_tag,v_tags\)/);
 assert.match(migration,/rank_before_leave=t\.last_clash_rank/);
 assert.match(migration,/t\.is_present and not \(t\.player_tag=any\(v_tags\)\)/);
 assert.match(migration,/p\.donations>t\.last_donations/);
 assert.match(migration,/v_now-t\.last_donations_at <= interval '3 hours'/);
 assert.match(migration,/grant execute on function public\.cwl_observe_clan_roster_evidence\(uuid,text,jsonb\)\s+to service_role/);
 assert.doesNotMatch(migration,/grant execute[^;]+authenticated/i);
 const edge=read("supabase/functions/coc-stats-collector/index.ts");
 const roster=read("supabase/functions/coc-stats-collector/collector-roster.mjs");
 assert.match(edge,/rosterEvidence/);assert.match(edge,/rpc\/cwl_observe_clan_roster_evidence/);
 assert.match(roster,/rosterTags\(raw\)/);
 const endpoint=read("supabase/functions/coc-clan-members/index.ts");
 assert.match(endpoint,/donations:Number\.isSafeInteger\(m\.donations\)/);
 const sync=read("cloud-sync.mjs");
 assert.match(sync,/rank_before_leave_at,last_donations,last_donations_at,last_donation_increase_at/);
 const h=read("cloud-app.html");
 assert.match(h,/Spendenzuwachs/);assert.match(h,/Keine automatische Beförderung/);
});
