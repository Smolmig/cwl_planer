"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../clan-management-core.js");
const root=path.resolve(__dirname,"..");
const file=p=>fs.readFileSync(path.join(root,p),"utf8");
const now=Date.now();
const fresh=new Date(now-10*60000).toISOString();
const people=[
 {tag:"#2PYL",name:"A Member",role:"member",donations:8},
 {tag:"#2PYQ",name:"An Elder",role:"admin",donations:8},
 {tag:"#2PYR",name:"Co Leader",role:"coLeader"},
 {tag:"#2PYJ",name:"Leader",role:"leader"}
];
const tenure=[{player_tag:"#2PYL",confirmed_seconds:14*86400,
 last_observed_at:fresh,is_present:true,observed_visits:1}];
const evidence=[{player_tag:"#2PYL",attack_count:10,three_star_count:8,relevant_wars:8}];

test("Editable defaults are realistic and validated against tenant rules",()=>{
 assert.deepEqual(core.normalizeRules({}),{
  performance_enabled:true,performance_min_days:14,performance_min_attacks:10,
  performance_three_star_percent:80,performance_lookback_days:14,
  loyalty_min_days:60,absence_reset_days:10,
  loyalty_enabled:false,loyalty_min_donations:50,
  loyalty_min_active_days:3,loyalty_lookback_days:30
 });
 const custom=core.normalizeRules({performance_min_days:21,performance_min_attacks:6,
  performance_three_star_percent:70,performance_lookback_days:180,absence_reset_days:null});
 assert.equal(custom.performance_min_days,21);
 assert.equal(custom.absence_reset_days,null);
 for(const bad of [
  {performance_min_days:0},{performance_min_days:1.5},{performance_min_days:"14"},
  {performance_three_star_percent:101},{performance_lookback_days:0},
  {performance_min_attacks:-1},{loyalty_min_days:0},
  {absence_reset_days:0},{performance_enabled:"true"}
 ])assert.throws(()=>core.normalizeRules(bad));
});
test("14 observed days and 8 of 10 full 3-star attacks produce only manual promotion review",()=>{
 const preview=core.buildPreview(people,tenure,evidence,core.normalizeRules({}));
 assert.equal(preview.ok,true);
 assert.equal(preview.rows.length,2);
 assert.equal(preview.promotionReviewChecks,1);
 assert.equal(preview.eligibleForRecommendation,1);
 const candidate=preview.rows.find(p=>p.name==="A Member");
 assert.equal(candidate.status,"Beförderung prüfen");
 assert.match(candidate.promotionNote,/14\/14 Tage.*10\/10.*8\/10 3★/);
 assert.match(candidate.promotionNote,/nur manuell/);
 assert.equal(preview.rows.find(p=>p.name==="An Elder").promotionNote,undefined);
 assert.ok(preview.rows.every(p=>p.rank!=="coLeader"&&p.rank!=="leader"));
});
test("One lucky attack, insufficient tenure, stale roster and no API evidence never qualify",()=>{
 const rules=core.normalizeRules({});
 const cases=[
  [tenure,[{...evidence[0],attack_count:1,three_star_count:1}]],
  [[{...tenure[0],confirmed_seconds:13*86400}],evidence],
  [[{...tenure[0],last_observed_at:new Date(now-2*86400000).toISOString()}],evidence],
  [[{...tenure[0],is_present:false}],evidence],
  [tenure,[{...evidence[0],three_star_count:7}]],
  [tenure,[]],
  [tenure,null]
 ];
 for(const [time,attacks] of cases){
  const view=core.buildPreview(people,time,attacks,rules);
  assert.equal(view.promotionReviewChecks,0);
  assert.notEqual(view.rows[0].status,"Beförderung prüfen");
 }
 assert.match(core.buildPreview(people,tenure,[],rules).rows[0].promotionNote,/keine API-Angriffe belegt/);
});
test("Owner change cannot promote current Elder, and return-rank review takes precedence",()=>{
 const current=core.buildPreview([{tag:"#2PYL",name:"A",role:"admin"}],tenure,evidence,core.normalizeRules({}));
 assert.equal(current.promotionReviewChecks,0);
 const returned=core.buildPreview([{tag:"#2PYL",name:"A",role:"member"}],
  [{...tenure[0],observed_visits:2,rank_before_leave:"elder",
   rank_before_leave_at:new Date(now-86400000).toISOString()}],
  evidence,core.normalizeRules({}));
 assert.equal(returned.restoreRankChecks,1);
 assert.equal(returned.promotionReviewChecks,0);
 assert.equal(returned.rows[0].status,"Früheren Rang prüfen");
});
test("Owner-only RLS and selected-clan API aggregates exclude imports and unfinished wars",()=>{
 const sql=file("supabase/migrations/20261110172500_cwl_clan_promotion_criteria.sql");
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(sql,/private\.cwl_is_owner\(clan_id\)/i);
 assert.match(sql,/FOR UPDATE TO authenticated[\s\S]*?WITH CHECK \(private\.cwl_is_owner\(clan_id\)\)/i);
 assert.match(sql,/REVOKE ALL ON public\.cwl_clan_management_rules FROM PUBLIC, anon, authenticated/i);
 assert.match(sql,/SECURITY INVOKER SET search_path = ''/i);
 assert.match(sql,/private\.cwl_is_owner\(p_clan\)/);
 assert.match(sql,/a\.clan_id = p_clan/);
 assert.match(sql,/w\.source = 'api'/);
 assert.match(sql,/w\.finalized IS TRUE/);
 assert.match(sql,/w\.started_at >= now\(\) - make_interval/);
 assert.doesNotMatch(sql,/SECURITY DEFINER|GRANT ALL ON public\.cwl_clan_management_rules/i);
 const sync=file("cloud-sync.mjs");
 assert.match(sync,/sb\.rpc\("cwl_promotion_attack_evidence"/);
 assert.match(sync,/\.eq\("revision",revision\)/);
 assert.match(sync,/role!=="owner"/);
 const ui=file("cloud-app.html");
 assert.match(ui,/id="clanManagementCriteria"/);
 assert.match(ui,/id="clanRulesSave"/);
 assert.doesNotMatch(ui,/<button[^>]*id="clanManagement(?:Promote|Demote|Kick)"/i);
});
