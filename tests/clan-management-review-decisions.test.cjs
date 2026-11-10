"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const core=require("../clan-management-core.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const rules=core.normalizeRules({loyalty_enabled:true});
const fresh=new Date(Date.now()-60_000).toISOString();
const person={tag:"#2PYL",name:"Sample",role:"member",donations:60};
const entry={player_tag:person.tag,is_present:true,confirmed_seconds:70*86400,
 observed_visits:1,last_observed_at:fresh};
const attack={player_tag:person.tag,attack_count:11,three_star_count:10,relevant_wars:7};
const loyalty={player_tag:person.tag,observed_positive_donations:"70",
 observed_donation_events:6,observed_donation_days:5,
 last_positive_donation_at:new Date(Date.now()-86400000).toISOString(),
 observed_absence_windows:0,longest_observed_absence_seconds:0};
const preview=(time=entry,attacks=attack,donations=loyalty,configured=rules)=>
 core.buildPreview([person],[time],[attacks],configured,[donations]);

test("Only actively qualifying paths produce private owner review cases",()=>{
 const view=preview();
 assert.equal(view.ok,true);
 assert.deepEqual(view.rows[0].reviewCases.map(x=>x.kind),["performance","loyalty"]);
 assert.ok(view.rows[0].reviewCases.every(x=>x.fingerprint.length<=768));
 const optedOut=core.normalizeRules({loyalty_enabled:false});
 assert.deepEqual(preview(entry,attack,loyalty,optedOut).rows[0].reviewCases.map(x=>x.kind),["performance"]);
 const noAttacks=preview(entry,{...attack,attack_count:1,three_star_count:1});
 assert.deepEqual(noAttacks.rows[0].reviewCases.map(x=>x.kind),["loyalty"]);
 assert.deepEqual(core.buildPreview([{...person,role:"coLeader"}],[entry],[attack],rules,[loyalty]).rows,[]);
});
test("Acknowledgment is stable across ordinary poll; reopened when meaningful evidence changes",()=>{
 const original=preview();
 const case1=original.rows[0].reviewCases.find(x=>x.kind==="performance");
 const decision={player_tag:person.tag,review_kind:"performance",disposition:"acknowledged",
  revision:4,evidence_fingerprint:case1.fingerprint};
 const reviewed=core.applyReviewDecisions(original,[decision]);
 assert.equal(reviewed.reviewAcknowledged,1);
 assert.equal(reviewed.reviewOpen,1);
 assert.equal(case1.state,"acknowledged");
 assert.equal(case1.revision,4);
 const repeated=preview({...entry,last_observed_at:new Date().toISOString()});
 assert.equal(core.applyReviewDecisions(repeated,[decision]).reviewAcknowledged,1);
 const changed=preview(entry,{...attack,attack_count:12,three_star_count:11});
 assert.equal(core.applyReviewDecisions(changed,[decision]).reviewAcknowledged,0);
 assert.equal(changed.rows[0].reviewCases.find(x=>x.kind==="performance").state,"open");
 const modified=core.normalizeRules({...rules,performance_min_days:15});
 assert.equal(core.applyReviewDecisions(preview(entry,attack,loyalty,modified),[decision]).reviewAcknowledged,0);
});
test("Exception survives changed evidence, until explicit open; no cross-type mixup",()=>{
 const first=preview();
 const case1=first.rows[0].reviewCases.find(x=>x.kind==="loyalty");
 const excepted={player_tag:person.tag,review_kind:"loyalty",
  evidence_fingerprint:case1.fingerprint,disposition:"exception",revision:7};
 const changed=preview(entry,attack,{...loyalty,observed_positive_donations:"88"});
 const summarized=core.applyReviewDecisions(changed,[excepted]);
 assert.equal(summarized.reviewExceptions,1);
 assert.equal(changed.rows[0].reviewCases.find(x=>x.kind==="loyalty").state,"exception");
 assert.equal(changed.rows[0].reviewCases.find(x=>x.kind==="performance").state,"open");
 const reopened=core.applyReviewDecisions(preview(),[{...excepted,disposition:"open"}]);
 assert.equal(reopened.reviewOpen,2);
 assert.equal(reopened.reviewExceptions,0);
});
test("Previously observed Elder return has independent decision, not performance auto-promotion",()=>{
 const returned={...entry,observed_visits:2,
  rank_before_leave:"elder",rank_before_leave_at:new Date(Date.now()-86400000).toISOString()};
 const shown=core.buildPreview([person],[returned],[attack],rules,[loyalty]);
 assert.deepEqual(shown.rows[0].reviewCases.map(x=>x.kind),["return_rank"]);
 const review=shown.rows[0].reviewCases[0];
 const ack=core.applyReviewDecisions(shown,[{player_tag:person.tag,review_kind:"return_rank",
  evidence_fingerprint:review.fingerprint,disposition:"acknowledged",revision:1}]);
 assert.equal(ack.reviewAcknowledged,1);
 assert.equal(ack.reviewOpen,0);
 const newVisit=core.buildPreview([person],[{...returned,observed_visits:3}],[attack],rules,[loyalty]);
 assert.equal(core.applyReviewDecisions(newVisit,[{player_tag:person.tag,review_kind:"return_rank",
  evidence_fingerprint:review.fingerprint,disposition:"acknowledged",revision:1}]).reviewOpen,1);
});
test("SQL prevents cross-tenant reads, vices and anonymous writes; optimistic revision stays scoped",()=>{
 const sql=read("supabase/migrations/20261110222000_cwl_clan_review_decisions.sql");
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
 assert.match(sql,/private\.cwl_is_owner\(clan_id\)/);
 assert.match(sql,/c\.clash_tag=cwl_clan_review_decisions\.source_clash_tag/);
 assert.match(sql,/FOREIGN KEY \(clan_id,source_clash_tag,player_tag\)/);
 assert.match(sql,/FOR UPDATE TO authenticated USING[\s\S]*?WITH CHECK/);
 assert.match(sql,/REVOKE ALL ON public\.cwl_clan_review_decisions FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/GRANT DELETE|SECURITY DEFINER/i);
 assert.match(sql,/revision bigint NOT NULL DEFAULT 1/);
 const sync=read("cloud-sync.mjs");
 assert.match(sync,/role!=="owner"/);
 assert.match(sync,/accountEpoch/);
 assert.match(sync,/\.eq\("revision",revision\)/);
 assert.match(sync,/\.eq\("source_clash_tag",clashTag\)/);
 assert.match(sync,/cwl_clan_review_decisions/);
 assert.doesNotMatch(sync,/service_role/);
 const ui=read("cloud-app.html");
 assert.match(ui,/Quittieren/);
 assert.match(ui,/Ausnahme aufheben/);
 assert.match(ui,/renderClanManagementReviewAction/);
 assert.doesNotMatch(ui,/<button[^>]*id="clanManagement(?:Promote|Demote|Kick)"/i);
});
