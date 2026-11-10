"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../clan-management-core.js");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const SQL=read("supabase/migrations/20261110195000_cwl_clan_loyalty_review.sql");
const DAY=86400, now=Date.parse("2026-11-10T18:00:00Z");
const past=days=>new Date(now-days*DAY*1000).toISOString();
const member={tag:"#2PYL",name:"Treue Spielerin",role:"member",donations:67};
const entry={player_tag:"#2PYL",is_present:true,
 confirmed_seconds:65*DAY,observed_visits:1,last_observed_at:past(0)};
const summary={player_tag:"#2PYL",observed_positive_donations:"55",
 observed_donation_events:4,observed_donation_days:3,
 last_positive_donation_at:past(1),observed_absence_windows:0,
 longest_observed_absence_seconds:0};
const rules=core.normalizeRules({loyalty_enabled:true});

test("Loyalty starts opt-in and validates independent clan thresholds",()=>{
 assert.equal(core.DEFAULT_RULES.loyalty_enabled,false);
 assert.deepEqual(
  [rules.loyalty_min_days,rules.loyalty_min_donations,
   rules.loyalty_min_active_days,rules.loyalty_lookback_days,rules.absence_reset_days],
  [60,50,3,30,10]);
 for(const invalid of [{loyalty_enabled:"yes"},{loyalty_min_donations:0},
  {loyalty_min_donations:100001},{loyalty_min_active_days:0},
  {loyalty_min_active_days:31,loyalty_lookback_days:30},
  {loyalty_lookback_days:6},{loyalty_lookback_days:366}])
  assert.throws(()=>core.normalizeRules(invalid));
});
test("60 observed days + recurring verified donations without CW -> manual loyalty review",()=>{
 const result=core.evaluateLoyalty({rank:"member"},entry,summary,rules,now);
 assert.equal(result.eligible,true);
 assert.equal(result.status,"Treue: Beförderung prüfen");
 assert.match(result.note,/55\/50/);
 assert.match(result.note,/Nur manuell/);
 assert.match(result.note,/CW-Pflicht\/Fehlangriffe nicht bewertet/);
 const view=core.buildPreview([member],[entry],[],rules,[summary]);
 // In a real browser current-time freshness is checked, use the pure result
 // above for a pinned synthetic clock.
 assert.equal(view.ok,true);
 assert.equal(view.rows.length,1);
});
test("One donation event, a single donor-day, incomplete timeline and stale roster never qualify",()=>{
 const person={rank:"member"};
 const cases=[
  [{...entry,confirmed_seconds:59*DAY},summary],
  [entry,{...summary,observed_positive_donations:49}],
  [entry,{...summary,observed_donation_days:1}],
  [entry,{...summary,last_positive_donation_at:past(16)}],
  [{...entry,last_observed_at:past(2)},summary],
  [entry,null],
  [{...entry,observed_visits:2},summary],
  [entry,{...summary,observed_donation_days:7}],
  [entry,{...summary,observed_positive_donations:"inf"}]
 ];
 for(const [tenure,donations] of cases)
  assert.notEqual(core.evaluateLoyalty(person,tenure,donations,rules,now)?.eligible,true);
 assert.equal(core.evaluateLoyalty({rank:"elder"},entry,summary,rules,now),null);
 assert.equal(core.evaluateLoyalty({rank:"coLeader"},entry,summary,rules,now),null);
 assert.equal(core.evaluateLoyalty({rank:"member",returnRankNote:"ehem. Ältester"},entry,summary,rules,now),null);
 assert.equal(core.evaluateLoyalty(person,entry,summary,
  core.normalizeRules({loyalty_enabled:false}),now),null);
});
test("Seven observed absent days keep cumulative qualification; eleven require human reset review",()=>{
 const person={rank:"member"},returned={...entry,observed_visits:2};
 const seven={...summary,observed_absence_windows:1,
  longest_observed_absence_seconds:7*DAY};
 const eleven={...seven,longest_observed_absence_seconds:11*DAY};
 assert.equal(core.evaluateLoyalty(person,returned,seven,rules,now).eligible,true);
 const check=core.evaluateLoyalty(person,returned,eleven,rules,now);
 assert.equal(check.eligible,false);
 assert.equal(check.status,"Rückkehr prüfen");
 assert.match(check.note,/Gesamt-Clanzeit bleibt erhalten/);
 const never=core.normalizeRules({loyalty_enabled:true,absence_reset_days:null});
 assert.equal(core.evaluateLoyalty(person,returned,eleven,never,now).eligible,true);
});
test("Owner evidence RPC scoped to app-clan and Clash clan, never exposes other tenants or writes",()=>{
 assert.match(SQL,/ADD COLUMN loyalty_enabled boolean NOT NULL DEFAULT false/);
 assert.match(SQL,/loyalty_min_active_days <= loyalty_lookback_days/);
 assert.match(SQL,/SECURITY INVOKER SET search_path = ''/);
 assert.match(SQL,/private\.cwl_is_owner\(p_clan\)/);
 assert.match(SQL,/c\.id=p_clan/);
 assert.match(SQL,/c\.clash_tag=p_source_clash_tag/);
 assert.match(SQL,/ev\.clan_id=t\.clan_id/);
 assert.match(SQL,/ev\.source_clash_tag=t\.source_clash_tag/);
 assert.match(SQL,/ev\.player_tag=t\.player_tag/);
 assert.match(SQL,/t\.is_present IS TRUE/);
 assert.match(SQL,/REVOKE ALL ON FUNCTION public\.cwl_clan_loyalty_evidence/);
 assert.match(SQL,/TO authenticated/);
 assert.doesNotMatch(SQL,/SECURITY DEFINER|UPDATE public\.cwl_clan_member_tenure|DELETE FROM public\./);
 const sync=read("cloud-sync.mjs");
 assert.match(sync,/sb\.rpc\("cwl_clan_loyalty_evidence"/);
 assert.match(sync,/p_source_clash_tag:normalizeTag\(expectedTag\)/);
 assert.match(sync,/accountEpoch/);
 assert.match(sync,/loyalty_enabled/);
 const ui=read("cloud-app.html");
 assert.match(ui,/id="clanRuleLoyaltyEnabled"/);
 assert.match(ui,/id="clanRuleDonations"/);
 assert.match(ui,/id="clanRuleDonationDays"/);
 assert.match(ui,/id="clanRuleDonationWindow"/);
 assert.match(ui,/keine automatische Löschung der Clanzeit/);
});
