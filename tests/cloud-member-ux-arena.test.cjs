"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const audit=fs.readFileSync(path.join(root,"supabase/migrations/20261102235500_detail_cloud_profile_audit.sql"),"utf8");
test("Recent member attack stats explain exact 3-star and average formula and provenance",async()=>{
 const {computeRecentAttackStats}=await import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")).href);
 const wars=[
  {war_key:"new",war_type:"cwl",source:"api",finalized:true,started_at:"2026-11-02T00:00:00Z"},
  {war_key:"old",war_type:"normal",source:"import",finalized:false,started_at:"2026-10-25T00:00:00Z"}
 ];
 const attacks=[];
 for(const [key,stars] of [["new",[3,2]],["old",[1,3,0]]])
  stars.forEach((n,i)=>attacks.push({war_key:key,attacker_tag:"#2PYL",attack_order:i+1,stars:n}));
 const s=computeRecentAttackStats(wars,attacks,7).get("#2PYL");
 assert.equal(s.attacks,5);assert.equal(s.threes,2);assert.equal(s.starsTotal,9);
 assert.equal(s.hitRate,40);assert.equal(s.averageStars,1.8);
 assert.equal(s.normalAttacks,3);assert.equal(s.cwlAttacks,2);
 assert.equal(s.importedAttacks,3);assert.equal(s.apiAttacks,2);
});
test("Players with actual statistics cannot override 3-star strength manually, others can",()=>{
 assert.match(html,/const hasAttackStats=!!/);
 assert.match(html,/\$\{hasAttackStats\?\x60<span class="member-stat-automatic"/);
 assert.ok(html.includes('el.querySelector(".member-strength-picker")?.addEventListener'));
 assert.match(html,/member-config-help/);
 assert.match(html,/function openMemberConfigHelp\(m\)/);
 assert.match(html,/stats\.threes/);
 assert.match(html,/stats\.starsTotal/);
 assert.match(html,/stats\.cwlAttacks/);
 assert.match(html,/importierter Historie/);
});
test("Member participation and fixed day controls are unambiguous",()=>{
 assert.match(html,/m\.participating\?"Dabei":"Pause"/);
 assert.match(html,/member-fixed-target/);
 assert.match(html,/Fix: alle verfügbaren Tage/);
 const compact=html.slice(html.indexOf("function memberCompactPerformance("),html.indexOf("function memberPerformance("));
 assert.doesNotMatch(compact,/7 Angriffe max\./);
});
test("Arena theme and deployment bars stay separate from normal Dark",()=>{
 assert.match(html,/value="arena"/);
 assert.match(html,/html\[data-theme="arena"\]/);
 assert.match(html,/--primary:#dbb771/);
 assert.match(html,/summary-progress-played/);
 assert.match(html,/summary-progress-future/);
 assert.match(html,/summary-progress-track/);
});
test("Header presents clan label and sync information in smaller icon",()=>{
 assert.match(html,/id="headerClanName"/);
 assert.match(html,/id="syncInfoBtn"/);
 assert.match(html,/id="syncInfoModal"/);
 assert.match(html,/15 Sekunden/);
 assert.match(html,/5 Minuten/);
 assert.match(sync,/headerClan\.textContent=this\.active\?label/);
});
test("Conflict details and reload are available directly from the notice",()=>{
 assert.match(html,/id="cloudChangeReload"/);
 assert.match(html,/id="cloudChangeDetailList"/);
 assert.match(sync,/async function showRemoteChangeDetails\(\)/);
 assert.match(sync,/bind\("cloudChangeReload","click",refreshCloud\)/);
 assert.match(sync,/bind\("saveBadge","click"/);
});
test("Audit migration captures current member features, planning config and day goals",()=>{
 assert.match(audit,/targetDays/);
 assert.match(audit,/config_differenzen/);
 assert.match(audit,/day_goals_geaendert/);
});
