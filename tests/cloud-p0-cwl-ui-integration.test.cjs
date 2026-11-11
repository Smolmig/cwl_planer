"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const html=read("cloud-app.html"),cloud=read("cloud-sync.mjs"),live=read("cwl-live.mjs"),core=read("cwl-live-core.mjs");
test("P0 guest/account fixes remain present with two-sided CWL opponent detail UI",()=>{
 for(const id of ["cloudChangeNotice","headerClanName","accountQuickButton","accountQuickLogout","guestManualMany","guestManualOne","singleDayMode","allDaysMode"]){
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,"unique "+id);
 }
 for(const marker of [
  "#headerClanName[hidden]{display:none!important}",
  ".cloud-change-content{flex:1 1 auto;",
  "body:has(#view-settings.active) .inline-action-panel{z-index:545}",
  "function renderPlanDayWarnings(dp){",
  'document.getElementById("guestManualMany").onclick=openBulkModal',
  'card.classList.toggle("mobile-day-hidden",single&&d!==mobileSelectedDay)',
  ".cwl-live-team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))",
  "html[data-theme=\"arena\"] .cwl-live-team-details"
 ])assert.ok(html.includes(marker),"missing UI marker "+marker);
 assert.match(cloud,/sb\.auth\.signOut\(\{scope:"local"\}\)/);
 assert.match(cloud,/bind\("accountQuickLogout","click",async/);
 assert.match(cloud,/storage\.saveJson\(\)/);
 assert.match(live,/const opponentAttackRows=cwlAttackRows\(round,"opponent"\)/);
 assert.match(live,/opponentAttackRows\.map\(renderAttackRow\)/);
 assert.match(live,/cwl-live-team-own/);
 assert.match(live,/cwl-live-team-enemy/);
 assert.match(core,/export function cwlAttackRows\(round,side="clan"\)/);
});
test("combined UI branch leaves auth storage, cloud format and original offline client unchanged",()=>{
 const version=JSON.parse(read("cloud-version.json"));
 assert.equal(version.version,"v1.16.72");
 assert.match(html,/const DATA_VERSION=9;/);
 assert.match(html,/const STORAGE_KEY="cwl_planer_mobile_v9";/);
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2";/);
 assert.match(read("service-worker.js"),/cwl-planer-v1-0-2/);
 const api=read("supabase/functions/coc-cwl-status/index.ts");
 assert.match(api,/coc-cwl-status|withSupabase/);
 assert.doesNotMatch(live,/sb\.auth\.signOut\(|storage\.saveJson\(/);
 const auditTables=[...live.matchAll(/sb\.from\("([^"]+)"\)/g)].map(match=>match[1]);
 assert.deepEqual([...new Set(auditTables)],["cwl_missed_owner_decisions","cwl_group_archives"],
   "CWL live may only read the owner-decision audit and same-clan RLS season archive");
 assert.match(live,/\.eq\("clan_id",id\)\.eq\("season",previous\.season\)/);
});
