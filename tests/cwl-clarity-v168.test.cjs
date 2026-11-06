"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
test("CWL Hitrate explicitly counts three-star attacks, not simply all attacks",()=>{
 const html=read("cloud-app.html");
 const start=html.indexOf("function currentCwlTripleRate(");
 const end=html.indexOf("function memberCompactPerformance(",start);
 assert.ok(start>=0&&end>start);
 const context={window:{CWLCloud:{getPlayedAttackResults:()=>({
  1:{"#PYL":{stars:3}},2:{"#PYL":{stars:2}},
  3:{"#QPYL":{stars:3}}
 })}},normalizePlayerTag:value=>String(value||"").toUpperCase()};
 const run=vm.runInNewContext(html.slice(start,end)+";currentCwlTripleRate",context);
 const partial=run("#PYL");
 assert.equal(partial.attacks,2);assert.equal(partial.triples,1);
 assert.match(partial.label,/3★-Hitrate: 50 % \(1\/2 Dreier\)/);
 const absent=run("#2PYL");
 assert.equal(absent.attacks,0);
 assert.match(absent.label,/noch keine belegten Angriffe/);
 assert.doesNotMatch(html,/const cwlHitRate=currentCwlTripleRate/);
 assert.doesNotMatch(html,/cwl-performance-current/);
 assert.match(html,/<span class="cwl-performance-recent">/);
});
test("seven recorded attacks disclose how many of this season are included",async()=>{
 const core=await import("file://"+path.join(root,"cwl-stats-core.mjs"));
 const tag="#PYL";
 const wars=[
  {war_key:"recent",started_at:"2026-11-05T16:00:00Z",war_type:"cwl",source:"api",finalized:true},
  {war_key:"old",started_at:"2026-10-30T16:00:00Z",war_type:"normal",source:"import",finalized:false}
 ];
 const attacks=[
  {war_key:"recent",attacker_tag:tag,attack_order:1,stars:3},
  {war_key:"old",attacker_tag:tag,attack_order:1,stars:2}
 ];
 const stats=core.computeRecentAttackStats(wars,attacks).get(tag);
 assert.equal(stats.attacks,2);
 assert.equal(stats.threes,1);
 assert.equal(stats.hitRate,50);
 assert.equal(stats.cwlBySeason["2026-11"],1);
 const html=read("cloud-app.html");
 assert.match(html,/recent\?\.cwlBySeason\?\.\[season\]/);
 assert.match(html,/AG dieser CWL enthalten/);
 assert.match(html,/aktuelle CWL noch nicht enthalten/);
});
test("war history displays war size, recorded count and unknown import completeness",()=>{
 const stats=read("cwl-stats.mjs");
 assert.match(stats,/team\+" vs\. "\+team/);
 assert.match(stats,/Vollständigkeit nicht bestätigt/);
 assert.match(stats,/erfasste Angriffe/);
 assert.match(stats,/stats-star-legend/);
 assert.match(stats,/few&&!\/wenige Angriffe\/i\.test\(quality\)/);
});
test("member tab opens actual approval controls on same page, not by switching tabs",()=>{
 const html=read("cloud-app.html"),sync=read("cloud-sync.mjs");
 assert.match(html,/id="membersReviewManageHost"/);
 assert.match(html,/class="plan-review-chevron"[^>]*><svg viewBox/);
 assert.match(sync,/function openPlanReviewInMembers\(\)/);
 assert.match(sync,/host\.append\(panel\)/);
 assert.match(sync,/bind\("membersReviewOpenPlan","click",openPlanReviewInMembers\)/);
 assert.match(sync,/function restorePlanReviewToPlan\(\)/);
 assert.doesNotMatch(sync.slice(sync.indexOf("function openPlanReviewInMembers()"),sync.indexOf('bind("planRefreshSuggestions"')),/\.navbtn\[data-view="plan"\]/);
});
test("arena day tabs have no separate gradient sheet or rectangular backdrop",()=>{
 const html=read("cloud-app.html");
 assert.match(html,/html\[data-theme="arena"\] #view-plan #mobileDaySwitcher/);
 assert.match(html,/html\[data-theme="arena"\] #view-plan #mobileDaySwitcher\s*\{\s*background:transparent!important/);
 assert.doesNotMatch(html,/linear-gradient\(to bottom,rgba\(12,16,21/);
 assert.match(html,/#membersReviewManageHost #planReviewDisclosure>\.plan-review-summary\{display:none!important\}/);
 assert.match(html,/prefers-reduced-motion:reduce/);
});
