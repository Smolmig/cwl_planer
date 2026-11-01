"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=n=>fs.readFileSync(path.join(root,n),"utf8");

test("Compact member star average is limited to the last seven individual attacks",async()=>{
 const {computeRecentAttackStats}=await import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")).href);
 const wars=[
  {war_key:"normal:old",started_at:"2026-10-01T00:00:00Z",source:"import"},
  {war_key:"normal:new",started_at:"2026-10-30T00:00:00Z",source:"api",finalized:true},
  {war_key:"normal:ongoing",started_at:"2026-10-31T00:00:00Z",source:"api",finalized:false}
 ];
 const attacks=[
  ...Array.from({length:5},(_,i)=>({war_key:"normal:old",attack_order:i+1,attacker_tag:"#2PYL",stars:0})),
  ...Array.from({length:6},(_,i)=>({war_key:"normal:new",attack_order:i+1,attacker_tag:"#2PYL",stars:3})),
  {war_key:"normal:ongoing",attack_order:1,attacker_tag:"#2PYL",stars:0},
  {war_key:"normal:new",attack_order:1,attacker_tag:"#8PYL",stars:2}
 ];
 const recent=computeRecentAttackStats(wars,attacks);
 assert.equal(recent.get("#2PYL").attacks,7);
 assert.equal(recent.get("#2PYL").averageStars,2.57);
 assert.equal(recent.get("#2PYL").hitRate,86);
 assert.equal(recent.get("#8PYL").attacks,1);
 assert.equal(recent.get("#8PYL").averageStars,2);
 assert.equal(computeRecentAttackStats(wars,attacks,20).get("#2PYL").attacks,7);
});
test("Cloud member cards explain both metrics and omit P0 abbreviations",()=>{
 const html=read("cloud-app.html"),stats=read("cwl-stats.mjs");
 assert.match(html,/3★-Hit-Rate: /);
 assert.match(html,/Ø Sterne:/);
 assert.match(html,/letzte 7 Angriffe/);
 assert.match(html,/window\.CWLCloud\?\.active\?"":" · Prio "/);
 assert.doesNotMatch(html,/ · P\$\{m\.priority\}/);
 assert.match(stats,/getRecentPlayerStats/);
});
test("Settings are a single scrollable sheet with a unified sticky header",()=>{
 const html=read("cloud-app.html");
 const from=html.indexOf('<section id="view-settings"');
 const to=html.indexOf('<section id="view-stats"',from);
 assert.ok(from>0&&to>from);
 const section=html.slice(from,to);
 assert.match(section,/class="settings-window"/);
 assert.match(section,/class="settings-dialog-head"/);
 assert.match(section,/id="settingsClose"/);
 assert.match(html,/#view-settings \.settings-window>\.card/);
 assert.match(html,/overflow-y:auto/);
 assert.match(html,/position:sticky;top:0/);
});
