"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const file=name=>fs.readFileSync(path.join(root,name),"utf8");
test("Reported average stars uses only recorded attacks",async()=>{
 const {computeWarStats}=await import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")).href);
 const wars=[{war_key:"normal:a",war_type:"normal",source:"import",started_at:"2026-10-30T22:00:00Z",team_size:2,finalized:false,opponent_name:"Example"}];
 const attacks=[{war_key:"normal:a",attacker_tag:"#2PYL",attacker_name:"A",attacker_th:18,defender_th:18,stars:3,destruction:100},
  {war_key:"normal:a",attacker_tag:"#2PYL",attacker_name:"A",attacker_th:18,defender_th:18,stars:2,destruction:80}];
 const s=computeWarStats(wars,attacks,{type:"normal",last:1});
 assert.equal(s.averageStars,2.5);
 assert.equal(s.hitRate,50);
 assert.equal(s.rows[0].averageStars,2.5);
});
test("War history, missing-data labels and individual CW attacks are visible",()=>{
 const html=file("cloud-app.html"),ui=file("cwl-stats.mjs");
 for(const token of ["statsWarHistory","statsMissingNote","statsSameTH","settingsClose","settingsAutoRoster"])assert.ok(html.includes(token));
 assert.match(ui,/renderWarHistory\(\)/);
 assert.match(ui,/mind\. /);
 assert.match(ui,/k\. A\./);
 assert.match(ui,/stats-attack-chips/);
});
test("Background roster sync never silently changes a planned departure",()=>{
 const sync=file("cloud-sync.mjs");
 assert.match(sync,/async function getRoster\(\{automatic=false\}=\{\}\)/);
 assert.match(sync,/if\(critical\.length\)/);
 assert.match(sync,/autoRosterChecks/);
 assert.match(sync,/cwl_auto_roster_/);
 assert.match(sync,/if\(changes\)await applyRoster\(\)/);
 assert.match(file("cloud-app.html"),/Neue Spieler/);
});
test("Invite access removal is not a permanent ban",()=>{
 const sync=file("cloud-sync.mjs"),sql=file("supabase/migrations/20261101041209_cwl_rejoin_invite_after_removal_check.sql");
 assert.match(sync,/cwl_ban_clan_member/);
 assert.match(sync,/cwl_remove_clan_member/);
 assert.match(sql,/p_issued_at<=v_row\.blocked_at/);
 assert.match(sql,/v_row\.permanent/);
});
test("Only five previous plan snapshots remain and help explains current features",()=>{
 const sql=file("supabase/migrations/20261101041201_cwl_snapshot_retention_five.sql");
 const backups=file("cloud-backups.mjs"),html=file("cloud-app.html");
 assert.match(sql,/offset 5/);
 assert.match(backups,/limit\(5\)/);
 assert.match(html,/Die letzten fünf automatischen Sicherungen/);
 assert.match(html,/Ein Link öffnet direkt ein kleines Beitrittsfenster/);
});
